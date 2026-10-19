import type { LoanProfile, RankInput } from "@/lib/engine/types";
import { calcDTI, DTI_CAP } from "@/lib/engine/calcDTI";
import { rankMCDA } from "@/lib/engine/rankMCDA";
import { scoreRisk } from "@/lib/engine/scoreRisk";
import { calculateCatalogProduct } from "@/lib/finance/catalogCalculation";
import type { CatalogProduct, CatalogRateTerm, ProductCategory } from "./types";
import { selectUsableRate } from "./rateSelection";

export interface CatalogRankedOffer {
  packageId: string;
  stableSlug: string;
  providerId: string;
  bank: string;
  productName: string;
  score: number;
  monthlyPayment: number;
  dti: number;
  riskLevel: string;
  ratePercent: number;
  rateBasis: CatalogRateTerm["basis"];
  maxAmount: number | null;
  maxTermMonths: number | null;
  breakdown: {
    lai_suat_thap: number;
    giai_ngan_nhanh: number;
    do_an_toan: number;
  };
  sourceUrl: string;
  observedAt: string | null;
  verifiedAt: string | null;
}

export interface CatalogScoreLog {
  profile: LoanProfile;
  ranked: CatalogRankedOffer[];
  rejected: { packageId: string; reason: string }[];
  recovery?: undefined;
  catalogReady: boolean;
  dataStatus: "verified-catalog" | "no-verified-catalog";
  catalogMessage?: string;
}

function productMatchesPurpose(product: CatalogProduct, purpose: LoanProfile["muc_dich"]): boolean {
  const categoryByPurpose: Record<LoanProfile["muc_dich"], ProductCategory[]> = {
    mua_nha: ["home", "secured"],
    mua_xe: ["car"],
    kinh_doanh: ["business", "secured"],
    tin_chap: ["unsecured", "cash", "motorbike-installment", "phone-appliance-installment", "goods-service-installment"],
  };
  return product.purposeCode === purpose || categoryByPurpose[purpose].includes(product.category);
}

function usableRate(product: CatalogProduct): CatalogRateTerm | null {
  return selectUsableRate(product);
}

function rankingRate(term: CatalogRateTerm): number {
  return term.basis === "monthly-flat"
    ? (term.monthlyRatePercent ?? Number.POSITIVE_INFINITY) * 12
    : term.annualRatePercent ?? Number.POSITIVE_INFINITY;
}

function displayRate(term: CatalogRateTerm): number {
  return term.basis === "monthly-flat"
    ? term.monthlyRatePercent ?? Number.POSITIVE_INFINITY
    : term.annualRatePercent ?? Number.POSITIVE_INFINITY;
}

function displayName(product: CatalogProduct): string {
  return product.productName.vi || product.productName.en || product.stableSlug;
}

export function emptyCatalogScoreLog(profile: LoanProfile, message: string): CatalogScoreLog {
  return {
    profile,
    ranked: [],
    rejected: [],
    catalogReady: false,
    dataStatus: "no-verified-catalog",
    catalogMessage: message,
  };
}

/**
 * Run the original deterministic MCDA/risk pipeline on D1-backed catalog
 * products. Legacy bundled packages are deliberately not accepted here.
 */
