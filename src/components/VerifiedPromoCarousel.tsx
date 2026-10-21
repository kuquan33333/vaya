"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { fetchPublicCatalog } from "@/lib/catalog/client";
import { localizedText } from "@/lib/catalog/types";
import type { CatalogBanner } from "@/lib/catalog/types";

type ServiceSlide = {
  id: string;
  loanType: string;
  titleKey: string;
  bodyKey: string;
};

/* These are service themes, not loan offers. No rate, limit or approval claim
 * is rendered until a D1 banner has passed the catalog verification workflow. */
const SERVICE_SLIDES: ServiceSlide[] = [
  { id: "cash-loan", loanType: "cash", titleKey: "banner_cash_title", bodyKey: "banner_cash_body" },
  { id: "consumer-loan", loanType: "consumer", titleKey: "banner_consumer_title", bodyKey: "banner_consumer_body" },
  { id: "vehicle-installment", loanType: "vehicle", titleKey: "banner_vehicle_title", bodyKey: "banner_vehicle_body" },
  { id: "loan-advice", loanType: "advice", titleKey: "banner_advice_title", bodyKey: "banner_advice_body" },
];

export default function VerifiedPromoCarousel() {
  const { lang, t } = useI18n();
  const [banners, setBanners] = useState<CatalogBanner[]>([]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [loading, setLoading] = useState(true);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicCatalog(controller.signal)
      .then((catalog) => setBanners(catalog.banners ?? []))
      .catch(() => setBanners([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const slideCount = SERVICE_SLIDES.length + banners.length;
  useEffect(() => {
    if (active >= slideCount) setActive(0);
  }, [active, slideCount]);

  useEffect(() => {
    if (paused || reducedMotion || slideCount < 2) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % slideCount), 6000);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, slideCount]);

  const currentBanner = useMemo(
    () => (active >= SERVICE_SLIDES.length ? banners[active - SERVICE_SLIDES.length] ?? null : null),
    [active, banners],
  );
  const currentService = active < SERVICE_SLIDES.length ? SERVICE_SLIDES[active] : null;
  const move = (delta: number) => {
    if (slideCount < 2) return;
    setActive((index) => (index + delta + slideCount) % slideCount);
    setPaused(true);
  };

  return (
    <section
      className="verified-promo"
      aria-label={t("home_banner_aria")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(event) => { touchStart.current = event.changedTouches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0]?.clientX;
        touchStart.current = null;
        if (start == null || end == null || Math.abs(end - start) < 42) return;
        move(end < start ? 1 : -1);
      }}
    >
      <div className="wrap">
        {currentService ? (
          <div className="home-service-banner" role="group" aria-roledescription="slide" aria-label={`${active + 1}/${slideCount}`}>
            <div className="home-service-copy">
              <span className="sec-tag">{t("home_banner_tag")}</span>
              <h1>{t(currentService.titleKey)}</h1>
              <p>{t(currentService.bodyKey)}</p>
              <ul className="home-service-benefits">
                <li>{t("home_banner_benefit_1")}</li>
                <li>{t("home_banner_benefit_2")}</li>
                <li>{t("home_banner_benefit_3")}</li>
              </ul>
              <div className="home-lead-actions">
                <a className="btn btn-green" href={`/register?source=banner&campaign=${encodeURIComponent(currentService.id)}&loanType=${encodeURIComponent(currentService.loanType)}`}>{t("home_banner_register")}</a>
                <a className="btn btn-ghost" href="#markets">{t("home_banner_explore")}</a>
              </div>
              <small>{loading ? t("home_banner_loading") : t("home_banner_disclaimer")}</small>
            </div>
            <div className="home-service-visual" aria-hidden="true">
              <div className="loan-phone-mockup">
                <div className="loan-phone-top"><span>vaytiendanang</span><i /></div>
                <div className="loan-phone-screen">
                  <b>{t("estimator_title")}</b>
                  <span>{t("estimator_amount")}</span>
                  <strong>—</strong>
                  <span>{t("estimator_term")}</span>
                  <strong>—</strong>
                  <em>{t("estimator_unavailable")}</em>
                </div>
              </div>
              <span className="service-orbit service-orbit-one">₫</span>
              <span className="service-orbit service-orbit-two">↗</span>
            </div>
          </div>
        ) : currentBanner ? (
          <div className="verified-promo-card" role="group" aria-roledescription="slide" aria-label={`${active + 1}/${slideCount}`}>
            <div>
              <span className="sec-tag">{t("promo_source_tag")}</span>
              <h2>{localizedText(currentBanner.title, lang)}</h2>
              <p>{localizedText(currentBanner.body, lang)}</p>
            </div>
            <a className="btn btn-green" href={`/register?source=banner&campaign=${encodeURIComponent(currentBanner.bannerId)}`}>{localizedText(currentBanner.ctaLabel, lang)}</a>
          </div>
        ) : null}

        {slideCount > 1 && (
          <div className="verified-promo-controls" aria-label={t("home_banner_aria")}>
            <button type="button" onClick={() => move(-1)} aria-label={t("promo_previous")}>←</button>
            <div className="verified-promo-dots" role="tablist">
              {Array.from({ length: slideCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={active === index}
                  aria-label={`${index + 1}/${slideCount}`}
                  className={active === index ? "on" : ""}
                  onClick={() => { setActive(index); setPaused(true); }}
                />
              ))}
            </div>
            <span>{active + 1} / {slideCount}</span>
            <button type="button" onClick={() => move(1)} aria-label={t("promo_next")}>→</button>
          </div>
        )}
      </div>
    </section>
  );
}
