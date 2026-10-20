"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { calculateCatalogProduct } from "@/lib/finance/catalogCalculation";
import { fetchPublicCatalog, formatDate, formatVnd, rateLabel } from "@/lib/catalog/client";
import { localizedText } from "@/lib/catalog/types";
import type { CatalogProduct } from "@/lib/catalog/types";
import type { RepaymentMethod } from "@/lib/finance/loanMath";

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function displayNumber(value: string): string {
  if (!value) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? new Intl.NumberFormat("vi-VN").format(parsed) : "";
}

function within(value: number, min: number | null, max: number | null): boolean {
  return value > 0 && (min == null || value >= min) && (max == null || value <= max);
}

export default function LoanEstimator() {
  const { lang, t } = useI18n();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState("");
  const [term, setTerm] = useState("");
  const [method, setMethod] = useState<RepaymentMethod>("annuity");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicCatalog(controller.signal)
      .then((catalog) => setProducts(catalog.products.filter((product) => product.status === "verified")))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const selected = products.find((product) => product.stableSlug === selectedId) ?? null;
  useEffect(() => {
    if (!selected && products[0]) setSelectedId(products[0].stableSlug);
  }, [products, selected]);

  useEffect(() => {
    if (!selected) return;
    setAmount(selected.minAmountVnd != null ? String(selected.minAmountVnd) : "");
    setTerm(selected.minTermMonths != null ? String(selected.minTermMonths) : "");
  }, [selected]);

  const amountNumber = Number(amount);
  const termNumber = Number(term);
  const amountValid = Boolean(selected && within(amountNumber, selected.minAmountVnd, selected.maxAmountVnd));
  const termValid = Boolean(selected && Number.isInteger(termNumber) && within(termNumber, selected.minTermMonths, selected.maxTermMonths));
  const calculation = useMemo(() => {
    if (!selected || selected.status !== "verified" || !amountValid || !termValid) return null;
    try {
      return calculateCatalogProduct({ product: selected, principalVnd: amountNumber, termMonths: termNumber, method });
    } catch {
      return null;
    }
  }, [amountNumber, amountValid, method, selected, termNumber, termValid]);

  const amountRangeReady = Boolean(selected?.minAmountVnd != null && selected.maxAmountVnd != null && selected.maxAmountVnd > selected.minAmountVnd!);
  const termRangeReady = Boolean(selected?.minTermMonths != null && selected.maxTermMonths != null && selected.maxTermMonths > selected.minTermMonths!);
  const calculatorHref = selected
    ? `/register?source=calculator&campaign=estimator&productId=${encodeURIComponent(selected.productId)}&providerId=${encodeURIComponent(selected.providerId)}&loanType=${encodeURIComponent(selected.category)}&amountVnd=${encodeURIComponent(amount)}&termMonths=${encodeURIComponent(term)}`
    : `/register?source=calculator&campaign=estimator&amountVnd=${encodeURIComponent(amount)}&termMonths=${encodeURIComponent(term)}`;
  const aiHref = selected
    ? `/chat?q=${encodeURIComponent(t("estimator_ask_ai"))}&productId=${encodeURIComponent(selected.productId)}&providerId=${encodeURIComponent(selected.providerId)}&loanType=${encodeURIComponent(selected.category)}&amountVnd=${encodeURIComponent(amount)}&termMonths=${encodeURIComponent(term)}`
    : "/chat";
  const result = calculation?.calculation;

  return (
    <section className="loan-estimator-section section" aria-label={t("estimator_aria")}>
      <div className="wrap">
        <div className="loan-estimator-card">
          <div className="loan-estimator-heading">
            <span className="sec-tag">{t("estimator_tag")}</span>
            <h2>{t("estimator_title")}</h2>
            <p>{t("estimator_subtitle")}</p>
          </div>

          <div className="loan-estimator-grid">
            <div className="loan-estimator-controls">
              <label className="fq"><span>{t("estimator_product")}</span>
                <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={loading || products.length === 0}>
                  <option value="">{loading ? t("estimator_loading") : products.length ? t("estimator_choose_product") : t("estimator_no_products")}</option>
                  {products.map((product) => <option key={product.stableSlug} value={product.stableSlug}>{localizedText(product.providerName, lang)} · {localizedText(product.productName, lang)}</option>)}
                </select>
              </label>

              <label className="fq"><span>{t("estimator_amount")}</span>
                <input inputMode="numeric" value={displayNumber(amount)} onChange={(event) => setAmount(digits(event.target.value))} placeholder="—" />
              </label>
              <input className="loan-estimator-range" type="range" min={selected?.minAmountVnd ?? 0} max={selected?.maxAmountVnd ?? 0} step="100000" value={amountNumber || selected?.minAmountVnd || 0} disabled={!amountRangeReady} onChange={(event) => setAmount(event.target.value)} aria-label={t("estimator_amount")} />
              {selected && <small className="loan-estimator-range-note">{formatVnd(selected.minAmountVnd)} – {formatVnd(selected.maxAmountVnd)}</small>}

              <label className="fq"><span>{t("estimator_term")}</span>
                <input inputMode="numeric" value={term} onChange={(event) => setTerm(digits(event.target.value))} placeholder="—" />
              </label>
              <input className="loan-estimator-range" type="range" min={selected?.minTermMonths ?? 0} max={selected?.maxTermMonths ?? 0} step="1" value={termNumber || selected?.minTermMonths || 0} disabled={!termRangeReady} onChange={(event) => setTerm(event.target.value)} aria-label={t("estimator_term")} />
              {selected && <small className="loan-estimator-range-note">{selected.minTermMonths ?? "—"} – {selected.maxTermMonths ?? "—"} tháng</small>}

              <fieldset className="loan-methods">
                <legend>{t("estimator_method")}</legend>
                <label><input type="radio" name="repayment-method" checked={method === "annuity"} onChange={() => setMethod("annuity")} /> {t("estimator_annuity")}</label>
                <label><input type="radio" name="repayment-method" checked={method === "equal-principal"} onChange={() => setMethod("equal-principal")} /> {t("estimator_equal_principal")}</label>
              </fieldset>
            </div>

            <div className="loan-estimator-result" aria-live="polite">
              {selected && <div className="loan-estimator-selected"><b>{localizedText(selected.providerName, lang)}</b><span>{localizedText(selected.productName, lang)}</span></div>}
              {result ? (
                <>
                  <div className="loan-result-primary"><span>{t("estimator_result_first")}</span><strong>{formatVnd(result.firstPaymentVnd)}</strong></div>
                  <div className="loan-result-facts">
                    <div><span>{t("estimator_result_total_interest")}</span><b>{formatVnd(result.totalInterestVnd)}</b></div>
                    <div><span>{t("estimator_result_fees")}</span><b>{result.totalFeesVnd == null ? t("estimator_not_published") : formatVnd(result.totalFeesVnd)}</b></div>
                    <div><span>{t("estimator_result_total")}</span><b>{result.totalRepaymentVnd == null ? t("estimator_not_published") : formatVnd(result.totalRepaymentVnd)}</b></div>
                  </div>
                  {selected && <p className="loan-estimator-source">{rateLabel(selected)} · {t("estimator_source")}: {formatDate(selected.verifiedAt ?? selected.observedAt)}</p>}
                </>
              ) : (
                <div className="loan-estimator-empty">
                  <strong>{products.length === 0 ? t("estimator_no_products") : t("estimator_unavailable")}</strong>
                  <span>{selected && (!amountValid || !termValid) ? t("estimator_need_bounds") : t("estimator_disclaimer")}</span>
                </div>
              )}
              <div className="loan-estimator-actions">
                <a className="btn btn-green" href={calculatorHref}>{t("estimator_register")}</a>
                <a className="btn btn-ghost" href={aiHref}>{t("estimator_ask_ai")}</a>
              </div>
              <small className="loan-estimator-disclaimer">{t("estimator_disclaimer")}</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
