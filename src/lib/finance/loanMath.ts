export type RepaymentMethod = "annuity" | "equal-principal";
export type FinancialRateBasis =
  | "annual-nominal-reducing-balance"
  | "annual-nominal-original-principal"
  | "monthly-flat"
  | "apr"
  | "eir"
  | "unknown";

export interface FinancialRate {
  valuePercent: number | null;
  basis: FinancialRateBasis;
  monthlyValuePercent?: number | null;
  promoMonths?: number;
  /**
   * A promotional rate is only calculable for the full term when the rate
   * after the promotion is disclosed as well. Keeping it explicit prevents a
   * short-term teaser from silently being applied to a multi-year loan.
   */
  postPromo?: {
    valuePercent: number | null;
    basis: FinancialRateBasis;
    monthlyValuePercent?: number | null;
  };
}

export interface LoanScheduleRow {
  month: number;
  ratePercent: number | null;
  openingPrincipalVnd: number;
  principalVnd: number;
  interestVnd: number | null;
  feeVnd: number | null;
  paymentVnd: number | null;
  closingPrincipalVnd: number;
}

export interface LoanCalculation {
  schedule: LoanScheduleRow[];
  firstPaymentVnd: number | null;
  firstMonthInterestVnd: number | null;
  monthlyPrincipalVnd: number | null;
  totalPrincipalVnd: number;
  totalInterestVnd: number | null;
  totalFeesVnd: number | null;
  totalRepaymentVnd: number | null;
  rateKnown: boolean;
  feeKnown: boolean;
  effectiveAnnualRatePercent: number | null;
}

export class UnavailableRateError extends Error {
  constructor() {
    super("A verified rate and rate basis are required for this calculation");
    this.name = "UnavailableRateError";
  }
}

export interface LoanCalculationInput {
  principalVnd: number;
  termMonths: number;
  rate: FinancialRate;
  method?: RepaymentMethod;
  fees?: {
    upfrontVnd?: number | null;
    monthlyVnd?: number | null;
  };
}

function assertInput(input: LoanCalculationInput): void {
  if (!Number.isFinite(input.principalVnd) || input.principalVnd <= 0) {
    throw new RangeError("principalVnd must be positive");
  }
  if (!Number.isInteger(input.termMonths) || input.termMonths <= 0) {
    throw new RangeError("termMonths must be a positive integer");
  }
}

function roundVnd(value: number): number {
  return Math.round(value);
}

