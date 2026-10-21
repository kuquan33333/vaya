import type { CatalogProduct } from "@/lib/catalog/types";
import { calculateLoan, UnavailableRateError, type RepaymentMethod } from "./loanMath";
import { selectUsableRate } from "@/lib/catalog/rateSelection";

export interface CatalogCalculationRequest {
  principalVnd: number;
  termMonths: number;
  product: CatalogProduct;
  method?: RepaymentMethod;
}

export interface CatalogCalculationResult {
  productId: string;
  providerId: string;
  status: CatalogProduct["status"];
  rankable: boolean;
  message: "calculated" | "unavailable-rate";
  calculation: ReturnType<typeof calculateLoan> | null;
}

export function calculateCatalogProduct(
  request: CatalogCalculationRequest,
): CatalogCalculationResult {
  const rate = selectUsableRate(request.product);
  if (!rate) {
    return {
      productId: request.product.productId,
      providerId: request.product.providerId,
      status: request.product.status,
      rankable: false,
      message: "unavailable-rate",
      calculation: null,
    };
  }

  try {
    const knownUpfrontFees = request.product.fees.processingFeePercent != null && request.product.fees.appraisalFeeVnd != null
      ? request.principalVnd * request.product.fees.processingFeePercent / 100 + request.product.fees.appraisalFeeVnd
      : null;
    return {
      productId: request.product.productId,
      providerId: request.product.providerId,
      status: request.product.status,
      rankable: request.product.status === "verified",
      message: "calculated",
      calculation: calculateLoan({
        principalVnd: request.principalVnd,
        termMonths: request.termMonths,
        method: request.method,
        rate: {
          valuePercent: rate.annualRatePercent,
          monthlyValuePercent: rate.monthlyRatePercent,
          basis: rate.basis,
          promoMonths: rate.promoMonths ?? undefined,
          postPromo: rate.postPromoBasis
            ? {
                valuePercent: rate.postPromoAnnualRatePercent,
                monthlyValuePercent: rate.postPromoMonthlyRatePercent,
                basis: rate.postPromoBasis,
              }
            : undefined,
        },
        fees: {
          upfrontVnd: knownUpfrontFees,
          monthlyVnd: null,
        },
      }),
    };
  } catch (error) {
    if (error instanceof UnavailableRateError) {
      return {
        productId: request.product.productId,
        providerId: request.product.providerId,
        status: request.product.status,
        rankable: false,
        message: "unavailable-rate",
        calculation: null,
      };
    }
    throw error;
  }
}
