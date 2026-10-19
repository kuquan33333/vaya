import { describe, expect, it } from "vitest";
import { publicProducts } from "@/lib/catalog/service";
import { rankCatalogProducts } from "@/lib/catalog/ranking";
import { localized, type CatalogProduct } from "@/lib/catalog/types";

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    productId: "product:home-1",
    stableSlug: "home-1",
    providerId: "provider:test-bank",
    providerName: localized("Ngân hàng kiểm thử"),
    lenderType: "bank",
    productName: localized("Vay nhà kiểm thử"),
    category: "home",
    purposeCode: "mua_nha",
    minAmountVnd: 10_000_000,
    maxAmountVnd: 2_000_000_000,
    minTermMonths: 6,
    maxTermMonths: 240,
    requirements: [],
    rateTerms: [
      {
        rateId: "rate:home-1",
        rateType: "fixed",
        basis: "annual-nominal-reducing-balance",
        annualRatePercent: 8,
        monthlyRatePercent: null,
        promoMonths: 0,
        postPromoAnnualRatePercent: null,
        postPromoMonthlyRatePercent: null,
        postPromoBasis: null,
        validFrom: "2026-01-01",
        validTo: null,
        observedAt: "2026-10-19",
        verifiedAt: "2026-10-19",
        sourceDocumentDate: "2026-10-01",
        sourceHash: "hash",
        status: "verified",
        confidence: "high",
        reviewFlags: [],
      },
    ],
    rateHistory: [],
    fees: {
      processingFeePercent: null,
      appraisalFeeVnd: null,
      prepaymentFeePercent: null,
      mandatoryInsurance: null,
      otherDescription: null,
    },
    promotion: null,
    sourceUrl: "https://example.test/loan",
    sourceDocumentDate: "2026-10-01",
    sourceHash: "hash",
    status: "verified",
    confidence: "high",
    reviewFlags: [],
    observedAt: "2026-10-19",
    verifiedAt: "2026-10-19",
    legacyIds: [],
    ...overrides,
  };
}

describe("verified catalog ranking", () => {
  it("uses the canonical payment and MCDA engine for verified products", () => {
    const result = rankCatalogProducts(
      {
        muc_dich: "mua_nha",
        so_tien: 100_000_000,
        thoi_han_thang: 12,
        thu_nhap_hang_thang: 30_000_000,
        no_hien_tai_hang_thang: 0,
        uu_tien: ["lai_suat_thap"],
      },
      [product()],
    );

    expect(result.catalogReady).toBe(true);
    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0].monthlyPayment).toBeGreaterThan(0);
    expect(result.ranked[0].sourceUrl).toBe("https://example.test/loan");
    expect(result.ranked[0].dti).toBeLessThanOrEqual(0.6);
  });

  it("does not publish APR/EIR or incomplete post-promo terms", () => {
    const apr = product({
      rateTerms: [
        { ...product().rateTerms[0], basis: "apr", annualRatePercent: 8 },
      ],
    });
    const incompletePromo = product({
      rateTerms: [
        { ...product().rateTerms[0], promoMonths: 12, postPromoBasis: null },
      ],
    });
    expect(publicProducts([apr, incompletePromo])).toHaveLength(0);
  });

  it("does not publish an expired rate when a current term is absent", () => {
    const expired = product({
      rateTerms: [{ ...product().rateTerms[0], validTo: "2026-01-01" }],
    });
    expect(publicProducts([expired])).toHaveLength(0);
  });
});
