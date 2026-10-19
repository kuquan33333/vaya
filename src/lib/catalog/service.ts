import { LOCAL_CATALOG, LOCAL_PROVIDER_REGISTRY } from "./legacyCatalog";
import type { CatalogBanner, CatalogFees, CatalogProduct, CatalogProvider, CatalogRateSnapshot, CatalogSnapshot, LocalizedString } from "./types";
import { isPubliclyRankableProduct } from "./rateSelection";

interface CatalogDb {
  prepare(query: string): {
    bind(...values: unknown[]): {
      all<T>(): Promise<{ results: T[] }>;
    };
    all<T>(): Promise<{ results: T[] }>;
  };
}

interface ProductRow {
  product_id: string;
  stable_slug: string;
  provider_id: string;
  lender_type: CatalogProduct["lenderType"];
  product_name_vi: string;
  product_name_en: string;
  product_name_zh: string;
  category: CatalogProduct["category"];
  purpose_code: string;
  min_amount_vnd: number | null;
  max_amount_vnd: number | null;
  min_term_months: number | null;
  max_term_months: number | null;
  requirements_json: string;
  source_url: string;
  source_document_date: string | null;
  source_hash: string | null;
  status: CatalogProduct["status"];
  confidence: CatalogProduct["confidence"];
  review_flags_json: string;
  observed_at: string | null;
  verified_at: string | null;
  provider_name_vi: string;
  provider_name_en: string;
  provider_name_zh: string;
  legacy_ids_json: string;
}

interface RateRow {
  rate_id: string;
  rate_type: CatalogProduct["rateTerms"][number]["rateType"];
  rate_basis: CatalogProduct["rateTerms"][number]["basis"];
  annual_rate_percent: number | null;
  monthly_rate_percent: number | null;
  promo_months: number | null;
  post_promo_annual_rate_percent: number | null;
  post_promo_monthly_rate_percent: number | null;
  post_promo_basis: CatalogProduct["rateTerms"][number]["basis"] | null;
  valid_from: string | null;
  valid_to: string | null;
  observed_at: string | null;
  verified_at: string | null;
  source_document_date: string | null;
  source_hash: string | null;
  status: CatalogProduct["rateTerms"][number]["status"];
  confidence: CatalogProduct["rateTerms"][number]["confidence"];
  review_flags_json: string;
}

interface PromotionRow {
  promotion_id: string;
  title_vi: string;
  title_en: string;
  title_zh: string;
  valid_from: string | null;
  valid_to: string | null;
  status: CatalogProduct["status"];
}

interface ProductTermRow {
  term_type: "amount" | "term" | "requirement" | "fee" | "other";
  value_json: string;
  status: CatalogProduct["status"];
}

interface RateHistoryRow {
  snapshot_id: string;
  rate_id: string | null;
  annual_rate_percent: number | null;
  monthly_rate_percent: number | null;
  rate_basis: CatalogProduct["rateTerms"][number]["basis"];
  observed_at: string;
  source_hash: string;
}

interface ProviderRow {
  provider_id: string;
  provider_slug: string;
  legal_name: string;
  display_name_vi: string;
  display_name_en: string;
  display_name_zh: string;
  lender_type: CatalogProvider["lenderType"];
  official_url: string;
  status: CatalogProvider["status"];
  source_url: string;
  observed_at: string | null;
  verified_at: string | null;
  notes: string | null;
}

interface BannerRow {
  banner_id: string;
  promotion_id: string | null;
  title_vi: string;
  title_en: string;
  title_zh: string;
  body_vi: string;
  body_en: string;
  body_zh: string;
  image_object_key: string | null;
  cta_label_vi: string;
  cta_label_en: string;
  cta_label_zh: string;
  valid_from: string | null;
  valid_to: string | null;
  status: CatalogBanner["status"];
}

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

function rowToProduct(
  row: ProductRow,
  rateTerms: CatalogProduct["rateTerms"],
  promotion: CatalogProduct["promotion"],
  rateHistory: CatalogRateSnapshot[],
  requirements: LocalizedString[],
  fees: CatalogFees,
): CatalogProduct {
  return {
    productId: row.product_id,
    stableSlug: row.stable_slug,
    providerId: row.provider_id,
    providerName: {
      vi: row.provider_name_vi,
      en: row.provider_name_en,
      zh: row.provider_name_zh,
    },
    lenderType: row.lender_type,
    productName: {
      vi: row.product_name_vi,
      en: row.product_name_en,
      zh: row.product_name_zh,
    },
    category: row.category,
    purposeCode: row.purpose_code,
    minAmountVnd: row.min_amount_vnd,
    maxAmountVnd: row.max_amount_vnd,
    minTermMonths: row.min_term_months,
    maxTermMonths: row.max_term_months,
    requirements,
    rateTerms,
    rateHistory,
    fees,
    promotion,
    sourceUrl: row.source_url,
    sourceDocumentDate: row.source_document_date,
    sourceHash: row.source_hash,
    status: row.status,
    confidence: row.confidence,
    reviewFlags: parseJson(row.review_flags_json, []),
    observedAt: row.observed_at,
    verifiedAt: row.verified_at,
    legacyIds: parseJson(row.legacy_ids_json, []),
  };
}

