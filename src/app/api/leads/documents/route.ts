import { NextRequest, NextResponse } from "next/server";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import {
  documentUploadsEnabled,
  sameOrigin,
  verifyDocumentUploadToken,
} from "@/lib/leads/service";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { hasAllowedSignature, stripImageMetadata } from "@/lib/leads/documentSecurity";

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface DocumentDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
  batch(statements: unknown[]): Promise<unknown[]>;
}

async function sha256(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clientIp(request: NextRequest): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Upload a single optional document only after the lead flow has explicitly
 * enabled document storage. Objects are written to a private R2 bucket; this
 * route never returns a public URL and never sends document metadata to chat or
 * Telegram.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "cross_origin_request" }, { status: 403 });
  }
  const ip = clientIp(request);
  const rate = checkRateLimit(`lead-document:${ip}`, 10, 60_000);
  if (rate.limited) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } },
    );
  }

  const runtime = getCloudflareEnv();
  if (runtime.LEAD_RATE_LIMIT) {
    try {
      const outcome = await runtime.LEAD_RATE_LIMIT.limit({ key: ip || "unknown" });
      if (!outcome.success) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Cache-Control": "no-store" } });
    } catch {
      // Keep the isolate-local limiter as a local/dev fallback.
    }
  }
  if (!documentUploadsEnabled(runtime) || !runtime.DB || !runtime.LEAD_DOCUMENTS) {
    return NextResponse.json({ error: "document_upload_disabled" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  }
  const publicId = String(form.get("publicId") ?? "").trim();
  const token = String(form.get("uploadToken") ?? "").trim();
  const side = String(form.get("side") ?? "");
  const fileValue = form.get("file");
  if (
    !publicId ||
    !token ||
    (side !== "front" && side !== "back") ||
    !(fileValue instanceof File)
  ) {
    return NextResponse.json({ error: "invalid_document_request" }, { status: 400 });
  }
  if (fileValue.size <= 0 || fileValue.size > MAX_DOCUMENT_BYTES || !ALLOWED_TYPES.has(fileValue.type)) {
    return NextResponse.json({ error: "document_type_or_size_not_allowed" }, { status: 400 });
  }

  const db = runtime.DB as unknown as DocumentDatabase;
  const lead = await db
    .prepare("SELECT lead_id FROM leads WHERE public_id = ?1 AND status != 'deleted'")
    .bind(publicId)
    .first<{ lead_id: string }>();
  if (!lead || !runtime.DOCUMENT_UPLOAD_SIGNING_KEY) {
    return NextResponse.json({ error: "lead_not_found" }, { status: 404 });
  }
  if (
    !(await verifyDocumentUploadToken(token, lead.lead_id, side, runtime.DOCUMENT_UPLOAD_SIGNING_KEY))
  ) {
    return NextResponse.json({ error: "invalid_or_expired_upload_token" }, { status: 403 });
  }
  const existing = await db
    .prepare("SELECT document_id FROM lead_documents WHERE lead_id = ?1 AND side = ?2 AND status != 'deleted'")
    .bind(lead.lead_id, side)
    .first<{ document_id: string }>();
  if (existing) return NextResponse.json({ error: "document_already_uploaded" }, { status: 409 });

  const bytes = await fileValue.arrayBuffer();
  if (!hasAllowedSignature(fileValue.type, new Uint8Array(bytes.slice(0, 16)))) {
    return NextResponse.json({ error: "document_signature_not_allowed" }, { status: 400 });
  }
  const sanitized = stripImageMetadata(fileValue.type, new Uint8Array(bytes));
  if (!sanitized) {
    return NextResponse.json({ error: "document_metadata_processing_failed" }, { status: 400 });
  }
  const digest = await sha256(sanitized.buffer as ArrayBuffer);
  const documentId = crypto.randomUUID();
  const objectKey = `private/lead-documents/${crypto.randomUUID()}-${documentId}`;
  try {
    await runtime.LEAD_DOCUMENTS.put(objectKey, sanitized.buffer as ArrayBuffer, {
      httpMetadata: { contentType: fileValue.type },
      customMetadata: { leadId: lead.lead_id, side, sha256: digest },
    });
    await db.batch([
      db
        .prepare(
          `INSERT INTO lead_documents
             (document_id, lead_id, side, object_key, content_type, byte_size,
              sha256, status, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'uploaded', datetime('now', '+30 days'))`,
        )
        .bind(documentId, lead.lead_id, side, objectKey, fileValue.type, sanitized.byteLength, digest),
    ]);
  } catch (error) {
    await runtime.LEAD_DOCUMENTS.delete(objectKey).catch(() => undefined);
    console.error("[lead-document] private upload failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "document_storage_unavailable" }, { status: 503 });
  }

  return NextResponse.json(
    { ok: true, document: { documentId, side, status: "uploaded" } },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

async function hashAuditActor(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Customer self-service deletion/revocation for one uploaded document side. */
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "cross_origin_request" }, { status: 403 });
  const ip = clientIp(request);
  const rate = checkRateLimit(`lead-document-delete:${ip}`, 10, 60_000);
  if (rate.limited) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const runtime = getCloudflareEnv();
  if (!documentUploadsEnabled(runtime) || !runtime.DB || !runtime.LEAD_DOCUMENTS) {
    return NextResponse.json({ error: "document_upload_disabled" }, { status: 404 });
  }

  let body: { publicId?: unknown; uploadToken?: unknown; side?: unknown };
  try {
    body = (await request.json()) as { publicId?: unknown; uploadToken?: unknown; side?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const publicId = typeof body.publicId === "string" ? body.publicId.trim() : "";
  const token = typeof body.uploadToken === "string" ? body.uploadToken.trim() : "";
  const side = body.side === "front" || body.side === "back" ? body.side : null;
  if (!publicId || !token || !side) return NextResponse.json({ error: "invalid_document_request" }, { status: 400 });

  const db = runtime.DB as unknown as DocumentDatabase;
  const lead = await db.prepare("SELECT lead_id FROM leads WHERE public_id = ?1 AND status != 'deleted'").bind(publicId).first<{ lead_id: string }>();
  if (!lead || !runtime.DOCUMENT_UPLOAD_SIGNING_KEY || !(await verifyDocumentUploadToken(token, lead.lead_id, side, runtime.DOCUMENT_UPLOAD_SIGNING_KEY))) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }
  const document = await db.prepare(
    `SELECT document_id, object_key, status
     FROM lead_documents WHERE lead_id = ?1 AND side = ?2`,
  ).bind(lead.lead_id, side).first<{ document_id: string; object_key: string; status: string }>();
  if (!document || document.status === "deleted") return NextResponse.json({ error: "document_not_found" }, { status: 404 });

  try {
    await runtime.LEAD_DOCUMENTS.delete(document.object_key);
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("UPDATE lead_documents SET status = 'deleted', deleted_at = ?1 WHERE document_id = ?2").bind(now, document.document_id),
      db.prepare(
        `UPDATE consent_records
         SET revoked_at = COALESCE(revoked_at, ?1)
         WHERE lead_id = ?2 AND consent_type = 'document_upload'
           AND NOT EXISTS (
             SELECT 1 FROM lead_documents
             WHERE lead_id = ?2 AND status IN ('authorized', 'uploaded', 'quarantined')
           )`,
      ).bind(now, lead.lead_id),
      db.prepare(
        `INSERT INTO audit_events
           (event_id, actor_type, actor_id_hash, action, entity_type, entity_id, metadata_json)
         VALUES (?, 'customer', ?, 'document.deleted', 'lead_document', ?, ?)`,
      ).bind(crypto.randomUUID(), await hashAuditActor(publicId), document.document_id, JSON.stringify({ side })),
    ]);
  } catch (error) {
    console.error("[lead-document] customer delete failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "document_delete_unavailable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, side, status: "deleted" }, { headers: { "Cache-Control": "no-store" } });
}
