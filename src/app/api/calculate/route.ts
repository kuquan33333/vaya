import { NextRequest, NextResponse } from "next/server";
import { LoanProfileSchema } from "@/lib/validation/profileSchema";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { loadCatalog, publicProducts } from "@/lib/catalog/service";
import { emptyCatalogScoreLog, rankCatalogProducts } from "@/lib/catalog/ranking";

/**
 * POST /api/calculate
 * Body: full loan profile (all required fields present).
 * Returns: ranked offers + rejected + assumptions.
 * No LLM involved — pure deterministic calculation.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = LoanProfileSchema.safeParse(body);
  if (!parsed.success) {
    const formattedError = parsed.error.issues.map((i) => i.message).join("; ");
    return NextResponse.json({ error: formattedError }, { status: 400 });
  }

  const profile = parsed.data;

  // Ensure required calculation fields are present
  if (!profile.thoi_han_thang || !profile.thu_nhap_hang_thang) {
    return NextResponse.json(
      { error: "thoi_han_thang and thu_nhap_hang_thang are required for calculation" },
      { status: 400 },
    );
  }

  const calculationProfile = {
    ...profile,
    thoi_han_thang: profile.thoi_han_thang,
    thu_nhap_hang_thang: profile.thu_nhap_hang_thang,
  };
  const snapshot = await loadCatalog(getCloudflareEnv().DB);
  const products = publicProducts(snapshot.products);
  const scoreLog = products.length > 0
    ? rankCatalogProducts(calculationProfile, products)
    : emptyCatalogScoreLog(
        calculationProfile,
        "Chưa có sản phẩm đã xác minh trong catalog D1; không dùng dữ liệu mẫu để xếp hạng.",
      );
  const observedDates = products
    .flatMap((product) => [product.observedAt, product.verifiedAt])
    .filter((date): date is string => Boolean(date))
    .sort()
    .reverse();

  return NextResponse.json({
    valid: true,
    missingFields: [],
    ranked: scoreLog.ranked,
    rejected: scoreLog.rejected,
    assumptions: [
      "Chỉ xếp hạng sản phẩm có nguồn, cơ sở lãi suất và trạng thái verified trong D1.",
      "DTI tối đa là 60% = (khoản trả đầu kỳ + nợ hiện tại) / thu nhập tháng.",
      "Phí chưa có nguồn được giữ là chưa biết và không được tự bù vào tổng chi phí.",
      "Các cơ sở lãi suất khác nhau được xếp hạng theo nhóm riêng, không coi %/tháng và %/năm là cùng một thước đo.",
    ],
    asOfDate: observedDates[0] ?? null,
    catalogReady: scoreLog.catalogReady,
    dataStatus: scoreLog.dataStatus,
    message: scoreLog.catalogMessage ?? null,
  });
}
