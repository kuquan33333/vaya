import { NextRequest, NextResponse } from "next/server";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { hashStaffSubject, verifyStaffAccess, type StaffIdentity } from "@/lib/security/cloudflareAccess";
import { sameOrigin } from "@/lib/leads/service";

interface StaffStatement {
  bind(...values: unknown[]): StaffStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

interface StaffDatabase {
  prepare(query: string): StaffStatement;
  batch(statements: StaffStatement[]): Promise<unknown[]>;
}

const VALID_STATUSES = new Set(["new", "contacted", "pending", "closed", "deleted"]);

function denied() {
  return NextResponse.json({ error: "staff_access_required" }, { status: 403, headers: { "Cache-Control": "no-store" } });
}

async function identity(request: Request): Promise<StaffIdentity | null> {
  const runtime = getCloudflareEnv();
  return verifyStaffAccess(request, runtime);
}

async function audit(db: StaffDatabase, staff: StaffIdentity, action: string, publicId: string, metadata: Record<string, unknown> = {}) {
  await db.prepare(
    `INSERT INTO audit_events
       (event_id, actor_type, actor_id_hash, action, entity_type, entity_id, metadata_json)
     VALUES (?, 'staff', ?, ?, 'lead', ?, ?)`,
  ).bind(crypto.randomUUID(), await hashStaffSubject(staff.subject), action, publicId, JSON.stringify(metadata)).run();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> },
) {
  const staff = await identity(request);
  const runtime = getCloudflareEnv();
  if (!staff || !runtime.DB) return denied();
  const { publicId } = await context.params;
  const db = runtime.DB as unknown as StaffDatabase;
  const lead = await db.prepare(
    `SELECT lead_id, public_id, full_name, phone_e164, province, product_id,
            provider_id, loan_type, amount_vnd, term_months, note, source,
            campaign, status, created_at, updated_at
     FROM leads WHERE public_id = ?1`,
  ).bind(publicId).first<Record<string, unknown>>();
  if (!lead) return NextResponse.json({ error: "lead_not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const documents = await db.prepare(
    `SELECT document_id, side, content_type, byte_size, sha256, status,
            telegram_message_id, telegram_sent_at, error_message,
            expires_at, deleted_at, created_at
     FROM lead_documents WHERE lead_id = ?1 ORDER BY side`,
  ).bind(lead.lead_id).all<Record<string, unknown>>();
  await audit(db, staff, "lead.viewed", publicId, { documentCount: documents.results.length });
  return NextResponse.json({ lead: { ...lead, lead_id: undefined }, documents: documents.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> },
) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "cross_origin_request" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const staff = await identity(request);
  const runtime = getCloudflareEnv();
  if (!staff || !runtime.DB) return denied();
  const { publicId } = await context.params;
  let body: { status?: string };
  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.status || !VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const db = runtime.DB as unknown as StaffDatabase;
  const lead = await db.prepare("SELECT lead_id FROM leads WHERE public_id = ?1").bind(publicId).first<{ lead_id: string }>();
  if (!lead) return NextResponse.json({ error: "lead_not_found" }, { status: 404 });

  if (body.status === "deleted") {
    const documents = await db.prepare("SELECT document_id FROM lead_documents WHERE lead_id = ?1 AND status != 'deleted'").bind(lead.lead_id).all<{ document_id: string }>();
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("UPDATE leads SET status = 'deleted', updated_at = ?1 WHERE lead_id = ?2").bind(now, lead.lead_id),
      db.prepare("UPDATE lead_documents SET status = 'deleted', deleted_at = ?1 WHERE lead_id = ?2").bind(now, lead.lead_id),
      db.prepare("UPDATE consent_records SET revoked_at = COALESCE(revoked_at, ?1) WHERE lead_id = ?2").bind(now, lead.lead_id),
    ]);
    await audit(db, staff, "lead.deleted", publicId, { documentCount: documents.results.length, telegramRevocation: "not_guaranteed" });
  } else {
    await db.prepare("UPDATE leads SET status = ?1, updated_at = datetime('now') WHERE lead_id = ?2").bind(body.status, lead.lead_id).run();
    await audit(db, staff, "lead.status_changed", publicId, { status: body.status });
  }
  return NextResponse.json({ ok: true, publicId, status: body.status }, { headers: { "Cache-Control": "no-store" } });
}
