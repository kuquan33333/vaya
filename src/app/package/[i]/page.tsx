import Link from "next/link";
import { redirect } from "next/navigation";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { LOCAL_CATALOG } from "@/lib/catalog/legacyCatalog";
import { loadCatalog, publicProducts } from "@/lib/catalog/service";

export const dynamic = "force-dynamic";

/**
 * Compatibility route for old `/package/<array-index>` links. Once a human
 * reviewer has imported and verified a product with the old legacy id, the
 * route resolves to its stable slug. Until then it remains an honest empty
 * state instead of rendering the old static fixture as a live offer.
 */
export default async function PackagePage({ params }: { params: Promise<{ i: string }> }) {
  const { i } = await params;
  const index = Number.parseInt(i, 10);
  const legacyId = Number.isInteger(index) && index >= 0 ? LOCAL_CATALOG[index]?.legacyIds[0] : undefined;
  const snapshot = await loadCatalog(getCloudflareEnv().DB);
  const product = legacyId ? publicProducts(snapshot.products).find((item) => item.legacyIds.includes(legacyId)) : undefined;
  if (product) {
    redirect(`/product/${encodeURIComponent(product.stableSlug)}`);
  }
  return (
    <section className="pageview on"><div className="wrap" style={{ padding: "70px 0" }}>
      <span className="sec-tag">Catalog đã thay đổi</span>
      <h2>Gói này chưa có dữ liệu được xác minh</h2>
      <p>vaytiendanang giữ route cũ để không làm hỏng liên kết, nhưng không hiển thị bản ghi tĩnh như một đề nghị hiện hành. Chỉ sản phẩm có nguồn chính thức và điều khoản đã xác minh mới được mở công khai.</p>
      <Link className="btn btn-green" href="/#markets">Mở catalog</Link>
    </div></section>
  );
}
