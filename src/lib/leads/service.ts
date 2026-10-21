import type { LeadInput } from "./schema";
import { normalizeVietnamPhone } from "./schema";
import { telegramConfigLooksValid } from "./telegram";

interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
}

export interface LeadDatabase {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
}

export interface LeadRuntime {
  DB?: LeadDatabase;
  LEAD_QUEUE?: { send(body: unknown): Promise<unknown> };
  LEAD_RATE_LIMIT?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  PUBLIC_SITE_URL?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  DOCUMENT_UPLOADS_ENABLED?: string;
  DOCUMENT_UPLOAD_SIGNING_KEY?: string;
}

export interface LeadRequestContext {
  origin: string | null;
  ip: string;
  userAgent: string;
  requestUrl: string;
}

export interface CreatedLead {
  leadId: string;
  publicId: string;
  status: "new";
  duplicate: boolean;
  notificationQueued: boolean;
  documentsEnabled: boolean;
  uploadTokens?: { front: string; back: string; expiresAt: string };
}

function hasTelegramDocumentConsent(input: LeadInput): boolean {
  return input.consentDocumentUpload === true && input.consentTelegramDocument === true;
}

function uuid(): string {
  return crypto.randomUUID();
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signingKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

export async function createDocumentUploadToken(
  leadId: string,
  side: "front" | "back",
  expiresAt: number,
  secret: string,
): Promise<string> {
  const payload = `${leadId}:${side}:${expiresAt}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret, ["sign"]),
    new TextEncoder().encode(payload),
  );
  return `${base64Url(new TextEncoder().encode(payload))}.${base64Url(new Uint8Array(signature))}`;
}

export async function verifyDocumentUploadToken(
  token: string,
  leadId: string,
  side: "front" | "back",
  secret: string,
): Promise<boolean> {
  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) return false;
  try {
    const payload = new TextDecoder().decode(fromBase64Url(encodedPayload));
    const [tokenLeadId, tokenSide, expiry] = payload.split(":");
    if (tokenLeadId !== leadId || tokenSide !== side || Number(expiry) < Date.now()) return false;
    return crypto.subtle.verify(
      "HMAC",
      await signingKey(secret, ["verify"]),
      fromBase64Url(encodedSignature).buffer as ArrayBuffer,
      new TextEncoder().encode(payload).buffer as ArrayBuffer,
    );
  } catch {
    return false;
  }
}

export function documentUploadsEnabled(runtime: LeadRuntime): boolean {
  return Boolean(
    runtime.DOCUMENT_UPLOADS_ENABLED === "true" &&
      runtime.DOCUMENT_UPLOAD_SIGNING_KEY &&
      telegramConfigLooksValid(runtime),
  );
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyTurnstile(
  token: string | null | undefined,
  secret: string | undefined,
  remoteIp: string,
): Promise<{ ok: boolean; configured: boolean }> {
  if (!secret) return { ok: true, configured: false };
  if (!token) return { ok: false, configured: true };
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, ...(remoteIp ? { remoteip: remoteIp } : {}) }),
    });
    if (!response.ok) return { ok: false, configured: true };
    const data = (await response.json()) as { success?: boolean };
    return { ok: data.success === true, configured: true };
  } catch {
    return { ok: false, configured: true };
  }
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function createLead(
  runtime: LeadRuntime,
  input: LeadInput,
  idempotencyKey: string,
  context: LeadRequestContext,
): Promise<CreatedLead> {
  if (!runtime.DB) throw new Error("LEAD_DATABASE_NOT_CONFIGURED");
  const phoneE164 = normalizeVietnamPhone(input.phone);
  if (!phoneE164) throw new Error("INVALID_VIETNAM_PHONE");
  const documentConsent = hasTelegramDocumentConsent(input);
  if (input.consentDocumentUpload && !documentConsent) {
    throw new Error("DOCUMENT_CONSENT_REQUIRED");
  }
  if (documentConsent && !documentUploadsEnabled(runtime)) {
    throw new Error("DOCUMENT_UPLOADS_NOT_ENABLED");
  }

  const existing = await runtime.DB
    .prepare(
      `SELECT l.lead_id, l.public_id, l.status,
              COALESCE(o.status, 'pending') AS notification_status,
              EXISTS(
                SELECT 1 FROM consent_records c
                WHERE c.lead_id = l.lead_id
                  AND c.consent_type = 'telegram_document'
                  AND c.granted = 1
                  AND c.revoked_at IS NULL
              ) AS document_consent
       FROM leads l
       LEFT JOIN notification_outbox o ON o.lead_id = l.lead_id
       WHERE l.idempotency_key = ?1`,
    )
    .bind(idempotencyKey)
    .first<{
      lead_id: string;
      public_id: string;
      status: CreatedLead["status"];
      notification_status: string;
      document_consent: number;
    }>();
  if (existing) {
    const documentsEnabled = documentUploadsEnabled(runtime);
    const uploadExpiry = Date.now() + 30 * 60 * 1000;
    return {
      leadId: existing.lead_id,
      publicId: existing.public_id,
      status: "new",
      duplicate: true,
      notificationQueued: ["pending", "processing", "sent"].includes(existing.notification_status),
      documentsEnabled,
      uploadTokens:
        documentConsent && documentsEnabled && existing.document_consent === 1 && runtime.DOCUMENT_UPLOAD_SIGNING_KEY
          ? {
              front: await createDocumentUploadToken(existing.lead_id, "front", uploadExpiry, runtime.DOCUMENT_UPLOAD_SIGNING_KEY),
              back: await createDocumentUploadToken(existing.lead_id, "back", uploadExpiry, runtime.DOCUMENT_UPLOAD_SIGNING_KEY),
              expiresAt: new Date(uploadExpiry).toISOString(),
            }
          : undefined,
    };
  }

  const leadId = uuid();
  const publicId = `lead_${uuid()}`;
  const now = new Date().toISOString();
  const phoneHash = await sha256(phoneE164);
  const ipHash = await sha256(context.ip || "unknown");
  const userAgentHash = await sha256(context.userAgent || "unknown");
  const notificationId = uuid();
  const notificationPayload = {
    notificationId,
    publicId,
    productId: input.productId ?? null,
    providerId: input.providerId ?? null,
    amountVnd: input.amountVnd ?? null,
    source: input.source,
    createdAt: now,
    documentStatus: "not-provided",
    staffPath: `/staff/requests/${encodeURIComponent(publicId)}`,
    staffUrl: runtime.PUBLIC_SITE_URL
      ? `${runtime.PUBLIC_SITE_URL.replace(/\/$/, "")}/staff/requests/${encodeURIComponent(publicId)}`
      : null,
  };

  await runtime.DB.batch([
    runtime.DB
      .prepare(
        `INSERT INTO leads
          (lead_id, public_id, full_name, phone_e164, province, product_id,
           provider_id, loan_type, amount_vnd, term_months, note, source,
           campaign, status, idempotency_key, phone_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)`,
      )
      .bind(
        leadId,
        publicId,
        input.fullName,
        phoneE164,
        input.province,
        input.productId ?? null,
        input.providerId ?? null,
        input.loanType ?? null,
        input.amountVnd ?? null,
        input.termMonths ?? null,
        input.note ?? null,
        input.source,
        input.campaign ?? null,
        idempotencyKey,
        phoneHash,
        now,
        now,
      ),
    runtime.DB
      .prepare(
      `INSERT INTO consent_records
          (consent_id, lead_id, consent_type, policy_version, granted,
           ip_hash, user_agent_hash, granted_at)
         VALUES (?, ?, 'contact', 'privacy-v2', 1, ?, ?, ?)`,
      )
      .bind(uuid(), leadId, ipHash, userAgentHash, now),
    runtime.DB
      .prepare(
      `INSERT INTO consent_records
          (consent_id, lead_id, consent_type, policy_version, granted,
           ip_hash, user_agent_hash, granted_at)
         VALUES (?, ?, 'processing_notice', 'privacy-v2', 1, ?, ?, ?)`,
      )
      .bind(uuid(), leadId, ipHash, userAgentHash, now),
    ...(documentConsent
      ? [
          runtime.DB
            .prepare(
              `INSERT INTO consent_records
                (consent_id, lead_id, consent_type, policy_version, granted,
                 ip_hash, user_agent_hash, granted_at)
               VALUES (?, ?, 'document_upload', 'privacy-v2', 1, ?, ?, ?)`,
            )
            .bind(uuid(), leadId, ipHash, userAgentHash, now),
          runtime.DB
            .prepare(
              `INSERT INTO consent_records
                (consent_id, lead_id, consent_type, policy_version, granted,
                 ip_hash, user_agent_hash, granted_at)
               VALUES (?, ?, 'telegram_document', 'privacy-v2', 1, ?, ?, ?)`,
            )
            .bind(uuid(), leadId, ipHash, userAgentHash, now),
        ]
      : []),
    runtime.DB
      .prepare(
        `INSERT INTO notification_outbox
          (notification_id, lead_id, channel, payload_json, idempotency_key,
           status, attempts, next_attempt_at)
         VALUES (?, ?, 'telegram', ?, ?, 'pending', 0, ?)`,
      )
      .bind(notificationId, leadId, JSON.stringify(notificationPayload), `telegram:${leadId}`, now),
    runtime.DB
      .prepare(
        `INSERT INTO audit_events
          (event_id, actor_type, actor_id_hash, action, entity_type, entity_id, metadata_json)
         VALUES (?, 'customer', ?, 'lead.created', 'lead', ?, ?)`,
      )
      .bind(uuid(), phoneHash, leadId, JSON.stringify({ source: input.source })),
  ]);

  let notificationQueued = false;
  if (runtime.LEAD_QUEUE) {
    try {
      await runtime.LEAD_QUEUE.send({ notificationId });
      notificationQueued = true;
    } catch (error) {
      console.error("[lead] queue send failed; outbox remains pending", error);
    }
  }

  const documentsEnabled = documentUploadsEnabled(runtime);
  const uploadExpiry = Date.now() + 30 * 60 * 1000;
  const uploadTokens = documentConsent && documentsEnabled && runtime.DOCUMENT_UPLOAD_SIGNING_KEY
    ? {
        front: await createDocumentUploadToken(leadId, "front", uploadExpiry, runtime.DOCUMENT_UPLOAD_SIGNING_KEY),
        back: await createDocumentUploadToken(leadId, "back", uploadExpiry, runtime.DOCUMENT_UPLOAD_SIGNING_KEY),
        expiresAt: new Date(uploadExpiry).toISOString(),
      }
    : undefined;

  return {
    leadId,
    publicId,
    status: "new",
    duplicate: false,
    notificationQueued,
    documentsEnabled,
    uploadTokens,
  };
}
