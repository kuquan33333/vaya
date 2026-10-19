import type { D1Database, MessageBatch, Queue, R2Bucket } from "@cloudflare/workers-types";
import { fetchSource, type CrawlSource } from "./crawler";

interface IngestorEnv {
  DB: D1Database;
  LEAD_DOCUMENTS?: R2Bucket;
  LEAD_QUEUE: Queue<QueueMessage>;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  PUBLIC_SITE_URL?: string;
  CRAWLER_TRIGGER_TOKEN?: string;
}

type QueueMessage = { notificationId?: string; crawlAlertId?: string };

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface OutboxRow {
  notification_id: string;
  lead_id: string;
  payload_json: string;
  status: "pending" | "processing" | "sent" | "failed" | "dead_letter";
  attempts: number;
}

interface CrawlAlertRow {
  alert_id: string;
  payload_json: string;
  status: "pending" | "processing" | "sent" | "failed" | "dead_letter";
  attempts: number;
}

function uuid(): string {
  return crypto.randomUUID();
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

async function runCrawler(env: IngestorEnv, triggerType: "cron" | "manual" = "cron"): Promise<void> {
  const runId = uuid();
  const startedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO crawl_runs
       (run_id, started_at, trigger_type, status, source_count, update_count, failure_count)
     VALUES (?, ?, ?, 'running', 0, 0, 0)`,
  ).bind(runId, startedAt, triggerType).run();

  const sourceResult = await env.DB.prepare(
    `SELECT ds.source_id, ds.provider_id, ds.source_url, ds.source_type,
            ds.robots_status, ds.terms_status, ds.crawl_enabled, ds.user_agent,
            co.etag, co.last_modified, co.content_hash AS previous_content_hash
     FROM data_sources ds
     LEFT JOIN crawl_observations co ON co.observation_id = (
       SELECT observation_id FROM crawl_observations latest
       WHERE latest.source_id = ds.source_id
       ORDER BY fetched_at DESC LIMIT 1
     )
     WHERE ds.crawl_enabled = 1
       AND ds.robots_status = 'allowed'
       AND ds.terms_status = 'allowed'
     ORDER BY ds.source_id`,
  ).all<CrawlSource>();
  const sources = sourceResult.results;
  let updates = 0;
  let failures = 0;
  for (const source of sources) {
    const observation = await fetchSource(source);
    const observationId = uuid();
    const fetchedAt = new Date().toISOString();
    const extractedJson = json({
      providerId: source.provider_id,
      sourceUrl: source.source_url,
      ...observation.extracted,
    });
    const changed = observation.contentHash == null || observation.contentHash !== source.previous_content_hash;
    const statements = [
      env.DB.prepare(
        `INSERT INTO crawl_observations
           (observation_id, run_id, source_id, fetched_at, http_status, etag,
            last_modified, content_hash, parser_version, extracted_json,
            validation_status, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        observationId,
        runId,
        source.source_id,
        fetchedAt,
        observation.httpStatus,
        observation.etag,
        observation.lastModified,
        observation.contentHash,
        observation.parserVersion,
        extractedJson,
        observation.validationStatus,
        observation.errorMessage,
      ),
      ...(changed && (observation.validationStatus === "valid" || observation.validationStatus === "anomaly")
        ? [
            env.DB.prepare(
              `INSERT INTO review_queue
                 (review_id, observation_id, entity_type, entity_id, reason, payload_json, status)
               VALUES (?, ?, 'source', ?, ?, ?, 'pending')`,
            ).bind(
              uuid(),
              observationId,
              source.source_id,
              observation.validationStatus === "anomaly" ? "rate_signal_requires_human_review" : "new_source_observation",
              extractedJson,
            ),
            env.DB.prepare(
              `INSERT INTO crawl_alert_outbox
                 (alert_id, run_id, source_id, payload_json)
               VALUES (?, ?, ?, ?)`,
            ).bind(
              uuid(),
              runId,
              source.source_id,
              json({
                sourceId: source.source_id,
                providerId: source.provider_id,
                sourceUrl: source.source_url,
                validationStatus: observation.validationStatus,
                reason: observation.errorMessage ?? "new_source_observation",
                observedAt: fetchedAt,
              }),
            ),
          ]
        : []),
    ];
    await env.DB.batch(statements);
    if (["valid", "anomaly", "stale"].includes(observation.validationStatus)) updates += 1;
    else failures += 1;
  }
  const status = failures === 0 ? "succeeded" : updates > 0 ? "partial" : "failed";
  await env.DB.prepare(
    `UPDATE crawl_runs
     SET finished_at = ?, status = ?, source_count = ?, update_count = ?, failure_count = ?
     WHERE run_id = ?`,
  ).bind(new Date().toISOString(), status, sources.length, updates, failures, runId).run();
}