function annuityPayment(principal: number, monthlyRate: number, months: number): number {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function knownAnnualRate(rate: Pick<FinancialRate, "valuePercent" | "basis">): number {
  if (rate.valuePercent == null || !Number.isFinite(rate.valuePercent)) {
    throw new UnavailableRateError();
  }
  if (rate.basis === "unknown" || rate.basis === "apr" || rate.basis === "eir") {
    throw new UnavailableRateError();
  }
  return rate.valuePercent;
}

/**
 * Calculate a transparent schedule without treating monthly-flat rates as an
 * annual rate. Unknown rate basis or unavailable rate is a hard error so a
 * caller can render the verified-data fallback instead of inventing a number.
 */
export function calculateLoan(input: LoanCalculationInput): LoanCalculation {
  assertInput(input);
  const { principalVnd, termMonths } = input;
  const method = input.method ?? "annuity";
  const promoMonths = input.rate.promoMonths ?? 0;
  if (!Number.isInteger(promoMonths) || promoMonths < 0 || promoMonths > termMonths) {
    throw new RangeError("promoMonths must be between 0 and termMonths");
  }

  if (promoMonths > 0 && promoMonths < termMonths && !input.rate.postPromo) {
    throw new UnavailableRateError();
  }

  const rateForMonth = (month: number): FinancialRate =>
    promoMonths > 0 && month > promoMonths && input.rate.postPromo
      ? { ...input.rate.postPromo, promoMonths: 0 }
      : input.rate;

  const rateValues = (rate: FinancialRate) => {
    if (rate.basis === "monthly-flat") {
      const monthly = rate.monthlyValuePercent;
      if (monthly == null || !Number.isFinite(monthly) || monthly < 0) {
        throw new UnavailableRateError();
      }
      return {
        basis: rate.basis,
        annual: null,
        monthly: monthly / 100,
        annualDisplay: null,
        flat: true,
      };
    }
    const annual = knownAnnualRate(rate);
    if (annual < 0) throw new RangeError("rate cannot be negative");
    return {
      basis: rate.basis,
      annual,
      monthly: annual / 1200,
      annualDisplay: annual,
      flat: rate.basis === "annual-nominal-original-principal",
    };
  };

  // Validate every disclosed segment before writing a single schedule row.
  // This makes a partial result impossible when a post-promo rate is malformed.
  const initialRate = rateValues(input.rate);
  if (promoMonths > 0 && promoMonths < termMonths && input.rate.postPromo) {
    rateValues(input.rate.postPromo);
  }

  const upfrontFee = input.fees?.upfrontVnd;
  const monthlyFee = input.fees?.monthlyVnd;
  const feeKnown = typeof upfrontFee === "number" && typeof monthlyFee === "number";
  const normalizedUpfrontFee = typeof upfrontFee === "number" ? upfrontFee : 0;
  const normalizedMonthlyFee = typeof monthlyFee === "number" ? monthlyFee : 0;
  const rows: LoanScheduleRow[] = [];
  let balance = principalVnd;
  let totalInterest = 0;
  let totalFees = normalizedUpfrontFee;
  let currentInstallment: number | null = null;

  for (let month = 1; month <= termMonths; month += 1) {
    const activeRate = rateForMonth(month);
    const active = month === 1 ? initialRate : rateValues(activeRate);
    const isFlat = active.flat;
    const opening = balance;
    const interest = isFlat ? principalVnd * active.monthly : opening * active.monthly;

    let principalPayment: number;
    let payment: number;
    const isPromoBoundary =
      method === "annuity" &&
      !isFlat &&
      month === (promoMonths > 0 ? promoMonths + 1 : 1);
    if (isFlat || method === "equal-principal") {
      principalPayment = Math.min(principalVnd / termMonths, opening);
      payment = principalPayment + interest;
    } else {
      if (month === 1 || isPromoBoundary) {
        currentInstallment = annuityPayment(
          opening,
          active.monthly,
          termMonths - month + 1,
        );
      }
      const installment = currentInstallment ?? annuityPayment(opening, active.monthly, termMonths - month + 1);
      payment = Math.min(installment, opening + interest);
      principalPayment = Math.min(opening, Math.max(0, payment - interest));
    }

    const rowFee = normalizedMonthlyFee;
    const closing = Math.max(0, opening - principalPayment);
    totalInterest += interest;
    totalFees += rowFee;
    rows.push({
      month,
      ratePercent: active.annualDisplay,
      openingPrincipalVnd: roundVnd(opening),
      principalVnd: roundVnd(principalPayment),
      interestVnd: roundVnd(interest),
      feeVnd: feeKnown ? roundVnd(rowFee) : null,
      paymentVnd: roundVnd(payment + rowFee),
      closingPrincipalVnd: roundVnd(closing),
    });
    balance = closing;
  }

  return {
    schedule: rows,
    firstPaymentVnd: rows[0]?.paymentVnd ?? null,
    firstMonthInterestVnd: rows[0]?.interestVnd ?? null,
    monthlyPrincipalVnd: rows[0]?.principalVnd ?? null,
    totalPrincipalVnd: roundVnd(principalVnd),
    totalInterestVnd: roundVnd(totalInterest),
    totalFeesVnd: feeKnown ? roundVnd(totalFees) : null,
    totalRepaymentVnd: feeKnown ? roundVnd(principalVnd + totalInterest + totalFees) : null,
    rateKnown: true,
    feeKnown,
    effectiveAnnualRatePercent:
      input.rate.basis === "annual-nominal-reducing-balance" &&
      (!input.rate.postPromo || input.rate.postPromo.valuePercent === input.rate.valuePercent)
        ? input.rate.valuePercent
        : null,
  };
}
