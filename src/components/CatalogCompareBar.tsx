"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchPublicCatalog } from "@/lib/catalog/client";
import {
  CATALOG_COMPARE_MAX,
  clearCatalogCompare,
  removeCatalogCompare,
  useCatalogCompare,
} from "@/lib/catalog/compareStore";
import type { CatalogProduct } from "@/lib/catalog/types";

export default function CatalogCompareBar() {
  const ids = useCatalogCompare();
  const pathname = usePathname();
  const router = useRouter();
  const [products, setProducts] = useState<CatalogProduct[]>([]);

  useEffect(() => {
    if (!ids.length) return;
    const controller = new AbortController();
    fetchPublicCatalog(controller.signal).then((data) => setProducts(data.products)).catch(() => undefined);
    return () => controller.abort();
  }, [ids.length]);

  if (!ids.length || pathname.startsWith("/compare")) return null;
  const selected = ids.map((id) => products.find((product) => product.stableSlug === id)).filter(Boolean) as CatalogProduct[];

  return (
    <div className="cmpbar verified-compare-bar" role="region" aria-label="So sánh sản phẩm đã xác minh">
      <div className="cmpbar-in">
        <div className="cmpbar-lab"><b>So sánh đã xác minh</b><span>{ids.length}/{CATALOG_COMPARE_MAX}</span></div>
        <div className="cmpbar-chips">
          {selected.map((product) => (
            <span className="cmpchip" key={product.stableSlug}>
              <span className="cmpchip-t"><b>{product.providerName.vi}</b><small>{product.productName.vi}</small></span>
              <button className="cmpchip-x" onClick={() => removeCatalogCompare(product.stableSlug)} aria-label="Bỏ khỏi so sánh">×</button>
            </span>
          ))}
          {Array.from({ length: CATALOG_COMPARE_MAX - ids.length }).map((_, index) => <span className="cmpchip cmpchip-ghost" key={index}>Chọn thêm</span>)}
        </div>
        <div className="cmpbar-act">
          <button className="btn btn-ghost btn-sm" onClick={clearCatalogCompare}>Xóa</button>
          <button className="btn btn-green btn-sm" disabled={ids.length < 2} onClick={() => router.push("/compare")}>{ids.length < 2 ? "Chọn 2 sản phẩm" : "Mở so sánh"}</button>
        </div>
      </div>
    </div>
  );
}
