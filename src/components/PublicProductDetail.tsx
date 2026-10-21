"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { calculateCatalogProduct } from "@/lib/finance/catalogCalculation";
import { formatDate, formatVnd, primaryRate, rateLabel } from "@/lib/catalog/client";
import { toggleCatalogCompare, useCatalogCompare } from "@/lib/catalog/compareStore";
import type { CatalogProduct } from "@/lib/catalog/types";
import VerifiedRateHistoryChart from "./VerifiedRateHistoryChart";

function basisLabel(basis: string): string {
  if (basis === "annual-nominal-reducing-balance") return "%/năm, dư nợ giảm dần";
  if (basis === "annual-nominal-original-principal") return "%/năm, dư nợ gốc";
  if (basis === "monthly-flat") return "%/tháng, dư nợ gốc";
  return basis;
}

export default function PublicProductDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const { lang } = useI18n();
  const selected = useCatalogCompare();
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [amount, setAmount] = useState("");
  const [term, setTerm] = useState("");

  useEffect(() => {
    fetch(`/api/products/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("not_found");
        return (await response.json()) as CatalogProduct;
      })
      .then((value) => {
        setProduct(value);
        setAmount(value.minAmountVnd != null ? String(value.minAmountVnd) : "");
        setTerm(value.minTermMonths != null ? String(value.minTermMonths) : "");
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [slug]);

  const amountNumber = Number(amount);
  const termNumber = Number(term);
  const amountValid = Boolean(product && amountNumber > 0 && (product.minAmountVnd == null || amountNumber >= product.minAmountVnd) && (product.maxAmountVnd == null || amountNumber <= product.maxAmountVnd));
  const termValid = Boolean(product && Number.isInteger(termNumber) && termNumber > 0 && (product.minTermMonths == null || termNumber >= product.minTermMonths) && (product.maxTermMonths == null || termNumber <= product.maxTermMonths));
  const calculation = useMemo(() => {
    if (!product || !amountValid || !termValid) return null;
    return calculateCatalogProduct({
      product,
      principalVnd: amountNumber,
      termMonths: termNumber,
    });
  }, [amountNumber, amountValid, product, termNumber, termValid]);

  if (state === "loading") return <section className="pageview on"><div className="wrap" style={{ padding: "70px 0" }}>Đang tải điều khoản đã xác minh…</div></section>;
  if (state === "error" || !product) return <section className="pageview on"><div className="wrap" style={{ padding: "70px 0" }}><h2>Không tìm thấy sản phẩm đã xác minh</h2><p>Sản phẩm chưa được kiểm chứng hoặc đã hết hiệu lực, nên không thể hiển thị thay bằng dữ liệu khác.</p><button className="btn btn-green" onClick={() => router.push("/#markets")}>Quay lại catalog</button></div></section>;

  const rate = primaryRate(product);
  const selectedHere = selected.includes(product.stableSlug);
  const result = calculation?.calculation;
  return (
    <section className="pageview on">
      <div className="wrap public-detail">
        <button className="linkback" onClick={() => router.push("/#markets")}>← Catalog</button>
        <div className="dt-head">
          <div className="dt-logo"><span className="provider-monogram">{product.providerName.vi.slice(0, 2).toUpperCase()}</span></div>
          <div className="dt-h"><span className="dt-type">{product.category}</span><h2>{product.providerName[lang]}</h2><div className="dt-prod">{product.productName[lang]}</div></div>
          <div className="dt-rate"><div className="k">Lãi suất theo nguồn</div><div className="v">{rateLabel(product)}</div></div>
        </div>

        <div className="verified-source-panel">
          <b>Provenance và trạng thái</b>
          <span>Quan sát: {formatDate(product.observedAt)} · Xác minh: {formatDate(product.verifiedAt)}</span>
          <a href={product.sourceUrl} target="_blank" rel="noreferrer">Mở nguồn chính thức ↗</a>
        </div>

        <div className="sm-grid">
          <div className="sm"><div className="smk">Hạn mức tối đa</div><div className="smv">{formatVnd(product.maxAmountVnd)}</div></div>
          <div className="sm"><div className="smk">Thời hạn</div><div className="smv">{product.minTermMonths ?? "—"}–{product.maxTermMonths ?? "—"} tháng</div></div>
          <div className="sm"><div className="smk">Cơ sở lãi</div><div className="smv">{rate ? basisLabel(rate.basis) : "Chưa có"}</div></div>
          <div className="sm"><div className="smk">Mức tin cậy</div><div className="smv">{product.confidence}</div></div>
          <div className="sm"><div className="smk">Phí đã công bố</div><div className="smv">{product.fees.processingFeePercent != null || product.fees.appraisalFeeVnd != null ? "Có, xem điều kiện nguồn" : "Chưa công bố đầy đủ"}</div></div>
        </div>

        <div className="rc-clab">Tính thử theo đúng điều khoản đã công bố</div>
        <div className="verified-calculator">
          <label className="fq"><span>Số tiền (VND)</span><input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} /></label>
          <label className="fq"><span>Thời hạn (tháng)</span><input inputMode="numeric" value={term} onChange={(event) => setTerm(event.target.value.replace(/\D/g, ""))} /></label>
          <div className="verified-calculation-result">
            <span>Khoản trả kỳ đầu</span><b>{result?.firstPaymentVnd == null ? "Không đủ dữ liệu phí" : `${result.firstPaymentVnd.toLocaleString("vi-VN")} đ`}</b>
            <small>{result?.totalRepaymentVnd == null ? "Tổng chi phí chưa tính vì nguồn chưa công bố đầy đủ phí." : `Tổng dự kiến: ${result.totalRepaymentVnd.toLocaleString("vi-VN")} đ`}</small>
          </div>
        </div>

        <div className="rc-clab">Lịch sử lãi suất từ snapshot nguồn</div>
        <VerifiedRateHistoryChart snapshots={product.rateHistory} />

        <div className="dt-actions">
          <div className="dt-act"><div className="dt-act-h">📋 Đăng ký tư vấn khoản này</div><p>Nhân viên sẽ kiểm tra điều kiện thực tế. Gửi yêu cầu không đồng nghĩa được duyệt vay.</p><button className="btn btn-green btn-sm" onClick={() => router.push(`/register?source=detail&productId=${encodeURIComponent(product.productId)}&providerId=${encodeURIComponent(product.providerId)}`)}>Đăng ký tư vấn</button></div>
          <div className="dt-act"><div className="dt-act-h">⇄ So sánh</div><p>{selectedHere ? "Đã có trong danh sách so sánh." : "Chọn tối đa 3 sản phẩm đã xác minh để so sánh cùng một giả định."}</p><button className="btn btn-dark btn-sm" onClick={() => toggleCatalogCompare(product.stableSlug)}>{selectedHere ? "Bỏ khỏi so sánh" : "Thêm vào so sánh"}</button></div>
        </div>
      </div>
    </section>
  );
}
