import type { CatalogProduct, CatalogRateTerm } from "./types";

function isActiveDate(value: string | null, direction: "from" | "to", now: number): boolean {
  if (!value) return true;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return false;
  return direction === "from" ? time <= now : time >= now;
}

function hasUsableValue(rate: CatalogRateTerm): boolean {
  const value = rate.basis === "monthly-flat" ? rate.monthlyRatePercent : rate.annualRatePercent;
  return value != null && Number.isFinite(value) && value >= 0;
}

function hasCompletePostPromo(rate: CatalogRateTerm): boolean {
  if (!rate.promoMonths || rate.promoMonths <= 0) return true;
  if (!rate.postPromoBasis || rate.postPromoBasis === "unknown" || rate.postPromoBasis === "apr" || rate.postPromoBasis === "eir") {
    return false;
  }
  const value = rate.postPromoBasis === "monthly-flat"
    ? rate.postPromoMonthlyRatePercent
    : rate.postPromoAnnualRatePercent;
  return value != null && Number.isFinite(value) && value >= 0;
}

/**
 * Select the rate that is both publishable and current at the observation time.
 * This is shared by publication, ranking, calculation and the browser so an
 * expired rate cannot remain visible merely because it was first in an array.
 */
export function selectUsableRate(product: CatalogProduct, now = Date.now()): CatalogRateTerm | null {
  if (product.status !== "verified") return null;
  return (
    product.rateTerms
      .filter(
        (rate) =>
          rate.status === "verified" &&
          rate.basis !== "unknown" &&
          rate.basis !== "apr" &&
          rate.basis !== "eir" &&
          hasUsableValue(rate) &&
          hasCompletePostPromo(rate) &&
          isActiveDate(rate.validFrom, "from", now) &&
          isActiveDate(rate.validTo, "to", now),
      )
      .sort((a, b) => {
        const fromA = a.validFrom ? Date.parse(a.validFrom) : 0;
        const fromB = b.validFrom ? Date.parse(b.validFrom) : 0;
        if (fromA !== fromB) return fromB - fromA;
        const observedA = a.observedAt ? Date.parse(a.observedAt) : 0;
        const observedB = b.observedAt ? Date.parse(b.observedAt) : 0;
        return observedB - observedA;
      })[0] ?? null
  );
}

export function isPubliclyRankableProduct(product: CatalogProduct, now = Date.now()): boolean {
  return product.status === "verified" && selectUsableRate(product, now) !== null;
}
