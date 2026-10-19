import type { MonthlyPaymentResult } from "./types";
import { calculateLoan } from "@/lib/finance/loanMath";

/**
 * Legacy package calculator.
 *
 * The original Vaya catalog only exposed a starting annual rate and did not
 * disclose a lender-specific amortisation method. Preserve its historical
 * first-month equal-principal behavior, while delegating the arithmetic to
 * the verified financial math module used by new catalog records.
 */
export function calcMonthlyPayment(
  soTien: number,
  laiSuatNamPercent: number,
  thoiHanThang: number,
): MonthlyPaymentResult {
  if (thoiHanThang <= 0) throw new Error("thoiHanThang must be positive");
  if (soTien <= 0) throw new Error("soTien must be positive");

  const result = calculateLoan({
    principalVnd: soTien,
    termMonths: thoiHanThang,
    method: "equal-principal",
    rate: {
      valuePercent: laiSuatNamPercent,
      basis: "annual-nominal-original-principal",
    },
    fees: { upfrontVnd: 0, monthlyVnd: 0 },
  });

  return {
    goc: result.monthlyPrincipalVnd ?? 0,
    laiThangDau: result.firstMonthInterestVnd ?? 0,
    tongThangDau: result.firstPaymentVnd ?? 0,
  };
}