export function isPubliclyRankable(product: CatalogProduct): boolean {
  return isPubliclyRankableProduct(product);
}

export function publicProducts(products: CatalogProduct[]): CatalogProduct[] {
  return products.filter(isPubliclyRankable);
}

export async function loadCatalog(db?: CatalogDb): Promise<CatalogSnapshot> {
  if (!db) {
    return {
      version: "local-sample-v1",
      fetchedAt: new Date().toISOString(),
      products: LOCAL_CATALOG,
      providers: LOCAL_PROVIDER_REGISTRY,
      banners: [],
      isFallback: true,
    };
  }

  try {
    const [rows, providerRows, bannerRows] = await Promise.all([
      db.prepare(
        `SELECT p.product_id, p.stable_slug, p.provider_id, p.lender_type,
                p.product_name_vi, p.product_name_en, p.product_name_zh,
                p.category, p.purpose_code, p.min_amount_vnd,
                p.max_amount_vnd, p.min_term_months, p.max_term_months,
                p.requirements_json, p.source_url, p.source_document_date,
                p.source_hash, p.status, p.confidence, p.review_flags_json,
                p.observed_at, p.verified_at,
                pr.display_name_vi AS provider_name_vi,
                pr.display_name_en AS provider_name_en,
                pr.display_name_zh AS provider_name_zh,
                p.legacy_ids_json
         FROM products p
         JOIN providers pr ON pr.provider_id = p.provider_id
         WHERE p.status = 'verified' AND pr.status = 'active'
         ORDER BY pr.display_name_vi, p.product_name_vi`,
      ).all<ProductRow>(),
      db.prepare(
        `SELECT provider_id, provider_slug, legal_name,
                display_name_vi, display_name_en, display_name_zh,
                lender_type, official_url, status, source_url,
                observed_at, verified_at, notes
         FROM providers
         ORDER BY display_name_vi`,
      ).all<ProviderRow>(),
      db.prepare(
        `SELECT banner_id, promotion_id, title_vi, title_en, title_zh,
                body_vi, body_en, body_zh, image_object_key,
                cta_label_vi, cta_label_en, cta_label_zh,
                valid_from, valid_to, status
         FROM banners
         WHERE status = 'verified'
           AND (valid_from IS NULL OR valid_from <= datetime('now'))
           AND (valid_to IS NULL OR valid_to >= datetime('now'))
         ORDER BY created_at DESC`,
      ).all<BannerRow>(),
    ]);

    const products = [] as CatalogProduct[];
    for (const row of rows.results) {
      const [rateRows, promotionRows, historyRows, termRows] = await Promise.all([
        db
          .prepare(
            `SELECT rate_id, rate_type, rate_basis, annual_rate_percent,
                    monthly_rate_percent, promo_months,
                    post_promo_annual_rate_percent, post_promo_monthly_rate_percent,
                    post_promo_basis, valid_from, valid_to, observed_at,
                    verified_at, source_document_date, source_hash, status,
                    confidence, review_flags_json
             FROM rate_terms
             WHERE product_id = ?1
             ORDER BY valid_from DESC, observed_at DESC`,
          )
          .bind(row.product_id)
          .all<RateRow>(),
        db
          .prepare(
            `SELECT promotion_id, title_vi, title_en, title_zh,
                    valid_from, valid_to, status
             FROM promotions
             WHERE product_id = ?1
             ORDER BY valid_from DESC
             LIMIT 1`,
          )
          .bind(row.product_id)
          .all<PromotionRow>(),
        db
          .prepare(
            `SELECT snapshot_id, rate_id, annual_rate_percent,
                    monthly_rate_percent, rate_basis, observed_at, source_hash
             FROM rate_history
             WHERE product_id = ?1
             ORDER BY observed_at ASC`,
          )
          .bind(row.product_id)
          .all<RateHistoryRow>(),
        db
          .prepare(
            `SELECT term_type, value_json, status
             FROM product_terms
             WHERE product_id = ?1 AND status = 'verified'
             ORDER BY term_id`,
          )
          .bind(row.product_id)
          .all<ProductTermRow>(),
      ]);
      const rateTerms = rateRows.results.map((rate) => ({
        rateId: rate.rate_id,
        rateType: rate.rate_type,
        basis: rate.rate_basis,
        annualRatePercent: rate.annual_rate_percent,
        monthlyRatePercent: rate.monthly_rate_percent,
        promoMonths: rate.promo_months,
        postPromoAnnualRatePercent: rate.post_promo_annual_rate_percent,
        postPromoMonthlyRatePercent: rate.post_promo_monthly_rate_percent,
        postPromoBasis: rate.post_promo_basis,
        validFrom: rate.valid_from,
        validTo: rate.valid_to,
        observedAt: rate.observed_at,
        verifiedAt: rate.verified_at,
        sourceDocumentDate: rate.source_document_date,
        sourceHash: rate.source_hash,
        status: rate.status,
        confidence: rate.confidence,
        reviewFlags: parseJson(rate.review_flags_json, []),
      }));
      const promo = promotionRows.results[0];
      const rateHistory = historyRows.results.map((snapshot) => ({
        snapshotId: snapshot.snapshot_id,
        rateId: snapshot.rate_id,
        annualRatePercent: snapshot.annual_rate_percent,
        monthlyRatePercent: snapshot.monthly_rate_percent,
        basis: snapshot.rate_basis,
        observedAt: snapshot.observed_at,
        sourceHash: snapshot.source_hash,
      }));
      const requirements = parseJson<LocalizedString[]>(row.requirements_json, []);
      const fees: CatalogFees = {
        processingFeePercent: null,
        appraisalFeeVnd: null,
        prepaymentFeePercent: null,
        mandatoryInsurance: null,
        otherDescription: null,
      };
      for (const term of termRows.results) {
        const value = parseJson<unknown>(term.value_json, null);
        if (term.term_type === "requirement") {
          const localized = typeof value === "string"
            ? { vi: value, en: value, zh: value }
            : value && typeof value === "object" &&
              ["vi", "en", "zh"].every((key) => typeof (value as Record<string, unknown>)[key] === "string")
              ? value as LocalizedString
              : null;
          if (localized) requirements.push(localized);
        }
        if (term.term_type === "fee" && value && typeof value === "object") {
          const fee = value as Record<string, unknown>;
          if (typeof fee.processingFeePercent === "number" && Number.isFinite(fee.processingFeePercent)) fees.processingFeePercent = fee.processingFeePercent;
          if (typeof fee.appraisalFeeVnd === "number" && Number.isFinite(fee.appraisalFeeVnd)) fees.appraisalFeeVnd = fee.appraisalFeeVnd;
          if (typeof fee.prepaymentFeePercent === "number" && Number.isFinite(fee.prepaymentFeePercent)) fees.prepaymentFeePercent = fee.prepaymentFeePercent;
          if (typeof fee.mandatoryInsurance === "boolean") fees.mandatoryInsurance = fee.mandatoryInsurance;
          if (fee.otherDescription && typeof fee.otherDescription === "object") fees.otherDescription = fee.otherDescription as LocalizedString;
        }
      }
      products.push(
        rowToProduct(
          row,
          rateTerms,
          promo
            ? {
                promotionId: promo.promotion_id,
                title: {
                  vi: promo.title_vi,
                  en: promo.title_en,
                  zh: promo.title_zh,
                },
                validFrom: promo.valid_from,
                validTo: promo.valid_to,
                status: promo.status,
              }
            : null,
          rateHistory,
          requirements,
          fees,
        ),
      );
    }
    const providers: CatalogProvider[] = providerRows.results.map((provider) => ({
      providerId: provider.provider_id,
      providerSlug: provider.provider_slug,
      legalName: provider.legal_name,
      displayName: {
        vi: provider.display_name_vi,
        en: provider.display_name_en,
        zh: provider.display_name_zh,
      },
      lenderType: provider.lender_type,
      officialUrl: provider.official_url,
      status: provider.status,
      sourceUrl: provider.source_url,
      observedAt: provider.observed_at,
      verifiedAt: provider.verified_at,
      notes: provider.notes,
    }));
    const banners: CatalogBanner[] = bannerRows.results.map((banner) => ({
      bannerId: banner.banner_id,
      promotionId: banner.promotion_id,
      title: { vi: banner.title_vi, en: banner.title_en, zh: banner.title_zh },
      body: { vi: banner.body_vi, en: banner.body_en, zh: banner.body_zh },
      imageObjectKey: banner.image_object_key,
      ctaLabel: { vi: banner.cta_label_vi, en: banner.cta_label_en, zh: banner.cta_label_zh },
      validFrom: banner.valid_from,
      validTo: banner.valid_to,
      status: banner.status,
    }));
    return {
      version: `d1-${products.length}-${products.map((p) => `${p.sourceHash ?? p.productId}:${p.rateHistory.map((snapshot) => snapshot.sourceHash).join("|")}`).join(",")}`,
      fetchedAt: new Date().toISOString(),
      products,
      providers,
      banners,
      isFallback: false,
    };
  } catch (error) {
    console.error("[catalog] D1 read failed; serving explicitly labelled fallback", error);
    return {
      version: "local-sample-fallback-v1",
      fetchedAt: new Date().toISOString(),
      products: LOCAL_CATALOG,
      providers: LOCAL_PROVIDER_REGISTRY,
      banners: [],
      isFallback: true,
    };
  }
}
