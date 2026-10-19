#!/usr/bin/env node

/*
 * Authenticated, no-admin-UI review helper.
 *
 * It talks to D1's account API with a short-lived/operator API token. The
 * command deliberately separates review approval from publication: a reviewer
 * must first approve a queue item, then explicitly publish the referenced
 * canonical entity. No crawler response can make a product public by itself.
 */

import { createHash, randomUUID } from "node:crypto";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
const ACTOR = process.env.CATALOG_REVIEW_ACTOR || "cli-reviewer";
const ACTOR_HASH = createHash("sha256").update(ACTOR).digest("hex");

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(ACCOUNT_ID)}/d1/database/${encodeURIComponent(DATABASE_ID)}/query`;

async function query(sql, params = []) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  const body = await response.json();
  if (!response.ok || body.success !== true) {
    throw new Error(body.errors?.map((error) => error.message).join("; ") || `D1 HTTP ${response.status}`);
  }
  return body.result?.[0]?.results ?? [];
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function usage() {
  console.log(`
D1 catalog review (không có Admin UI)

  node scripts/catalog-review.mjs approve --review-id <id>
  node scripts/catalog-review.mjs reject  --review-id <id>
  node scripts/catalog-review.mjs publish --review-id <id> --entity-type product|rate|promotion|banner|product_term|rate_history --entity-id <id>
  node scripts/catalog-review.mjs activate-provider --review-id <source-review-id> --provider-id <id>
  node scripts/catalog-review.mjs enable-source --source-id <id>

  publish chỉ nhận review_queue đã approved và status verified; mọi lệnh đều
  ghi audit_events. Không dùng script này để bỏ qua robots/terms.
`);
}

function requireCredentials() {
  if (!ACCOUNT_ID || !API_TOKEN || !DATABASE_ID) {
    throw new Error("Cần CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN và CLOUDFLARE_D1_DATABASE_ID.");
  }
}

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} phải là chuỗi không rỗng.`);
  return value.trim();
}

function nullableString(value, name) {
  if (value == null) return null;
  return requiredString(value, name);
}

function json(value, fallback = {}) {
  return JSON.stringify(value ?? fallback);
}

function httpsUrl(value, name) {
  const url = new URL(requiredString(value, name));
  if (url.protocol !== "https:") throw new Error(`${name} phải là HTTPS.`);
  return url.toString();
}

function sourceFields(entity, prefix) {
  return [
    httpsUrl(entity.sourceUrl, `${prefix}.sourceUrl`),
    requiredString(entity.sourceHash, `${prefix}.sourceHash`),
    nullableString(entity.sourceDocumentDate, `${prefix}.sourceDocumentDate`),
    requiredString(entity.observedAt, `${prefix}.observedAt`),
  ];
}

async function audit(action, entityType, entityId, metadata = {}) {
  await query(
    `INSERT INTO audit_events
       (event_id, actor_type, actor_id_hash, action, entity_type, entity_id, metadata_json)
     VALUES (?, 'github', ?, ?, ?, ?, ?)`,
    [randomUUID(), ACTOR_HASH, action, entityType, entityId, JSON.stringify(metadata)],
  );
}

async function review(command) {
  const reviewId = arg("--review-id");
  if (!reviewId || !["approve", "reject"].includes(command)) throw new Error("Thiếu --review-id hoặc command không hợp lệ.");
  const rows = await query(
    `SELECT review_id, entity_type, entity_id, status
     FROM review_queue WHERE review_id = ? LIMIT 1`,
    [reviewId],
  );
  const item = rows[0];
  if (!item) throw new Error("Không tìm thấy review item.");
  if (item.status !== "pending") throw new Error(`Review item đang ở trạng thái ${item.status}.`);
  const next = command === "approve" ? "approved" : "rejected";
  await query(
    `UPDATE review_queue
     SET status = ?, reviewed_by = ?, reviewed_at = datetime('now')
     WHERE review_id = ? AND status = 'pending'`,
    [next, ACTOR_HASH, reviewId],
  );
  await audit(`catalog.review.${next}`, item.entity_type, item.entity_id, { reviewId });
  console.log(`${next}: ${reviewId}`);
}

