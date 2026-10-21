import { describe, expect, it } from "vitest";
import {
  calculateLoan,
  UnavailableRateError,
} from "@/lib/finance/loanMath";

describe("verified loan math", () => {
  it("calculates zero-interest annuity exactly", () => {
    const result = calculateLoan({
      principalVnd: 1_000_000,
      termMonths: 10,
      rate: { valuePercent: 0, basis: "annual-nominal-reducing-balance" },
      fees: { upfrontVnd: 0, monthlyVnd: 0 },
    });

    expect(result.firstPaymentVnd).toBe(100_000);
    expect(result.totalInterestVnd).toBe(0);
    expect(result.totalRepaymentVnd).toBe(1_000_000);
  });

  it("distinguishes original-principal interest from reducing-balance annuity", () => {
    const original = calculateLoan({
      principalVnd: 1_200_000,
      termMonths: 12,
      method: "equal-principal",
      rate: { valuePercent: 12, basis: "annual-nominal-original-principal" },
      fees: { upfrontVnd: 0, monthlyVnd: 0 },
    });
    const reducing = calculateLoan({
      principalVnd: 1_200_000,
      termMonths: 12,
      rate: { valuePercent: 12, basis: "annual-nominal-reducing-balance" },
      fees: { upfrontVnd: 0, monthlyVnd: 0 },
    });

    expect(original.firstPaymentVnd).toBe(112_000);
    expect(original.totalInterestVnd).toBe(144_000);
    expect(reducing.firstPaymentVnd).toBe(106_619);
    expect(reducing.totalInterestVnd).toBe(79_423);
  });

  it("does not annualize a monthly-flat rate by multiplying it by twelve", () => {
    const result = calculateLoan({
      principalVnd: 1_200_000,
      termMonths: 12,
      method: "equal-principal",
      rate: {
        valuePercent: null,
        monthlyValuePercent: 1,
        basis: "monthly-flat",
      },
      fees: { upfrontVnd: 0, monthlyVnd: 0 },
    });

    expect(result.firstPaymentVnd).toBe(112_000);
    expect(result.totalInterestVnd).toBe(144_000);
  });

  it("refuses an unavailable rate or APR without complete inputs", () => {
    expect(() =>
      calculateLoan({
        principalVnd: 10_000_000,
        termMonths: 12,
        rate: { valuePercent: null, basis: "unknown" },
      }),
    ).toThrow(UnavailableRateError);
    expect(() =>
      calculateLoan({
        principalVnd: 10_000_000,
        termMonths: 12,
        rate: { valuePercent: 10, basis: "apr" },
      }),
    ).toThrow(UnavailableRateError);
  });

  it("does not claim an all-in repayment total when fees are unknown", () => {
    const result = calculateLoan({
      principalVnd: 10_000_000,
      termMonths: 12,
      rate: { valuePercent: 12, basis: "annual-nominal-original-principal" },
    });

    expect(result.totalInterestVnd).toBe(1_200_000);
    expect(result.totalFeesVnd).toBeNull();
    expect(result.totalRepaymentVnd).toBeNull();
  });
});
