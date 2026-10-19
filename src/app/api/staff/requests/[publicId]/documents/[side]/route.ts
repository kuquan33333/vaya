import { NextRequest, NextResponse } from "next/server";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { hashStaffSubject, verifyStaffAccess } from "@/lib/security/cloudflareAccess";

interface DocumentStatement {
  bind(...values: unknown[]): DocumentStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface DocumentDatabase {
  prepare(query: string): DocumentStatement;
}

/**
 * CCCD is delivered directly to the configured Telegram chat. This endpoint
 * exposes delivery metadata to authorized staff, never the image bytes.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ publicId: string; side: string }> },
) {
  const runtime = getCloudflareEnv();
  const staff = await verifyStaffAccess(request, runtime);
  if (!staff || !runtime.DB) {
    return NextResponse.json({ error: "staff_access_required" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const { publicId, side } = await context.params;
  if (side !== "front" && side !== "back") return NextResponse.json({ error: "invalid_document_side" }, { status: 400 });
  const db = runtime.DB as unknown as DocumentDatabase;
  const document = await db.prepare(
    `SELECT d.document_id, d.content_type, d.byte_size, d.sha256, d.status,
            d.telegram_message_id, d.telegram_sent_at, d.error_message
     FROM lead_documents d JOIN leads l ON l.lead_id = d.lead_id
     WHERE l.public_id = ?1 AND d.side = ?2 AND l.status != 'deleted'`,
  ).bind(publicId, side).first<{
    document_id: string;
    content_type: string;
    byte_size: number;
    sha256: string;
    status: string;
    telegram_message_id: number | null;
    telegram_sent_at: string | null;
    error_message: string | null;
  }>();
  if (!document || document.status === "deleted") {
    return NextResponse.json({ error: "document_not_available" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  await db.prepare(
    `INSERT INTO audit_events
       (event_id, actor_type, actor_id_hash, action, entity_type, entity_id, metadata_json)
     VALUES (?, 'staff', ?, 'document.telegram_metadata_viewed', 'lead_document', ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    await hashStaffSubject(staff.subject),
    document.document_id,
    JSON.stringify({ side, sha256: document.sha256 }),
  ).run();
  return NextResponse.json(
    {
      ok: true,
      document: {
        documentId: document.document_id,
        side,
        contentType: document.content_type,
        byteSize: document.byte_size,
        sha256: document.sha256,
        status: document.status,
        telegramMessageId: document.telegram_message_id,
        telegramSentAt: document.telegram_sent_at,
        error: document.error_message,
        bytesAvailableInWorker: false,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
