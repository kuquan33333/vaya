#!/usr/bin/env node

/*
 * Import a source-backed JSON batch into D1 as quarantine records.
 *
 * This command is intentionally incapable of publishing data. A reviewer must
 * inspect the source, approve the generated review item, and run
 * catalog-review.mjs publish explicitly. It is suitable for legally supplied
 * HTML/PDF/manual extraction batches without adding an Admin UI.
 */

import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
const ACTOR = process.env.CATALOG_IMPORT_ACTOR || "catalog-import";
const ACTOR_HASH = createHash("sha256").update(ACTOR).digest("hex");
const endpoint = ACCOUNT_ID && DATABASE_ID
  ? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(ACCOUNT_ID)}/d1/database/${encodeURIComponent(DATABASE_ID)}/query`
  : null;

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function usage() {
  console.log(`
Nhập batch catalog vào D1 ở trạng thái quarantine (không publish):

  CATALOG_IMPORT_ACTOR=ops npm run catalog:import -- --file ./batch.json

JSON có thể có các mảng: providers, products, rates, promotions, banners,
productTerms, rateHistory. Mỗi product/rate/promotion/banner phải có sourceUrl,
sourceHash, observedAt và dữ liệu phù hợp schema. Trạng thái import luôn là
quarantine; dùng catalog-review.mjs để approve rồi publish.
`);
}

function requireCredentials() {
  if (!ACCOUNT_ID || !API_TOKEN || !DATABASE_ID || !endpoint) {
    throw new Error("Cần CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN và CLOUDFLARE_D1_DATABASE_ID.");
  }
}

async function query(sql, params = []) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const body = await response.json();
  if (!response.ok || body.success !== true) {
    throw new Error(body.errors?.map((error) => error.message).join("; ") || `D1 HTTP ${response.status}`);
  }
  return body.result?.[0]?.results ?? [];
}

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} phải là chuỗi không rỗng.`);
  return value.trim();
}

function nullableString(value, name) {
  if (value == null) return null;
  return requiredString(value, name);
}