async function publish() {
  const reviewId = arg("--review-id");
  const entityType = arg("--entity-type");
  const entityId = arg("--entity-id");
  const tables = {
    product: "products",
    rate: "rate_terms",
    promotion: "promotions",
    banner: "banners",
  };
  const deferredTypes = new Set(["product_term", "rate_history"]);
  if (!reviewId || !entityType || !entityId || (!tables[entityType] && !deferredTypes.has(entityType))) throw new Error("publish cần --review-id, --entity-type và --entity-id hợp lệ.");
  const rows = await query(
    `SELECT entity_type, entity_id, status, payload_json
     FROM review_queue WHERE review_id = ? LIMIT 1`,
    [reviewId],
  );
  const item = rows[0];
  if (!item || item.status !== "approved" || item.entity_type !== entityType || item.entity_id !== entityId) {
    throw new Error("Review item chưa approved hoặc không khớp entity cần publish.");
  }
  if (entityType === "product_term") {
    const term = JSON.parse(item.payload_json).entity;
    const source = sourceFields(term, entityId);
    const termTypes = new Set(["amount", "term", "requirement", "fee", "other"]);
    if (!termTypes.has(term.termType)) throw new Error("product_term.termType không hợp lệ.");
    await query(
      `INSERT INTO product_terms
         (term_id, product_id, term_type, value_json, source_url,
          source_document_date, source_hash, status, observed_at, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'verified', ?, datetime('now'))`,
      [entityId, requiredString(term.productId, `${entityId}.productId`), term.termType, json(term.value), source[0], source[2], source[1], source[3]],
    );
  } else if (entityType === "rate_history") {
    const snapshot = JSON.parse(item.payload_json).entity;
    const source = sourceFields(snapshot, entityId);
    await query(
      `INSERT INTO rate_history
         (snapshot_id, product_id, rate_id, annual_rate_percent,
          monthly_rate_percent, rate_basis, observed_at, source_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [entityId, requiredString(snapshot.productId, `${entityId}.productId`), nullableString(snapshot.rateId, `${entityId}.rateId`), snapshot.annualRatePercent ?? null, snapshot.monthlyRatePercent ?? null, requiredString(snapshot.basis, `${entityId}.basis`), source[3], source[1]],
    );
  } else {
    const verifiedAt = entityType === "banner" ? "" : ", verified_at = datetime('now')";
    const idColumn = entityType === "product" ? "product_id" : entityType === "rate" ? "rate_id" : entityType === "promotion" ? "promotion_id" : "banner_id";
    await query(`UPDATE ${tables[entityType]} SET status = 'verified'${verifiedAt} WHERE ${idColumn} = ?`, [entityId]);
  }
  await audit("catalog.entity.verified", entityType, entityId, { reviewId });
  console.log(`verified: ${entityType}/${entityId}`);
}

async function activateProvider() {
  const reviewId = arg("--review-id");
  const providerId = arg("--provider-id");
  if (!reviewId || !providerId) throw new Error("activate-provider cần --review-id và --provider-id.");
  const rows = await query(
    `SELECT entity_type, entity_id, status
     FROM review_queue WHERE review_id = ? LIMIT 1`,
    [reviewId],
  );
  const item = rows[0];
  if (!item || item.status !== "approved" || item.entity_type !== "source" || item.entity_id !== `source:${providerId}`) {
    throw new Error("Source review chưa approved hoặc không khớp provider.");
  }
  const provider = await query("SELECT provider_id FROM providers WHERE provider_id = ? LIMIT 1", [providerId]);
  if (!provider[0]) throw new Error("Không tìm thấy provider.");
  await query("UPDATE providers SET status = 'active', verified_at = datetime('now'), updated_at = datetime('now') WHERE provider_id = ?", [providerId]);
  await audit("catalog.provider.activated", "provider", providerId, { reviewId });
  console.log(`active: ${providerId}`);
}

async function enableSource() {
  const sourceId = arg("--source-id");
  if (!sourceId) throw new Error("enable-source cần --source-id.");
  const rows = await query("SELECT source_id, robots_status, terms_status FROM data_sources WHERE source_id = ? LIMIT 1", [sourceId]);
  const source = rows[0];
  if (!source) throw new Error("Không tìm thấy source.");
  if (source.robots_status !== "allowed" || source.terms_status !== "allowed") {
    throw new Error("Chỉ bật crawl khi robots_status và terms_status đều allowed.");
  }
  await query("UPDATE data_sources SET crawl_enabled = 1 WHERE source_id = ?", [sourceId]);
  await audit("catalog.source.enabled", "source", sourceId);
  console.log(`crawl_enabled: ${sourceId}`);
}

const command = process.argv[2];
try {
  if (!command || command === "--help" || command === "-h") usage();
  else {
    requireCredentials();
    if (command === "approve" || command === "reject") await review(command);
    else if (command === "publish") await publish();
    else if (command === "activate-provider") await activateProvider();
    else if (command === "enable-source") await enableSource();
    else throw new Error(`Command không hợp lệ: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
