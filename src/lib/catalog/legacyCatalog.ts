import { BANKS } from "@/data/banks";
import { LOAN_PACKAGES } from "@/data/loanPackages";
import type {
  CatalogProduct,
  CatalogProvider,
  ProductCategory,
} from "./types";
import { localized } from "./types";

const OBSERVED_AT = "2026-10-19";

const providerUrl: Record<string, string> = {
  Vietcombank: "https://www.vietcombank.com.vn/",
  BIDV: "https://www.bidv.com.vn/",
  Techcombank: "https://www.techcombank.com/",
  VPBank: "https://www.vpbank.com.vn/",
  "MB Bank": "https://www.mbbank.com.vn/",
  ACB: "https://www.acb.com.vn/",
  VIB: "https://www.vib.com.vn/",
  TPBank: "https://tpb.vn/",
  Sacombank: "https://www.sacombank.com.vn/",
  HDBank: "https://www.hdbank.com.vn/",
  VietinBank: "https://www.vietinbank.vn/",
  Agribank: "https://www.agribank.com.vn/",
  SHB: "https://www.shb.com.vn/",
  MSB: "https://www.msb.com.vn/",
};

const productCategory: Record<string, ProductCategory> = {
  mua_xe: "car",
  mua_nha: "home",
  kinh_doanh: "business",
  tin_chap: "unsecured",
};

const providerId = (name: string) =>
  `provider:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

export const LOCAL_PROVIDER_REGISTRY: CatalogProvider[] = [
  ...BANKS.map((bank) => ({
    providerId: providerId(bank.name),
    providerSlug: bank.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    legalName: bank.name,
    displayName: localized(bank.name, bank.name, bank.name),
    lenderType: "bank" as const,
    officialUrl: providerUrl[bank.name] ?? "",
    status: "pending_verification" as const,
    sourceUrl: providerUrl[bank.name] ?? "",
    observedAt: null,
    verifiedAt: null,
    notes: "Provider registry only; product terms require source verification.",
  })),
  {
    providerId: "provider:home-credit",
    providerSlug: "home-credit",
    legalName: "Home Credit Vietnam Finance Company Limited",
    displayName: localized("Home Credit", "Home Credit", "Home Credit"),
    lenderType: "consumer-finance",
    officialUrl: "https://www.homecredit.vn/",
    status: "pending_verification",
    sourceUrl: "https://www.homecredit.vn/",
    observedAt: null,
    verifiedAt: null,
    notes: "Official source allowlisted; crawl/terms verification pending.",
  },
  {
    providerId: "provider:fe-credit",
    providerSlug: "fe-credit",
    legalName: "FE CREDIT",
    displayName: localized("FE CREDIT", "FE CREDIT", "FE CREDIT"),
    lenderType: "consumer-finance",
    officialUrl: "https://fecredit.com.vn/",
    status: "pending_verification",
    sourceUrl: "https://fecredit.com.vn/",
    observedAt: null,
    verifiedAt: null,
    notes: "Official source allowlisted; crawl/terms verification pending.",
  },
  {
    providerId: "provider:hd-saison",
    providerSlug: "hd-saison",
    legalName: "HD SAISON Finance Company Limited",
    displayName: localized("HD SAISON", "HD SAISON", "HD SAISON"),
    lenderType: "consumer-finance",
    officialUrl: "https://www.hdsaison.com.vn/",
    status: "pending_verification",
    sourceUrl: "https://www.hdsaison.com.vn/",
    observedAt: null,
    verifiedAt: null,
    notes: "Official source allowlisted; crawl/terms verification pending.",
  },
  {
    providerId: "provider:shb-finance",
    providerSlug: "shb-finance",
    legalName: "SHB Finance Company Limited",
    displayName: localized("SHBFinance", "SHBFinance", "SHBFinance"),
    lenderType: "consumer-finance",
    officialUrl: "https://www.shbfinance.com.vn/",
    status: "pending_verification",
    sourceUrl: "https://www.shbfinance.com.vn/",
    observedAt: null,
    verifiedAt: null,
    notes: "Official source allowlisted; crawl/terms verification pending.",
  },
  {
    providerId: "provider:mcredit",
    providerSlug: "mcredit",
    legalName: "Mcredit",
    displayName: localized("Mcredit", "Mcredit", "Mcredit"),
    lenderType: "consumer-finance",
    officialUrl: "https://mcredit.vn/",
    status: "pending_verification",
    sourceUrl: "https://mcredit.vn/",
    observedAt: null,
    verifiedAt: null,
    notes: "Official source allowlisted; crawl/terms verification pending.",
  },
  {
    providerId: "provider:mirae-asset-finance",
    providerSlug: "mirae-asset-finance",
    legalName: "Mirae Asset Finance Vietnam",
    displayName: localized("Mirae Asset Finance", "Mirae Asset Finance", "Mirae Asset Finance"),
    lenderType: "consumer-finance",
    officialUrl: "https://miraeasset.com.vn/",
    status: "pending_verification",
    sourceUrl: "https://miraeasset.com.vn/",
    observedAt: null,
    verifiedAt: null,
    notes: "Official source allowlisted; crawl/terms verification pending.",
  },
];

/**
 * Compatibility catalog for the original deterministic engine. These rows are
 * intentionally `sample` and have no publishable rate term: the old static
 * numbers remain available to regression fixtures, never as verified data.
 */
export const LOCAL_CATALOG: CatalogProduct[] = LOAN_PACKAGES.map((pkg) => ({
  productId: `legacy:${pkg.id}`,
  stableSlug: `legacy-${pkg.id}`,
  providerId: providerId(pkg.bank),
  providerName: localized(pkg.bank, pkg.bank, pkg.bank),
  lenderType: "bank",
  productName: localized(`${pkg.bank} ${pkg.muc_dich}`, `${pkg.bank} ${pkg.muc_dich}`, `${pkg.bank} ${pkg.muc_dich}`),
  category: productCategory[pkg.muc_dich] ?? "unsecured",
  purposeCode: pkg.muc_dich,
  minAmountVnd: null,
  maxAmountVnd: pkg.han_muc,
  minTermMonths: pkg.thoi_han_min,
  maxTermMonths: pkg.thoi_han_max,
  requirements: [],
  rateTerms: [],
  rateHistory: [],
  fees: {
    processingFeePercent: null,
    appraisalFeeVnd: null,
    prepaymentFeePercent: null,
    mandatoryInsurance: null,
    otherDescription: null,
  },
  promotion: null,
  sourceUrl: providerUrl[pkg.bank] ?? "",
  sourceDocumentDate: null,
  sourceHash: null,
  status: "sample",
  confidence: "low",
  reviewFlags: ["legacy-static-record", "rate-basis-missing", "not-for-ranking"],
  observedAt: OBSERVED_AT,
  verifiedAt: null,
  legacyIds: [pkg.id],
}));