function localized(value, name) {
  if (typeof value === "string" && value.trim()) return [value.trim(), value.trim(), value.trim()];
  if (!value || typeof value !== "object") throw new Error(`${name} cần chuỗi hoặc object vi/en/zh.`);
  return [requiredString(value.vi, `${name}.vi`), requiredString(value.en ?? value.vi, `${name}.en`), requiredString(value.zh ?? value.vi, `${name}.zh` )];
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

async function ensureNotVerified(table, idColumn, id, label) {
  const rows = await query(`SELECT status FROM ${table} WHERE ${idColumn} = ? LIMIT 1`, [id]);
  if (rows[0]?.status === "verified") throw new Error(`${label} đã verified; tạo revision ID mới thay vì ghi đè.`);
}

async function addReview(entityType, entityId, payload, reason, batchId) {
  const reviewId = randomUUID();
  await query(
    `INSERT INTO review_queue
       (review_id, entity_type, entity_id, reason, payload_json, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [reviewId, entityType, entityId, reason, json({ batchId, entity: payload })],
  );
  return reviewId;
}

async function importProvider(provider) {
  const id = requiredString(provider.providerId, "provider.providerId");
  const names = localized(provider.displayName, `${id}.displayName`);
  const officialUrl = httpsUrl(provider.officialUrl, `${id}.officialUrl`);
  const sourceUrl = httpsUrl(provider.sourceUrl ?? provider.officialUrl, `${id}.sourceUrl`);
  const lenderType = provider.lenderType === "consumer-finance" ? "consumer-finance" : provider.lenderType === "bank" ? "bank" : null;
  if (!lenderType) throw new Error(`${id}.lenderType không hợp lệ.`);
  await query(
    `INSERT INTO providers
       (provider_id, provider_slug, legal_name, display_name_vi, display_name_en,
        display_name_zh, lender_type, official_url, status, source_url, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification', ?, ?)
     ON CONFLICT(provider_id) DO UPDATE SET
       provider_slug = excluded.provider_slug,
       legal_name = excluded.legal_name,
       display_name_vi = excluded.display_name_vi,
       display_name_en = excluded.display_name_en,
       display_name_zh = excluded.display_name_zh,
       official_url = excluded.official_url,
       source_url = excluded.source_url,
       notes = excluded.notes,
       updated_at = datetime('now')`,
    [id, requiredString(provider.providerSlug ?? id, `${id}.providerSlug`), requiredString(provider.legalName, `${id}.legalName`), names[0], names[1], names[2], lenderType, officialUrl, sourceUrl, nullableString(provider.notes, `${id}.notes`)],
  );
  await query(
    `INSERT OR IGNORE INTO data_sources
       (source_id, provider_id, source_url, source_type, robots_status,
        terms_status, crawl_enabled, user_agent, notes)
     VALUES (?, ?, ?, ?, 'unknown', 'unknown', 0, ?, ?)`,
    [`source:${id}`, id, sourceUrl, provider.sourceType === "json" ? "json" : provider.sourceType === "manual" ? "manual" : "html", "vaytiendanang-data-bot/1.0 (+contact configured out of band)", "Imported source remains disabled until robots and terms are reviewed."],
  );
}

async function importProduct(product, batchId) {
  const id = requiredString(product.productId, "product.productId");
  await ensureNotVerified("products", "product_id", id, "Product");
  const names = localized(product.productName, `${id}.productName`);
  const source = sourceFields(product, id);
  const lenderType = product.lenderType === "consumer-finance" ? "consumer-finance" : product.lenderType === "bank" ? "bank" : null;
  if (!lenderType) throw new Error(`${id}.lenderType không hợp lệ.`);
  const status = "quarantine";
  await query(
    `INSERT INTO products
       (product_id, stable_slug, provider_id, lender_type, product_name_vi,
        product_name_en, product_name_zh, category, purpose_code, min_amount_vnd,
        max_amount_vnd, min_term_months, max_term_months, requirements_json,
        source_url, source_document_date, source_hash, status, confidence,
        review_flags_json, observed_at, verified_at, legacy_ids_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
     ON CONFLICT(product_id) DO UPDATE SET
       stable_slug = excluded.stable_slug,
       product_name_vi = excluded.product_name_vi,
       product_name_en = excluded.product_name_en,
       product_name_zh = excluded.product_name_zh,
       category = excluded.category,
       purpose_code = excluded.purpose_code,
       min_amount_vnd = excluded.min_amount_vnd,
       max_amount_vnd = excluded.max_amount_vnd,
       min_term_months = excluded.min_term_months,
       max_term_months = excluded.max_term_months,
       requirements_json = excluded.requirements_json,
       source_url = excluded.source_url,
       source_document_date = excluded.source_document_date,
       source_hash = excluded.source_hash,
       status = 'quarantine',
       confidence = excluded.confidence,
       review_flags_json = excluded.review_flags_json,
       observed_at = excluded.observed_at,
       legacy_ids_json = excluded.legacy_ids_json,
       updated_at = datetime('now')`,
    [id, requiredString(product.stableSlug, `${id}.stableSlug`), requiredString(product.providerId, `${id}.providerId`), lenderType, names[0], names[1], names[2], requiredString(product.category, `${id}.category`), requiredString(product.purposeCode, `${id}.purposeCode`), product.minAmountVnd ?? null, product.maxAmountVnd ?? null, product.minTermMonths ?? null, product.maxTermMonths ?? null, json(product.requirements, []), source[0], source[2], source[1], status, product.confidence === "high" || product.confidence === "medium" ? product.confidence : "low", json(["imported-quarantine"]), source[3], json(product.legacyIds, [])],
  );
  return addReview("product", id, product, "manual_import_requires_source_review", batchId);
}

async function importRate(rate, batchId) {
  const id = requiredString(rate.rateId, "rate.rateId");
  await ensureNotVerified("rate_terms", "rate_id", id, "Rate");
  const source = sourceFields(rate, id);
  const basis = requiredString(rate.basis, `${id}.basis`);
  const rateType = requiredString(rate.rateType, `${id}.rateType`);
  await query(
    `INSERT INTO rate_terms
       (rate_id, product_id, rate_type, rate_basis, annual_rate_percent,
        monthly_rate_percent, promo_months, post_promo_annual_rate_percent,
        post_promo_monthly_rate_percent, post_promo_basis, valid_from, valid_to,
        observed_at, verified_at, source_document_date, source_hash, status,
        confidence, review_flags_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'quarantine', ?, ?)
     ON CONFLICT(rate_id) DO UPDATE SET
       product_id = excluded.product_id,
       rate_type = excluded.rate_type,
       rate_basis = excluded.rate_basis,
       annual_rate_percent = excluded.annual_rate_percent,
       monthly_rate_percent = excluded.monthly_rate_percent,
       promo_months = excluded.promo_months,
       post_promo_annual_rate_percent = excluded.post_promo_annual_rate_percent,
       post_promo_monthly_rate_percent = excluded.post_promo_monthly_rate_percent,
       post_promo_basis = excluded.post_promo_basis,
       valid_from = excluded.valid_from,
       valid_to = excluded.valid_to,
       observed_at = excluded.observed_at,
       source_document_date = excluded.source_document_date,
       source_hash = excluded.source_hash,
       status = 'quarantine',
       confidence = excluded.confidence,
       review_flags_json = excluded.review_flags_json`,
    [id, requiredString(rate.productId, `${id}.productId`), rateType, basis, rate.annualRatePercent ?? null, rate.monthlyRatePercent ?? null, rate.promoMonths ?? 0, rate.postPromoAnnualRatePercent ?? null, rate.postPromoMonthlyRatePercent ?? null, rate.postPromoBasis ?? null, nullableString(rate.validFrom, `${id}.validFrom`), nullableString(rate.validTo, `${id}.validTo`), source[3], source[2], source[1], rate.confidence === "high" || rate.confidence === "medium" ? rate.confidence : "low", json(["imported-quarantine"])],
  );
  return addReview("rate", id, rate, "manual_import_requires_rate_basis_review", batchId);
}

async function importPromotion(promotion, batchId) {
  const id = requiredString(promotion.promotionId, "promotion.promotionId");
  await ensureNotVerified("promotions", "promotion_id", id, "Promotion");
  const names = localized(promotion.title, `${id}.title`);
  const source = sourceFields(promotion, id);
  await query(
    `INSERT INTO promotions
       (promotion_id, product_id, title_vi, title_en, title_zh, valid_from,
        valid_to, terms_json, source_url, source_document_date, source_hash,
        status, confidence, observed_at, verified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'quarantine', ?, ?, NULL)
     ON CONFLICT(promotion_id) DO UPDATE SET
       product_id = excluded.product_id,
       title_vi = excluded.title_vi,
       title_en = excluded.title_en,
       title_zh = excluded.title_zh,
       valid_from = excluded.valid_from,
       valid_to = excluded.valid_to,
       terms_json = excluded.terms_json,
       source_url = excluded.source_url,
       source_document_date = excluded.source_document_date,
       source_hash = excluded.source_hash,
       status = 'quarantine',
       confidence = excluded.confidence,
       observed_at = excluded.observed_at`,
    [id, requiredString(promotion.productId, `${id}.productId`), names[0], names[1], names[2], nullableString(promotion.validFrom, `${id}.validFrom`), nullableString(promotion.validTo, `${id}.validTo`), json(promotion.terms), source[0], source[2], source[1], promotion.confidence === "high" || promotion.confidence === "medium" ? promotion.confidence : "low", source[3]],
  );
  return addReview("promotion", id, promotion, "manual_import_requires_promotion_review", batchId);
}

async function importBanner(banner, batchId) {
  const id = requiredString(banner.bannerId, "banner.bannerId");
  await ensureNotVerified("banners", "banner_id", id, "Banner");
  const title = localized(banner.title, `${id}.title`);
  const body = localized(banner.body, `${id}.body`);
  await query(
    `INSERT INTO banners
       (banner_id, promotion_id, title_vi, title_en, title_zh, body_vi, body_en,
        body_zh, image_object_key, cta_label_vi, cta_label_en, cta_label_zh,
        valid_from, valid_to, status, source_url, source_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 'quarantine', ?, ?)
     ON CONFLICT(banner_id) DO UPDATE SET
       promotion_id = excluded.promotion_id,
       title_vi = excluded.title_vi,
       title_en = excluded.title_en,
       title_zh = excluded.title_zh,
       body_vi = excluded.body_vi,
       body_en = excluded.body_en,
       body_zh = excluded.body_zh,
       cta_label_vi = excluded.cta_label_vi,
       cta_label_en = excluded.cta_label_en,
       cta_label_zh = excluded.cta_label_zh,
       valid_from = excluded.valid_from,
       valid_to = excluded.valid_to,
       status = 'quarantine',
       source_url = excluded.source_url,
       source_hash = excluded.source_hash`,
    [id, nullableString(banner.promotionId, `${id}.promotionId`), title[0], title[1], title[2], body[0], body[1], body[2], requiredString(banner.ctaLabel?.vi ?? "Đăng ký vay ngay", `${id}.ctaLabel.vi`), requiredString(banner.ctaLabel?.en ?? banner.ctaLabel?.vi ?? "Apply for advice", `${id}.ctaLabel.en`), requiredString(banner.ctaLabel?.zh ?? banner.ctaLabel?.vi ?? "立即登记咨询", `${id}.ctaLabel.zh`), nullableString(banner.validFrom, `${id}.validFrom`), nullableString(banner.validTo, `${id}.validTo`), httpsUrl(banner.sourceUrl, `${id}.sourceUrl`), requiredString(banner.sourceHash, `${id}.sourceHash`)],
  );
  return addReview("banner", id, banner, "manual_import_requires_banner_review", batchId);
}

async function importTerms(term, batchId) {
  const id = requiredString(term.termId ?? randomUUID(), "term.termId");
  const termTypes = new Set(["amount", "term", "requirement", "fee", "other"]);
  if (!termTypes.has(term.termType)) throw new Error(`${id}.termType không hợp lệ.`);
  return addReview("product_term", id, term, "manual_import_requires_term_review", batchId);
}

async function importHistory(snapshot, batchId) {
  const id = requiredString(snapshot.snapshotId ?? randomUUID(), "snapshot.snapshotId");
  return addReview("rate_history", id, snapshot, "manual_import_requires_history_review", batchId);
}

const command = process.argv[2];
try {
  if (!command || command === "--help" || command === "-h" || process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
  } else if (command !== "import") {
    throw new Error("Dùng command import hoặc --help.");
  } else {
    requireCredentials();
    const file = arg("--file");
    if (!file) throw new Error("Thiếu --file <batch.json>.");
    const input = JSON.parse(await readFile(file, "utf8"));
    const batchId = input.batchId || randomUUID();
    for (const provider of input.providers ?? []) await importProvider(provider);
    const reviewIds = [];
    for (const product of input.products ?? []) reviewIds.push(await importProduct(product, batchId));
    for (const rate of input.rates ?? []) reviewIds.push(await importRate(rate, batchId));
    for (const promotion of input.promotions ?? []) reviewIds.push(await importPromotion(promotion, batchId));
    for (const banner of input.banners ?? []) reviewIds.push(await importBanner(banner, batchId));
    for (const term of input.productTerms ?? []) reviewIds.push(await importTerms(term, batchId));
    for (const snapshot of input.rateHistory ?? []) reviewIds.push(await importHistory(snapshot, batchId));
    await query(
      `INSERT INTO audit_events
         (event_id, actor_type, actor_id_hash, action, entity_type, entity_id, metadata_json)
       VALUES (?, 'github', ?, 'catalog.batch.imported', 'catalog_batch', ?, ?)`,
      [randomUUID(), ACTOR_HASH, batchId, json({ reviewCount: reviewIds.length })],
    );
    console.log(JSON.stringify({ batchId, reviewIds }, null, 2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
