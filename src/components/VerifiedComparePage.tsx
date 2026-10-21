"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchPublicCatalog, formatVnd, primaryRate, rateLabel } from "@/lib/catalog/client";
import {
  CATALOG_COMPARE_MAX,
  clearCatalogCompare,
  removeCatalogCompare,
  useCatalogCompare,
} from "@/lib/catalog/compareStore";
import { calculateCatalogProduct } from "@/lib/finance/catalogCalculation";
import type { CatalogProduct } from "@/lib/catalog/types";

const digits = (value: string) => value.replace(/\D/g, "");

export default function VerifiedComparePage() {
  const router = useRouter();
  const ids = useCatalogCompare();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [amount, setAmount] = useState("100000000");
  const [term, setTerm] = useState("24");

  useEffect(() => {
    fetchPublicCatalog().then((data) => setProducts(data.products)).catch(() => setProducts([]));
  }, []);

  const selected = useMemo(() => ids.map((id) => products.find((product) => product.stableSlug === id)).filter(Boolean) as CatalogProduct[], [ids, products]);
  const calculations = useMemo(() => selected.map((product) => calculateCatalogProduct({ product, principalVnd: Math.max(1, Number(amount) || 1), termMonths: Math.max(1, Number(term) || 1) })), [amount, selected, term]);

  if (selected.length < 2) {
    return <section className="pageview on"><div className="wrap"><button className="linkback" onClick={() => router.push("/#markets")}>← Catalog</button><div className="empty" style={{ marginTop: 30 }}><div className="empty-ic">⚖️</div><div className="empty-t">Chọn ít nhất 2 sản phẩm đã xác minh</div><div className="empty-d">So sánh chỉ dùng cùng số tiền, thời hạn và cách tính đã được công bố; chưa đủ dữ liệu thì không xếp hạng.</div><button className="btn btn-green btn-sm" onClick={() => router.push("/#markets")}>Mở catalog</button></div></div></section>;
  }

  return (
    <section className="pageview on"><div className="wrap">
      <button className="linkback" onClick={() => router.push("/#markets")}>← Catalog</button>
      <div className="surv-hero has-aside"><div><span className="sec-tag">So sánh đã xác minh</span><h2>Đặt các khoản vay trên cùng giả định</h2><p>Không có dữ liệu đủ căn cứ sẽ hiển thị là chưa tính được, không tự thay bằng lãi suất minh họa.</p></div><div className="cmp-assume"><div className="glab">Giả định chung</div><label className="fq"><span>Số tiền (VND)</span><input inputMode="numeric" value={Number(amount).toLocaleString("vi-VN")} onChange={(event) => setAmount(digits(event.target.value))} /></label><label className="fq"><span>Thời hạn (tháng)</span><input inputMode="numeric" value={term} onChange={(event) => setTerm(digits(event.target.value))} /></label></div></div>
      <div className="cmp-scroll"><table className="cmp-table verified-comparison"><thead><tr><th className="cmp-rowhead">Chỉ số</th>{selected.map((product) => <th key={product.stableSlug}><div className="cmp-col"><div className="cmp-colbar" style={{ background: "#00A863" }} /><b>{product.providerName.vi}</b><small>{product.productName.vi}</small><button className="cmp-rm" onClick={() => removeCatalogCompare(product.stableSlug)}>Bỏ chọn</button></div></th>)}</tr></thead><tbody>
        <tr><th className="cmp-rowhead">Lãi suất nguồn</th>{selected.map((product) => <td key={product.stableSlug}><span className="cmp-big g">{rateLabel(product)}</span><small className="cmp-sub">{primaryRate(product)?.basis ?? "Chưa có cơ sở"}</small></td>)}</tr>
        <tr><th className="cmp-rowhead">Hạn mức</th>{selected.map((product) => <td key={product.stableSlug}>{formatVnd(product.maxAmountVnd)}</td>)}</tr>
        <tr><th className="cmp-rowhead">Thời hạn nguồn</th>{selected.map((product) => <td key={product.stableSlug}>{product.minTermMonths ?? "—"}–{product.maxTermMonths ?? "—"} tháng</td>)}</tr>
        <tr><th className="cmp-rowhead">Kỳ trả đầu</th>{calculations.map((calculation) => <td key={calculation.productId}>{calculation.calculation?.firstPaymentVnd == null ? "Chưa đủ dữ liệu" : `${calculation.calculation.firstPaymentVnd.toLocaleString("vi-VN")} đ`}</td>)}</tr>
        <tr><th className="cmp-rowhead">Tổng trả</th>{calculations.map((calculation) => <td key={calculation.productId}>{calculation.calculation?.totalRepaymentVnd == null ? "Chưa tính (thiếu phí)" : `${calculation.calculation.totalRepaymentVnd.toLocaleString("vi-VN")} đ`}</td>)}</tr>
        <tr><th className="cmp-rowhead">Nguồn quan sát</th>{selected.map((product) => <td key={product.stableSlug}>{product.observedAt ? new Date(product.observedAt).toLocaleDateString("vi-VN") : "Chưa có"}</td>)}</tr>
        <tr><th className="cmp-rowhead">Hành động</th>{selected.map((product) => <td key={product.stableSlug}><button className="btn btn-green btn-sm" onClick={() => router.push(`/register?source=card&productId=${encodeURIComponent(product.productId)}&providerId=${encodeURIComponent(product.providerId)}`)}>Đăng ký tư vấn</button></td>)}</tr>
      </tbody></table></div>
      <div className="cmp-foot"><span>{selected.length}/{CATALOG_COMPARE_MAX} sản phẩm</span><button className="btn btn-ghost btn-sm" onClick={clearCatalogCompare}>Xóa lựa chọn</button></div>
    </div></section>
  );
}