export function rankCatalogProducts(
  profile: LoanProfile,
  products: CatalogProduct[],
): CatalogScoreLog {
  const rejected: CatalogScoreLog["rejected"] = [];
  const candidates: Array<{
    product: CatalogProduct;
    rate: CatalogRateTerm;
    payment: number;
    dti: number;
    rank: RankInput;
  }> = [];

  for (const product of products) {
    if (!productMatchesPurpose(product, profile.muc_dich)) continue;
    if (product.minAmountVnd != null && profile.so_tien < product.minAmountVnd) {
      rejected.push({ packageId: product.productId, reason: `Số tiền tối thiểu của sản phẩm là ${product.minAmountVnd.toLocaleString("vi-VN")} VND` });
      continue;
    }
    if (product.maxAmountVnd != null && profile.so_tien > product.maxAmountVnd) {
      rejected.push({ packageId: product.productId, reason: `Sản phẩm chỉ công bố hạn mức tối đa ${product.maxAmountVnd.toLocaleString("vi-VN")} VND` });
      continue;
    }
    if (profile.thoi_han_thang != null && product.minTermMonths != null && profile.thoi_han_thang < product.minTermMonths) {
      rejected.push({ packageId: product.productId, reason: `Kỳ hạn tối thiểu là ${product.minTermMonths} tháng` });
      continue;
    }
    if (profile.thoi_han_thang != null && product.maxTermMonths != null && profile.thoi_han_thang > product.maxTermMonths) {
      rejected.push({ packageId: product.productId, reason: `Kỳ hạn tối đa là ${product.maxTermMonths} tháng` });
      continue;
    }

    const rate = usableRate(product);
    if (!rate) {
      rejected.push({ packageId: product.productId, reason: "Nguồn chưa công bố đủ lãi suất và cơ sở tính để tính toàn kỳ" });
      continue;
    }
    const calculation = calculateCatalogProduct({
      product,
      principalVnd: profile.so_tien,
      termMonths: profile.thoi_han_thang ?? 1,
    }).calculation;
    const monthlyPayment = calculation?.firstPaymentVnd;
    if (monthlyPayment == null) {
      rejected.push({ packageId: product.productId, reason: "Chưa thể tính khoản trả đầu kỳ từ điều khoản đã xác minh" });
      continue;
    }
    if ((profile.thu_nhap_hang_thang ?? 0) <= 0) {
      rejected.push({ packageId: product.productId, reason: "Cần thu nhập hàng tháng để kiểm tra DTI" });
      continue;
    }
    const dtiResult = calcDTI(monthlyPayment, profile.thu_nhap_hang_thang ?? 0, profile.no_hien_tai_hang_thang ?? 0);
    if (!dtiResult.withinLimit) {
      rejected.push({ packageId: product.productId, reason: `DTI dự kiến là ${Math.round(dtiResult.dti * 100)}%, vượt ngưỡng ${DTI_CAP * 100}%` });
      continue;
    }
    const risk = scoreRisk(dtiResult.dti, profile.thoi_han_thang ?? 1);
    candidates.push({
      product,
      rate,
      payment: monthlyPayment,
      dti: dtiResult.dti,
      rank: {
        packageId: product.productId,
        laiSuat: rankingRate(rate),
        riskScore: risk.score,
        hanMuc: product.maxAmountVnd ?? undefined,
        thoiHanMax: product.maxTermMonths ?? undefined,
      },
    });
  }

  // MCDA scores are meaningful only within the same rate basis. A monthly-flat
  // rate and an annual reducing-balance rate must never compete for one global
  // "cheapest" score. Keep deterministic groups and disclose the basis on each
  // result card instead.
  const grouped = new Map<CatalogRateTerm["basis"], typeof candidates>();
  candidates.forEach((candidate) => {
    const group = grouped.get(candidate.rate.basis) ?? [];
    group.push(candidate);
    grouped.set(candidate.rate.basis, group);
  });
  const ranked: CatalogRankedOffer[] = [];
  Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([, group]) => {
      rankMCDA(group.map((candidate) => candidate.rank), profile.uu_tien).forEach((result) => {
        const candidate = group.find((item) => item.product.productId === result.packageId)!;
        const risk = scoreRisk(candidate.dti, profile.thoi_han_thang ?? 1);
        ranked.push({
          packageId: candidate.product.productId,
          stableSlug: candidate.product.stableSlug,
          providerId: candidate.product.providerId,
          bank: candidate.product.providerName.vi,
          productName: displayName(candidate.product),
          score: result.score,
          monthlyPayment: candidate.payment,
          dti: candidate.dti,
          riskLevel: risk.level,
          ratePercent: displayRate(candidate.rate),
          rateBasis: candidate.rate.basis,
          maxAmount: candidate.product.maxAmountVnd,
          maxTermMonths: candidate.product.maxTermMonths,
          breakdown: result.breakdown,
          sourceUrl: candidate.product.sourceUrl,
          observedAt: candidate.product.observedAt,
          verifiedAt: candidate.product.verifiedAt,
        });
      });
    });

  return {
    profile,
    ranked,
    rejected,
    catalogReady: true,
    dataStatus: "verified-catalog",
    catalogMessage: grouped.size > 1
      ? "Kết quả được xếp hạng trong từng cơ sở lãi suất; không gộp %/tháng và %/năm thành một mức rẻ nhất."
      : undefined,
  };
}
