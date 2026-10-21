import type { Lang } from "@/i18n/dict";

export type LocalizedString = Record<Lang, string>;

export type LenderType = "bank" | "consumer-finance";
export type ProductCategory =
  | "cash"
  | "unsecured"
  | "motorbike-installment"
  | "phone-appliance-installment"
  | "goods-service-installment"
  | "car"
  | "home"
  | "business"
  | "secured";
export type CatalogStatus =
  | "verified"
  | "sample"
  | "quarantine"
  | "blocked"
  | "expired";
export type Confidence = "high" | "medium" | "low";
export type RateType = "fixed" | "floating" | "promotional" | "unavailable";
export type RateBasis =
  | "annual-nominal-reducing-balance"
  | "annual-nominal-original-principal"
  | "monthly-flat"
  | "apr"
  | "eir"
  | "unknown";

export interface CatalogProvider {
  providerId: string;
  providerSlug: string;
  legalName: string;
  displayName: LocalizedString;
  lenderType: LenderType;
  officialUrl: string;
  status: "active" | "pending_verification" | "blocked";
  sourceUrl: string;
  observedAt: string | null;
  verifiedAt: string | null;
  notes: string | null;
}

export interface CatalogRateTerm {
  rateId: string;
  rateType: RateType;
  basis: RateBasis;
  annualRatePercent: number | null;
  monthlyRatePercent: number | null;
  promoMonths: number | null;
  postPromoAnnualRatePercent: number | null;
  postPromoMonthlyRatePercent: number | null;
  postPromoBasis: RateBasis | null;
  validFrom: string | null;
  validTo: string | null;
  observedAt: string | null;
  verifiedAt: string | null;
  sourceDocumentDate: string | null;
  sourceHash: string | null;
  status: CatalogStatus;
  confidence: Confidence;
  reviewFlags: string[];
}

export interface CatalogRateSnapshot {
  snapshotId: string;
  rateId: string | null;
  annualRatePercent: number | null;
  monthlyRatePercent: number | null;
  basis: RateBasis;
  observedAt: string;
  sourceHash: string;
}

export interface CatalogFees {
  processingFeePercent: number | null;
  appraisalFeeVnd: number | null;
  prepaymentFeePercent: number | null;
  mandatoryInsurance: boolean | null;
  otherDescription: LocalizedString | null;
}

export interface CatalogProduct {
  productId: string;
  stableSlug: string;
  providerId: string;
  providerName: LocalizedString;
  lenderType: LenderType;
  productName: LocalizedString;
  category: ProductCategory;
  purposeCode: string;
  minAmountVnd: number | null;
  maxAmountVnd: number | null;
  minTermMonths: number | null;
  maxTermMonths: number | null;
  requirements: LocalizedString[];
  rateTerms: CatalogRateTerm[];
  rateHistory: CatalogRateSnapshot[];
  fees: CatalogFees;
  promotion: {
    promotionId: string;
    title: LocalizedString;
    validFrom: string | null;
    validTo: string | null;
    status: CatalogStatus;
  } | null;
  sourceUrl: string;
  sourceDocumentDate: string | null;
  sourceHash: string | null;
  status: CatalogStatus;
  confidence: Confidence;
  reviewFlags: string[];
  observedAt: string | null;
  verifiedAt: string | null;
  legacyIds: string[];
}

export interface CatalogBanner {
  bannerId: string;
  promotionId: string | null;
  title: LocalizedString;
  body: LocalizedString;
  imageObjectKey: string | null;
  ctaLabel: LocalizedString;
  validFrom: string | null;
  validTo: string | null;
  status: CatalogStatus;
}

export interface CatalogSnapshot {
  version: string;
  fetchedAt: string;
  products: CatalogProduct[];
  providers: CatalogProvider[];
  banners: CatalogBanner[];
  isFallback: boolean;
}

export function localized(vi: string, en = vi, zh = vi): LocalizedString {
  return { vi, en, zh } as LocalizedString;
}

export function localizedText(value: LocalizedString, lang: Lang): string {
  return value[lang] ?? value.vi ?? value.en;
}
