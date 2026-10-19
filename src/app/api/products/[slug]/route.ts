import { NextResponse } from "next/server";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { loadCatalog, publicProducts } from "@/lib/catalog/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const snapshot = await loadCatalog(getCloudflareEnv().DB);
  const product = publicProducts(snapshot.products).find((item) => item.stableSlug === slug);
  if (!product) {
    return NextResponse.json({ error: "product_not_found_or_not_verified" }, { status: 404 });
  }
  return NextResponse.json(product, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" },
  });
}
