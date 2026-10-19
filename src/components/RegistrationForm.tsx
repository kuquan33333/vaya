"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TurnstileWidget from "./TurnstileWidget";

type LeadResult = { publicId: string; uploadTokens?: { front: string; back: string; expiresAt: string } };
const ALLOWED_SOURCES = new Set(["banner", "card", "detail", "ai", "market", "human", "checklist", "organic"]);

export default function RegistrationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/health").then((response) => response.json() as Promise<{ checks?: { documentStorage?: boolean } }>).then((data) => setDocumentEnabled(Boolean(data.checks?.documentStorage))).catch(() => undefined);
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
      setError("Không thể lưu giấy tờ riêng tư. Vui lòng thử lại trước khi token hết hạn.");
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
    return <section className="pageview on"><div className="wrap"><div className="registration-success"><div className="hm-done-ic">✓</div><h2>Đã ghi nhận yêu cầu</h2><p>Mã yêu cầu của bạn: <b>{result.publicId}</b>. Nhân viên sẽ liên hệ theo số bạn đã cung cấp. Đây chưa phải là phê duyệt khoản vay.</p>{result.uploadTokens && <div className="document-upload"><b>Tải giấy tờ tùy chọn</b><small>Ảnh CCCD chỉ được lưu trong R2 private sau khi bạn đồng ý; hệ thống loại bỏ metadata phổ biến và token hết hạn sau 30 phút.</small>{(["front", "back"] as const).map((side) => <div className="document-upload-row" key={side}><label>{side === "front" ? "CCCD mặt trước" : "CCCD mặt sau"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadedSides[side]} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(side, file); }} /></label>{uploadedSides[side] && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void removeDocument(side)}>Xóa mặt này</button>}</div>)}</div>}{error && <p className="form-error">{error}</p>}<button className="btn btn-green" onClick={() => router.push("/chat")}>Tiếp tục với AI</button></div></div></section>;
  }

  return <section className="pageview on"><div className="wrap"><button className="linkback" onClick={() => router.back()}>← Quay lại</button><div className="surv-hero"><div><span className="sec-tag">Đăng ký tư vấn</span><h2>Để nhân viên kiểm tra khoản vay phù hợp</h2><p>Thông tin được lưu vào hệ thống lead bảo mật. Không gửi số điện thoại hoặc giấy tờ vào mô hình AI hay Telegram.</p></div></div><form className="registration-form" onSubmit={submit}><div className="registration-grid"><label className="fq"><span>Họ và tên *</span><input required value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} /></label><label className="fq"><span>Số điện thoại *</span><input required type="tel" inputMode="tel" value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="09xx xxx xxx" /></label><label className="fq"><span>Tỉnh/thành phố *</span><input required value={form.province} onChange={(event) => setField("province", event.target.value)} /></label><label className="fq"><span>Số tiền dự kiến</span><input inputMode="numeric" value={form.amountVnd} onChange={(event) => setField("amountVnd", event.target.value.replace(/\D/g, ""))} placeholder="VND" /></label><label className="fq"><span>Thời hạn</span><input inputMode="numeric" value={form.termMonths} onChange={(event) => setField("termMonths", event.target.value.replace(/\D/g, ""))} placeholder="Tháng" /></label></div><label className="fq"><span>Ghi chú</span><textarea rows={4} value={form.note} onChange={(event) => setField("note", event.target.value)} maxLength={1000} /></label><label className="consent-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>Tôi đồng ý để vaytiendanang liên hệ và xử lý thông tin theo <a href="/privacy" target="_blank">thông báo quyền riêng tư</a>.</span></label>{documentEnabled && <label className="consent-row"><input type="checkbox" checked={documentConsent} onChange={(event) => setDocumentConsent(event.target.checked)} /><span>Tôi đồng ý riêng cho việc tải CCCD lên kho R2 private để nhân viên kiểm tra hồ sơ.</span></label>}<TurnstileWidget onToken={setTurnstileToken} />{error && <p className="form-error">{error}</p>}<button className="btn btn-green" disabled={!consent || status === "sending"}>{status === "sending" ? "Đang lưu…" : "Gửi yêu cầu tư vấn"}</button><small className="form-footnote">Không có dữ liệu giả và không có cam kết được duyệt. Nếu nguồn lãi suất chưa đủ, hệ thống sẽ nói rõ.</small></form></div></section>;
}
