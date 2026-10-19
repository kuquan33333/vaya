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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ publicId: string; side: string }> },
) {
  const runtime = getCloudflareEnv();
  const staff = await verifyStaffAccess(request, runtime);
  if (!staff || !runtime.DB || !runtime.LEAD_DOCUMENTS) {
    return NextResponse.json({ error: "staff_access_required" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const { publicId, side } = await context.params;
  if (side !== "front" && side !== "back") return NextResponse.json({ error: "invalid_document_side" }, { status: 400 });
  const db = runtime.DB as unknown as DocumentDatabase;
  const document = await db.prepare(
    `SELECT d.object_key, d.content_type, d.status, d.sha256
     FROM lead_documents d JOIN leads l ON l.lead_id = d.lead_id
     WHERE l.public_id = ?1 AND d.side = ?2 AND l.status != 'deleted'`,
  ).bind(publicId, side).first<{ object_key: string; content_type: string; status: string; sha256: string }>();
  if (!document || document.status === "deleted" || document.status === "quarantined") {
    return NextResponse.json({ error: "document_not_available" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const object = await runtime.LEAD_DOCUMENTS.get(document.object_key);
  if (!object) return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  await db.prepare(
    `INSERT INTO audit_events
       (event_id, actor_type, actor_id_hash, action, entity_type, entity_id, metadata_json)
     VALUES (?, 'staff', ?, 'document.viewed', 'lead_document', ?, ?)`,
  ).bind(crypto.randomUUID(), await hashStaffSubject(staff.subject), document.object_key, JSON.stringify({ side, sha256: document.sha256 })).run();
  return new Response(await object.arrayBuffer(), {
    headers: {
      "Content-Type": document.content_type,
      "Content-Disposition": `attachment; filename="lead-document-${side}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