async function sendTelegram(env: IngestorEnv, payload: Record<string, unknown>): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) throw new Error("telegram_not_configured");
  // The payload is deliberately a restricted outbox shape created by the lead
  // API. Do not add customer name, phone, notes, documents or raw request data.
  const text = [
    "🔔 Vaytiendanang có yêu cầu tư vấn mới",
    `Mã: ${String(payload.publicId ?? "unknown")}`,
    `Nguồn: ${String(payload.source ?? "organic")}`,
    payload.providerId ? `Nhà cung cấp: ${String(payload.providerId)}` : null,
    payload.productId ? `Sản phẩm: ${String(payload.productId)}` : null,
    typeof payload.amountVnd === "number" ? `Số tiền: ${payload.amountVnd.toLocaleString("vi-VN")} VND` : null,
    payload.staffUrl ? `Hồ sơ nội bộ: ${String(payload.staffUrl)}` : null,
    "Thông tin liên hệ nằm trong D1 và chỉ nhân sự được cấp quyền truy cập.",
  ].filter(Boolean).join("\n");
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(env.TELEGRAM_BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error(`telegram_http_${response.status}`);
  const result = (await response.json()) as { ok?: boolean };
  if (result.ok !== true) throw new Error("telegram_rejected");
}

async function sendCrawlAlert(env: IngestorEnv, payload: Record<string, unknown>): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) throw new Error("telegram_not_configured");
  const text = [
    "⚠️ Vaytiendanang cần kiểm chứng nguồn dữ liệu",
    `Provider: ${String(payload.providerId ?? "unknown")}`,
    `Source: ${String(payload.sourceId ?? "unknown")}`,
    `URL: ${String(payload.sourceUrl ?? "unknown")}`,
    `Trạng thái: ${String(payload.validationStatus ?? "unknown")}`,
    `Lý do: ${String(payload.reason ?? "review_required")}`,
    `Quan sát: ${String(payload.observedAt ?? "unknown")}`,
    "Chưa có dữ liệu nào được tự động publish vào catalog.",
  ].join("\n");
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(env.TELEGRAM_BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error(`telegram_http_${response.status}`);
  const result = (await response.json()) as { ok?: boolean };
  if (result.ok !== true) throw new Error("telegram_rejected");
}

async function processNotification(env: IngestorEnv, notificationId: string): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT notification_id, lead_id, payload_json, status, attempts
     FROM notification_outbox
     WHERE notification_id = ?1 AND status IN ('pending', 'failed')`,
  ).bind(notificationId).first<OutboxRow>();
  if (!row) return;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE notification_outbox SET status = 'processing', attempts = attempts + 1 WHERE notification_id = ?1`,
  ).bind(notificationId).run();
  try {
    await sendTelegram(env, JSON.parse(row.payload_json) as Record<string, unknown>);
    await env.DB.prepare(
      `UPDATE notification_outbox SET status = 'sent', sent_at = ?, last_error = NULL WHERE notification_id = ?1`,
    ).bind(now, notificationId).run();
  } catch (error) {
    const nextStatus = row.attempts + 1 >= 5 ? "dead_letter" : "failed";
    await env.DB.prepare(
      `UPDATE notification_outbox
       SET status = ?, last_error = ?, next_attempt_at = datetime('now', '+15 minutes')
       WHERE notification_id = ?1`,
    ).bind(nextStatus, error instanceof Error ? error.message.slice(0, 200) : "notification_failed", notificationId).run();
  }
}

