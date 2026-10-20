"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TurnstileWidget from "./TurnstileWidget";
import { useI18n } from "@/i18n/I18nProvider";
import { fetchPublicCatalog, formatVnd } from "@/lib/catalog/client";
import { localizedText } from "@/lib/catalog/types";
import type { CatalogProduct } from "@/lib/catalog/types";

type LeadResult = { publicId: string; uploadTokens?: { front: string; back: string; expiresAt: string } };
const ALLOWED_SOURCES = new Set(["banner", "card", "detail", "ai", "market", "human", "checklist", "calculator", "organic"]);

export default function RegistrationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, t } = useI18n();
  const rawSource = searchParams.get("source") ?? "organic";
  const source = ALLOWED_SOURCES.has(rawSource) ? rawSource : "organic";
  const [form, setForm] = useState({ fullName: "", phone: "", province: "Đà Nẵng", amountVnd: searchParams.get("amountVnd") ?? "", termMonths: searchParams.get("termMonths") ?? "", note: searchParams.get("note") ?? "" });
  const [consent, setConsent] = useState(false);
  const [documentConsent, setDocumentConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [documentEnabled, setDocumentEnabled] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<LeadResult | null>(null);
  const [uploadedSides, setUploadedSides] = useState<Record<"front" | "back", boolean>>({ front: false, back: false });
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const productId = searchParams.get("productId");
  const providerId = searchParams.get("providerId");
  const campaign = searchParams.get("campaign");

  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    fetchPublicCatalog(controller.signal)
      .then((catalog) => setSelectedProduct(catalog.products.find((product) => product.productId === productId && (!providerId || product.providerId === providerId)) ?? null))
      .catch(() => setSelectedProduct(null));
    return () => controller.abort();
  }, [productId, providerId]);

  useEffect(() => {
    fetch("/api/health").then((response) => response.json() as Promise<{ checks?: { telegramDocuments?: boolean } }>).then((data) => setDocumentEnabled(Boolean(data.checks?.telegramDocuments))).catch(() => undefined);
  }, []);

  const setField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!consent || status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      const idempotencyKey = idempotencyKeyRef.current ?? (idempotencyKeyRef.current = crypto.randomUUID());
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          province: form.province,
          productId: searchParams.get("productId"),
          providerId: searchParams.get("providerId"),
          loanType: searchParams.get("loanType"),
          amountVnd: form.amountVnd ? Number(form.amountVnd.replace(/\D/g, "")) : null,
          termMonths: form.termMonths ? Number(form.termMonths.replace(/\D/g, "")) : null,
          note: form.note || null,
          source,
          campaign: searchParams.get("campaign"),
          consentContact: consent,
          consentProcessingNotice: consent,
          consentDocumentUpload: documentConsent,
          consentTelegramDocument: documentConsent,
          turnstileToken,
        }),
      });
      const data = (await response.json()) as { lead?: LeadResult; error?: string };
      if (!response.ok || !data.lead) throw new Error(data.error ?? "lead_failed");
      setResult(data.lead);
      setStatus("success");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Không thể lưu yêu cầu.");
      setStatus("error");
    }
  };

  const upload = useCallback(async (side: "front" | "back", file: File) => {
    if (!result?.uploadTokens) return;
    const body = new FormData();
    body.set("publicId", result.publicId);
    body.set("side", side);
    body.set("uploadToken", result.uploadTokens[side]);
    body.set("file", file);
    const response = await fetch("/api/leads/documents", { method: "POST", body });
    if (!response.ok) {
      setError("Telegram chưa xác nhận việc nhận ảnh. Ảnh chưa được báo là thành công; vui lòng thử lại trước khi token hết hạn.");
      return;
    }
    setUploadedSides((current) => ({ ...current, [side]: true }));
  }, [result]);

  const removeDocument = useCallback(async (side: "front" | "back") => {
    if (!result?.uploadTokens) return;
    const response = await fetch("/api/leads/documents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId: result.publicId, side, uploadToken: result.uploadTokens[side] }),
    });
    if (!response.ok) {
      setError("Không thể xóa giấy tờ ngay lúc này. Vui lòng thử lại.");
      return;
    }
    setUploadedSides((current) => ({ ...current, [side]: false }));
  }, [result]);

  if (status === "success" && result) {
    return <section className="pageview on"><div className="wrap"><div className="registration-success"><div className="hm-done-ic">✓</div><h2>Đã ghi nhận yêu cầu</h2><p>Mã yêu cầu của bạn: <b>{result.publicId}</b>. Nhân viên sẽ liên hệ theo số bạn đã cung cấp. Đây chưa phải là phê duyệt khoản vay.</p>{result.uploadTokens && <div className="document-upload"><b>Gửi CCCD hai mặt qua Telegram</b><small>Bytes ảnh gốc được gửi trực tiếp bằng Telegram Bot, không lưu ảnh trong D1 hay Worker. Mỗi mặt chỉ được báo thành công sau khi Telegram xác nhận; token hết hạn sau 30 phút.</small>{(["front", "back"] as const).map((side) => <div className="document-upload-row" key={side}><label>{side === "front" ? "CCCD mặt trước" : "CCCD mặt sau"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadedSides[side]} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(side, file); }} /></label>{uploadedSides[side] && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void removeDocument(side)}>Xóa metadata mặt này</button>}</div>)}</div>}{error && <p className="form-error">{error}</p>}<button className="btn btn-green" onClick={() => router.push("/chat")}>Tiếp tục với AI</button></div></div></section>;
  }

  return <section className="pageview on"><div className="wrap"><button className="linkback" onClick={() => router.back()}>← Quay lại</button><div className="surv-hero"><div><span className="sec-tag">Đăng ký tư vấn</span><h2>Để nhân viên kiểm tra khoản vay phù hợp</h2><p>Thông tin liên hệ được lưu trong lead bảo mật; không gửi số điện thoại đầy đủ vào AI hoặc Telegram.</p></div></div><ol className="registration-steps" aria-label="Registration steps"><li className="on"><span>1</span>{t("register_step_loan")}</li><li className="on"><span>2</span>{t("register_step_contact")}</li><li><span>3</span>{t("register_step_done")}</li></ol>{(productId || form.amountVnd || form.termMonths || campaign) && <div className="registration-context"><b>{t("register_context_title")}</b>{selectedProduct ? <span>{localizedText(selectedProduct.providerName, lang)} · {localizedText(selectedProduct.productName, lang)}</span> : <span>{t("register_context_unknown")}</span>}<div className="registration-context-facts">{form.amountVnd && <span>{t("register_context_amount")}: <b>{formatVnd(Number(form.amountVnd))}</b></span>}{form.termMonths && <span>{t("register_context_term")}: <b>{form.termMonths} tháng</b></span>}{campaign && <span>{t("register_context_source")}: <b>{campaign}</b></span>}</div></div>}<form className="registration-form" onSubmit={submit}><div className="registration-grid"><label className="fq"><span>Họ và tên *</span><input required value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} autoComplete="name" /></label><label className="fq"><span>Số điện thoại *</span><input required type="tel" inputMode="tel" value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="09xx xxx xxx" autoComplete="tel" /></label><label className="fq"><span>Tỉnh/thành phố *</span><input required value={form.province} onChange={(event) => setField("province", event.target.value)} autoComplete="address-level1" /></label><label className="fq"><span>Số tiền dự kiến</span><input inputMode="numeric" value={form.amountVnd ? new Intl.NumberFormat("vi-VN").format(Number(form.amountVnd)) : ""} onChange={(event) => setField("amountVnd", event.target.value.replace(/\D/g, ""))} placeholder="VND" /></label><label className="fq"><span>Thời hạn</span><input inputMode="numeric" value={form.termMonths} onChange={(event) => setField("termMonths", event.target.value.replace(/\D/g, ""))} placeholder="Tháng" /></label></div><label className="fq"><span>Ghi chú</span><textarea rows={4} value={form.note} onChange={(event) => setField("note", event.target.value)} maxLength={1000} /></label><label className="consent-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>Tôi đồng ý để vaytiendanang liên hệ và xử lý thông tin theo <a href="/privacy" target="_blank">thông báo quyền riêng tư</a>.</span></label>{documentEnabled && <label className="consent-row"><input type="checkbox" checked={documentConsent} onChange={(event) => setDocumentConsent(event.target.checked)} /><span>Tôi đồng ý riêng để gửi ảnh CCCD hai mặt qua Telegram Bot cho nhân viên xử lý hồ sơ. Tôi hiểu Telegram Bot không mã hóa đầu cuối và ảnh đã gửi không bảo đảm thu hồi được. <a href="/privacy" target="_blank">Xem thông báo quyền riêng tư</a>.</span></label>}<TurnstileWidget onToken={setTurnstileToken} />{error && <p className="form-error">{error}</p>}<button className="btn btn-green" disabled={!consent || status === "sending"}>{status === "sending" ? "Đang lưu…" : "Gửi yêu cầu tư vấn"}</button><small className="form-footnote">Không có dữ liệu giả và không có cam kết được duyệt. Nếu nguồn lãi suất chưa đủ, hệ thống sẽ nói rõ.</small></form></div></section>;
}
