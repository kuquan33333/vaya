"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TurnstileWidget from "./TurnstileWidget";
import { useI18n } from "@/i18n/I18nProvider";
import { fetchPublicCatalog } from "@/lib/catalog/client";
import { localizedText } from "@/lib/catalog/types";
import type { CatalogProduct } from "@/lib/catalog/types";

type LeadResult = {
  publicId: string;
  uploadTokens?: { front: string; back: string; expiresAt: string };
};

const ALLOWED_SOURCES = new Set([
  "banner",
  "card",
  "detail",
  "ai",
  "market",
  "human",
  "checklist",
  "calculator",
  "organic",
]);

function numberValue(value: string): number | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export default function RegistrationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, t } = useI18n();
  const rawSource = searchParams.get("source") ?? "organic";
  const source = ALLOWED_SOURCES.has(rawSource) ? rawSource : "organic";
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    province: "Đà Nẵng",
    amountVnd: searchParams.get("amountVnd") ?? "",
    termMonths: searchParams.get("termMonths") ?? "",
    note: searchParams.get("note") ?? "",
  });
  const [consent, setConsent] = useState(false);
  const [documentConsent, setDocumentConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [documentEnabled, setDocumentEnabled] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<LeadResult | null>(null);
  const [uploadedSides, setUploadedSides] = useState<Record<"front" | "back", boolean>>({
    front: false,
    back: false,
  });
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const productId = searchParams.get("productId");
  const providerId = searchParams.get("providerId");
  const campaign = searchParams.get("campaign");

  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    fetchPublicCatalog(controller.signal)
      .then((catalog) =>
        setSelectedProduct(
          catalog.products.find(
            (product) =>
              product.productId === productId &&
              (!providerId || product.providerId === providerId),
          ) ?? null,
        ),
      )
      .catch(() => setSelectedProduct(null));
    return () => controller.abort();
  }, [productId, providerId]);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json() as Promise<{ checks?: { telegramDocuments?: boolean } }>)
      .then((data) => setDocumentEnabled(Boolean(data.checks?.telegramDocuments)))
      .catch(() => setDocumentEnabled(false));
  }, []);

  const setField = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!consent || status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      const idempotencyKey =
        idempotencyKeyRef.current ??
        (idempotencyKeyRef.current = crypto.randomUUID());
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          province: form.province,
          productId,
          providerId,
          loanType: searchParams.get("loanType"),
          amountVnd: numberValue(form.amountVnd),
          termMonths: numberValue(form.termMonths),
          note: form.note || null,
          source,
          campaign,
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
    } catch {
      setError(t("register_error_submit"));
      setStatus("error");
    }
  };

  const upload = useCallback(
    async (side: "front" | "back", file: File) => {
      if (!result?.uploadTokens) {
        setError(t("register_document_upload_failed"));
        return;
      }
      const body = new FormData();
      body.set("publicId", result.publicId);
      body.set("side", side);
      body.set("uploadToken", result.uploadTokens[side]);
      body.set("file", file);
      const response = await fetch("/api/leads/documents", { method: "POST", body });
      if (!response.ok) {
        setError(t("register_document_upload_failed"));
        return;
      }
      setUploadedSides((current) => ({ ...current, [side]: true }));
    },
    [result, t],
  );

  const removeDocument = useCallback(
    async (side: "front" | "back") => {
      if (!result?.uploadTokens) return;
      const response = await fetch("/api/leads/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: result.publicId,
          side,
          uploadToken: result.uploadTokens[side],
        }),
      });
      if (!response.ok) {
        setError(t("register_document_remove_failed"));
        return;
      }
      setUploadedSides((current) => ({ ...current, [side]: false }));
    },
    [result, t],
  );

  if (status === "success" && result) {
    return (
      <section className="pageview on">
        <div className="wrap">
          <div className="registration-success">
            <div className="hm-done-ic">✓</div>
            <h2>{t("register_success_title")}</h2>
            <p>
              {t("register_success_prefix")} <b>{result.publicId}</b>. {t("register_success_next")}
            </p>
            {result.uploadTokens && (
              <div className="document-upload">
                <b>{t("register_document_title")}</b>
                <small>{t("register_document_description")}</small>
                {(["front", "back"] as const).map((side) => (
                  <div className="document-upload-row" key={side}>
                    <label>
                      {t(side === "front" ? "register_document_front" : "register_document_back")}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={uploadedSides[side]}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void upload(side, file);
                        }}
                      />
                    </label>
                    {uploadedSides[side] && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => void removeDocument(side)}
                      >
                        {t("register_document_remove")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-green" onClick={() => router.push("/chat")}>
              {t("register_continue_ai")}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const locale = lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US";
  const formattedAmount = form.amountVnd
    ? new Intl.NumberFormat(locale).format(Number(form.amountVnd))
    : "";

  return (
    <section className="pageview on">
      <div className="wrap">
        <button className="linkback" onClick={() => router.back()}>
          ← {t("register_back")}
        </button>
        <div className="surv-hero">
          <div>
            <span className="sec-tag">{t("register_tag")}</span>
            <h2>{t("register_title")}</h2>
            <p>{t("register_description")}</p>
          </div>
        </div>
        <ol className="registration-steps" aria-label={t("register_steps_aria")}>
          <li className="on"><span>1</span>{t("register_step_loan")}</li>
          <li className="on"><span>2</span>{t("register_step_contact")}</li>
          <li><span>3</span>{t("register_step_done")}</li>
        </ol>
        {(productId || form.amountVnd || form.termMonths || campaign) && (
          <div className="registration-context">
            <b>{t("register_context_title")}</b>
            {selectedProduct ? (
              <span>
                {localizedText(selectedProduct.providerName, lang)} · {localizedText(selectedProduct.productName, lang)}
              </span>
            ) : (
              <span>{t("register_context_unknown")}</span>
            )}
            <div className="registration-context-facts">
              {form.amountVnd && (
                <span>
                  {t("register_context_amount")}: <b>{new Intl.NumberFormat(locale).format(Number(form.amountVnd))} VND</b>
                </span>
              )}
              {form.termMonths && (
                <span>
                  {t("register_context_term")}: <b>{form.termMonths} {t("register_term")}</b>
                </span>
              )}
              {campaign && (
                <span>
                  {t("register_context_source")}: <b>{campaign}</b>
                </span>
              )}
            </div>
          </div>
        )}
        <form className="registration-form" onSubmit={submit}>
          <div className="registration-grid">
            <label className="fq">
              <span>{t("register_full_name")}</span>
              <input
                required
                value={form.fullName}
                onChange={(event) => setField("fullName", event.target.value)}
                autoComplete="name"
              />
            </label>
            <label className="fq">
              <span>{t("register_phone")}</span>
              <input
                required
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(event) => setField("phone", event.target.value)}
                placeholder={t("register_phone_placeholder")}
                autoComplete="tel"
              />
            </label>
            <label className="fq">
              <span>{t("register_province")}</span>
              <input
                required
                value={form.province}
                onChange={(event) => setField("province", event.target.value)}
                autoComplete="address-level1"
              />
            </label>
            <label className="fq">
              <span>{t("register_amount")}</span>
              <input
                inputMode="numeric"
                value={formattedAmount}
                onChange={(event) => setField("amountVnd", event.target.value.replace(/\D/g, ""))}
                placeholder={t("register_amount_placeholder")}
              />
            </label>
            <label className="fq">
              <span>{t("register_term")}</span>
              <input
                inputMode="numeric"
                value={form.termMonths}
                onChange={(event) => setField("termMonths", event.target.value.replace(/\D/g, ""))}
                placeholder={t("register_term_placeholder")}
              />
            </label>
          </div>
          <label className="fq">
            <span>{t("register_note")}</span>
            <textarea rows={4} value={form.note} onChange={(event) => setField("note", event.target.value)} maxLength={1000} />
          </label>
          <label className="consent-row">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
            <span>
              {t("register_consent_prefix")} <a href="/privacy" target="_blank" rel="noreferrer">{t("register_privacy_link")}</a>.
            </span>
          </label>
          {documentEnabled && (
            <label className="consent-row">
              <input type="checkbox" checked={documentConsent} onChange={(event) => setDocumentConsent(event.target.checked)} />
              <span>
                {t("register_document_consent")} <a href="/privacy" target="_blank" rel="noreferrer">{t("register_document_privacy_link")}</a>.
              </span>
            </label>
          )}
          <TurnstileWidget onToken={setTurnstileToken} />
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-green" disabled={!consent || status === "sending"}>
            {status === "sending" ? t("register_sending") : t("register_submit")}
          </button>
          <small className="form-footnote">{t("register_footnote")}</small>
        </form>
      </div>
    </section>
  );
}
