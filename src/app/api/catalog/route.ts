import { NextResponse } from "next/server";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { loadCatalog, publicProducts } from "@/lib/catalog/service";

export async function GET() {
  const snapshot = await loadCatalog(getCloudflareEnv().DB);
  const products = publicProducts(snapshot.products).map((product) => ({
    productId: product.productId,
    stableSlug: product.stableSlug,
    providerId: product.providerId,
    providerName: product.providerName,
    lenderType: product.lenderType,
    productName: product.productName,
    category: product.category,
    purposeCode: product.purposeCode,
    minAmountVnd: product.minAmountVnd,
    maxAmountVnd: product.maxAmountVnd,
    minTermMonths: product.minTermMonths,
    maxTermMonths: product.maxTermMonths,
    rateTerms: product.rateTerms,
    rateHistory: product.rateHistory,
    fees: product.fees,
    promotion: product.promotion,
    sourceUrl: product.sourceUrl,
    sourceDocumentDate: product.sourceDocumentDate,
    verifiedAt: product.verifiedAt,
    observedAt: product.observedAt,
  }));
  return NextResponse.json(
    {
      catalogReady: products.length > 0,
      version: snapshot.version,
      fetchedAt: snapshot.fetchedAt,
      isFallback: snapshot.isFallback,
      products,
      providers: snapshot.providers
        .map((provider) => provider),
      banners: snapshot.banners,
      message:
        products.length > 0
          ? null
          : "Chưa có sản phẩm có lãi suất được xác minh — đăng ký tư vấn để nhân viên kiểm tra hồ sơ.",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        Vary: "Accept-Language",
      },
    },
  );
}
