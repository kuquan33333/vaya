import { NextRequest, NextResponse } from "next/server";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import {
  documentUploadsEnabled,
  sameOrigin,
  verifyDocumentUploadToken,
} from "@/lib/leads/service";
import { deleteTelegramMessage, sendTelegramDocument, verifyTelegramConfiguration } from "@/lib/leads/telegram";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { hasAllowedSignature } from "@/lib/leads/documentSecurity";

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface DocumentStatement {
  bind(...values: unknown[]): DocumentStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface DocumentDatabase {
  prepare(query: string): DocumentStatement;
  batch(statements: DocumentStatement[]): Promise<unknown[]>;
}

type DocumentSide = "front" | "back";

function clientIp(request: NextRequest): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function extension(contentType: string): string {
  return contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
}

async function sha256(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashAuditActor(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function unavailableResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Send the original CCCD bytes directly to the configured Telegram Bot.
 * The Worker never writes the bytes to D1, a bucket, or a temporary object.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return unavailableResponse("cross_origin_request", 403);
  const ip = clientIp(request);
  const rate = checkRateLimit(`lead-document:${ip}`, 10, 60_000);
  if (rate.limited) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)), "Cache-Control": "no-store" } },
    );
  }

  const runtime = getCloudflareEnv();
  // This check intentionally happens before formData()/arrayBuffer() so an
  // unconfigured Telegram destination never accepts an image body.
  if (!documentUploadsEnabled(runtime) || !runtime.DB || !runtime.DOCUMENT_UPLOAD_SIGNING_KEY) {
    return unavailableResponse("document_upload_disabled", 503);
  }
  if (!(await verifyTelegramConfiguration(runtime))) {
    return unavailableResponse("telegram_not_configured_or_unavailable", 503);
  }
  if (runtime.LEAD_RATE_LIMIT) {
    try {
      const outcome = await runtime.LEAD_RATE_LIMIT.limit({ key: ip || "unknown" });
      if (!outcome.success) return unavailableResponse("rate_limited", 429);
    } catch {
      // The isolate-local limiter remains the safe local/dev fallback.
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return unavailableResponse("invalid_multipart", 400);
  }
  const publicId = String(form.get("publicId") ?? "").trim();
  const token = String(form.get("uploadToken") ?? "").trim();
  const sideValue = String(form.get("side") ?? "");
  const side: DocumentSide | null = sideValue === "front" || sideValue === "back" ? sideValue : null;
  const fileValue = form.get("file");
  if (!publicId || !token || !side || !(fileValue instanceof File)) {
    return unavailableResponse("invalid_document_request", 400);
  }
  if (fileValue.size <= 0 || fileValue.size > MAX_DOCUMENT_BYTES || !ALLOWED_TYPES.has(fileValue.type)) {
    return unavailableResponse("document_type_or_size_not_allowed", 400);
  }

  const db = runtime.DB as unknown as DocumentDatabase;
  const lead = await db
    .prepare(
      `SELECT l.lead_id
       FROM leads l
       WHERE l.public_id = ?1 AND l.status != 'deleted'
         AND EXISTS (
           SELECT 1 FROM consent_records c
           WHERE c.lead_id = l.lead_id
             AND c.consent_type = 'telegram_document'
             AND c.granted = 1
             AND c.revoked_at IS NULL
         )`,
    )
    .bind(publicId)
    .first<{ lead_id: string }>();
  if (!lead) return unavailableResponse("document_consent_or_lead_not_found", 404);
  if (!(await verifyDocumentUploadToken(token, lead.lead_id, side, runtime.DOCUMENT_UPLOAD_SIGNING_KEY))) {
    return unavailableResponse("invalid_or_expired_upload_token", 403);
  }

  const existing = await db
    .prepare(
      `SELECT document_id, status
       FROM lead_documents WHERE lead_id = ?1 AND side = ?2`,
    )
    .bind(lead.lead_id, side)
    .first<{ document_id: string; status: "pending" | "sent" | "failed" | "deleted" }>();
  if (existing?.status === "pending" || existing?.status === "sent") {
    return unavailableResponse(existing.status === "sent" ? "document_already_sent" : "document_upload_in_progress", 409);
  }

  const bytes = await fileValue.arrayBuffer();
  if (!hasAllowedSignature(fileValue.type, new Uint8Array(bytes.slice(0, 16)))) {
    return unavailableResponse("document_signature_not_allowed", 400);
  }
  const digest = await sha256(bytes);
  const documentId = existing?.document_id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    if (existing) {
      await db
        .prepare(
          `UPDATE lead_documents
           SET content_type = ?1, byte_size = ?2, sha256 = ?3, status = 'pending',
               telegram_message_id = NULL, telegram_file_id = NULL,
               telegram_sent_at = NULL, error_message = NULL,
               expires_at = ?4, deleted_at = NULL
           WHERE document_id = ?5`,
        )
        .bind(fileValue.type, fileValue.size, digest, expiry, documentId)
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO lead_documents
             (document_id, lead_id, side, content_type, byte_size, sha256, status, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
        )
        .bind(documentId, lead.lead_id, side, fileValue.type, fileValue.size, digest, expiry)
        .run();
    }

    const telegram = await sendTelegramDocument(runtime, {
      bytes,
      contentType: fileValue.type,
      fileName: `cccd-${publicId}-${side}.${extension(fileValue.type)}`,
      caption: [
        `CCCD mặt ${side === "front" ? "trước" : "sau"}`,
        `Mã hồ sơ: ${publicId}`,
        "Đã có sự đồng ý riêng theo privacy-v2.",
        "Telegram Bot không mã hóa đầu cuối; không bảo đảm thu hồi ảnh sau khi gửi.",
      ].join("\n"),
    });
    await db
      .prepare(
        `UPDATE lead_documents
         SET status = 'sent', telegram_message_id = ?1, telegram_file_id = ?2,
             telegram_sent_at = ?3, error_message = NULL
         WHERE document_id = ?4`,
      )
      .bind(telegram.messageId, telegram.fileId, now, documentId)
      .run();
    return NextResponse.json(
      { ok: true, document: { documentId, side, status: "sent" } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    await db
      .prepare(
        `UPDATE lead_documents
         SET status = 'failed', error_message = ?1
         WHERE document_id = ?2`,
      )
      .bind(error instanceof Error ? error.message.slice(0, 200) : "telegram_delivery_failed", documentId)
      .run()
      .catch(() => undefined);
    console.error("[lead-document] Telegram delivery failed", error instanceof Error ? error.message : "unknown");
    return unavailableResponse("telegram_document_delivery_failed", 502);
  }
}

/** Remove D1 metadata and attempt Telegram deletion, without claiming revocation. */
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return unavailableResponse("cross_origin_request", 403);
  const runtime = getCloudflareEnv();
  if (!runtime.DB || !runtime.DOCUMENT_UPLOAD_SIGNING_KEY) return unavailableResponse("document_upload_disabled", 503);
  const ip = clientIp(request);
  const rate = checkRateLimit(`lead-document-delete:${ip}`, 10, 60_000);
  if (rate.limited) return unavailableResponse("rate_limited", 429);

  let body: { publicId?: unknown; uploadToken?: unknown; side?: unknown };
  try {
    body = (await request.json()) as { publicId?: unknown; uploadToken?: unknown; side?: unknown };
  } catch {
    return unavailableResponse("invalid_json", 400);
  }
  const publicId = typeof body.publicId === "string" ? body.publicId.trim() : "";
  const token = typeof body.uploadToken === "string" ? body.uploadToken.trim() : "";
  const side = body.side === "front" || body.side === "back" ? body.side : null;
  if (!publicId || !token || !side) return unavailableResponse("invalid_document_request", 400);

  const db = runtime.DB as unknown as DocumentDatabase;
  const lead = await db
    .prepare(
      `SELECT l.lead_id FROM leads l
       WHERE l.public_id = ?1 AND l.status != 'deleted'
         AND EXISTS (
           SELECT 1 FROM consent_records c
           WHERE c.lead_id = l.lead_id AND c.consent_type = 'telegram_document'
             AND c.granted = 1 AND c.revoked_at IS NULL
         )`,
    )
    .bind(publicId)
    .first<{ lead_id: string }>();
  if (!lead || !(await verifyDocumentUploadToken(token, lead.lead_id, side, runtime.DOCUMENT_UPLOAD_SIGNING_KEY))) {
    return unavailableResponse("document_not_found", 404);
  }
  const document = await db
    .prepare(
      `SELECT document_id, telegram_message_id, status
       FROM lead_documents WHERE lead_id = ?1 AND side = ?2`,
    )
    .bind(lead.lead_id, side)
    .first<{ document_id: string; telegram_message_id: number | null; status: string }>();
  if (!document || document.status === "deleted") return unavailableResponse("document_not_found", 404);

  const telegramDeleteAttempted = typeof document.telegram_message_id === "number";
  const telegramDeleted = telegramDeleteAttempted
    ? await deleteTelegramMessage(runtime, document.telegram_message_id!)
    : false;
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE lead_documents SET status = 'deleted', deleted_at = ?1 WHERE document_id = ?2").bind(now, document.document_id),
    db.prepare(
      `UPDATE consent_records
       SET revoked_at = COALESCE(revoked_at, ?1)
       WHERE lead_id = ?2 AND consent_type IN ('document_upload', 'telegram_document')
         AND NOT EXISTS (
           SELECT 1 FROM lead_documents
           WHERE lead_id = ?2 AND status IN ('pending', 'sent')
         )`,
    ).bind(now, lead.lead_id),
    db.prepare(
      `INSERT INTO audit_events
         (event_id, actor_type, actor_id_hash, action, entity_type, entity_id, metadata_json)
       VALUES (?, 'customer', ?, 'document.deleted', 'lead_document', ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      await hashAuditActor(publicId),
      document.document_id,
      JSON.stringify({ side, telegramDeleteAttempted, telegramDeleted }),
    ),
  ]);
  return NextResponse.json(
    {
      ok: true,
      side,
      status: "deleted",
      telegramRevocation: telegramDeleteAttempted && telegramDeleted ? "attempted_and_confirmed" : "not_guaranteed",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