async function drainOutbox(env: IngestorEnv): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT notification_id FROM notification_outbox
     WHERE status IN ('pending', 'failed') AND next_attempt_at <= datetime('now')
     ORDER BY created_at LIMIT 20`,
  ).all<{ notification_id: string }>();
  for (const row of rows.results) await processNotification(env, row.notification_id);
}

async function processCrawlAlert(env: IngestorEnv, alertId: string): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT alert_id, payload_json, status, attempts
     FROM crawl_alert_outbox
     WHERE alert_id = ?1 AND status IN ('pending', 'failed')`,
  ).bind(alertId).first<CrawlAlertRow>();
  if (!row) return;
  await env.DB.prepare(
    `UPDATE crawl_alert_outbox SET status = 'processing', attempts = attempts + 1 WHERE alert_id = ?1`,
  ).bind(alertId).run();
  try {
    await sendCrawlAlert(env, JSON.parse(row.payload_json) as Record<string, unknown>);
    await env.DB.prepare(
      `UPDATE crawl_alert_outbox SET status = 'sent', sent_at = datetime('now'), last_error = NULL WHERE alert_id = ?1`,
    ).bind(alertId).run();
  } catch (error) {
    const nextStatus = row.attempts + 1 >= 5 ? "dead_letter" : "failed";
    await env.DB.prepare(
      `UPDATE crawl_alert_outbox
       SET status = ?, last_error = ?, next_attempt_at = datetime('now', '+15 minutes')
       WHERE alert_id = ?1`,
    ).bind(nextStatus, error instanceof Error ? error.message.slice(0, 200) : "crawl_alert_failed", alertId).run();
  }
}

async function drainCrawlAlerts(env: IngestorEnv): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT alert_id FROM crawl_alert_outbox
     WHERE status IN ('pending', 'failed') AND next_attempt_at <= datetime('now')
     ORDER BY created_at LIMIT 20`,
  ).all<{ alert_id: string }>();
  for (const row of rows.results) await processCrawlAlert(env, row.alert_id);
}

async function purgeExpiredDocuments(env: IngestorEnv): Promise<void> {
  if (!env.LEAD_DOCUMENTS) return;
  const expired = await env.DB.prepare(
    `SELECT document_id, object_key FROM lead_documents
     WHERE status IN ('authorized', 'uploaded', 'quarantined')
       AND expires_at IS NOT NULL AND expires_at <= datetime('now')
     LIMIT 100`,
  ).all<{ document_id: string; object_key: string }>();
  for (const document of expired.results) {
    await env.LEAD_DOCUMENTS.delete(document.object_key);
    await env.DB.prepare(
      `UPDATE lead_documents SET status = 'deleted', deleted_at = datetime('now')
       WHERE document_id = ?1`,
    ).bind(document.document_id).run();
  }
}

const worker = {
  async scheduled(_event: unknown, env: IngestorEnv, ctx: WorkerExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        await runCrawler(env);
        await drainOutbox(env);
        await drainCrawlAlerts(env);
        await purgeExpiredDocuments(env);
      })(),
    );
  },

  async queue(batch: MessageBatch<QueueMessage>, env: IngestorEnv, _ctx: WorkerExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      if (message.body.notificationId) await processNotification(env, message.body.notificationId);
      if (message.body.crawlAlertId) await processCrawlAlert(env, message.body.crawlAlertId);
    }
  },

  async fetch(request: Request, env: IngestorEnv, ctx: WorkerExecutionContext): Promise<Response> {
    if (new URL(request.url).pathname === "/internal/crawl" && request.method === "POST") {
      const expected = env.CRAWLER_TRIGGER_TOKEN;
      const supplied = request.headers.get("authorization");
      if (!expected || supplied !== `Bearer ${expected}`) return new Response("Forbidden", { status: 403 });
      ctx.waitUntil(runCrawler(env, "manual"));
      return new Response(JSON.stringify({ accepted: true }), { status: 202, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    return new Response("vaytiendanang ingestor", { status: 200 });
  },
};

export default worker;
