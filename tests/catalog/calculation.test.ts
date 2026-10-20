import { describe, expect, it } from "vitest";
import { calculateCatalogProduct } from "@/lib/finance/catalogCalculation";
import { localized, type CatalogProduct } from "@/lib/catalog/types";

function verifiedProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    productId: "test-product",
    stableSlug: "test-product",
    providerId: "test-provider",
    providerName: localized("Đơn vị kiểm thử", "Test provider", "测试机构"),
    lenderType: "bank",
    productName: localized("Gói kiểm thử", "Test product", "测试产品"),
    category: "cash",
    purposeCode: "tin_chap",
    minAmountVnd: 1_000_000,
    maxAmountVnd: 100_000_000,
    minTermMonths: 6,
    maxTermMonths: 36,
    requirements: [],
    rateTerms: [{
      rateId: "test-rate",
      rateType: "fixed",
      basis: "annual-nominal-reducing-balance",
      annualRatePercent: 12,
      monthlyRatePercent: null,
      promoMonths: null,
      postPromoAnnualRatePercent: null,
      postPromoMonthlyRatePercent: null,
      postPromoBasis: null,
      validFrom: null,
      validTo: null,
      observedAt: "2026-10-01",
      verifiedAt: "2026-10-02",
      sourceDocumentDate: "2026-10-01",
      sourceHash: "test-hash",
      status: "verified",
      confidence: "high",
      reviewFlags: [],
    }],
    rateHistory: [],
    fees: { processingFeePercent: 1, appraisalFeeVnd: 0, prepaymentFeePercent: null, mandatoryInsurance: null, otherDescription: null },
    promotion: null,
    sourceUrl: "https://example.test/verified-source",
    sourceDocumentDate: "2026-10-01",
    sourceHash: "test-hash",
    status: "verified",
    confidence: "high",
    reviewFlags: [],
    observedAt: "2026-10-01",
    verifiedAt: "2026-10-02",
    legacyIds: [],
    ...overrides,
  };
}

describe("catalog calculation gate", () => {
  it("uses the verified rate and publishes known fees in the result", () => {
    const result = calculateCatalogProduct({ product: verifiedProduct(), principalVnd: 10_000_000, termMonths: 12 });
    expect(result.message).toBe("calculated");
    expect(result.calculation?.rateKnown).toBe(true);
    // The catalog currently has no monthly-fee field. The engine therefore
    // keeps the all-in total unavailable instead of assuming an undocumented
    // zero monthly fee.
    expect(result.calculation?.feeKnown).toBe(false);
    expect(result.calculation?.totalRepaymentVnd).toBeNull();
    expect(result.calculation?.firstPaymentVnd).toBeGreaterThan(0);
  });

  it("refuses a product with an unavailable rate instead of inventing a payment", () => {
    const result = calculateCatalogProduct({
      product: verifiedProduct({ rateTerms: [{ ...verifiedProduct().rateTerms[0], annualRatePercent: null, basis: "unknown" }] }),
      principalVnd: 10_000_000,
      termMonths: 12,
    });
    expect(result.message).toBe("unavailable-rate");
    expect(result.calculation).toBeNull();
  });
});
