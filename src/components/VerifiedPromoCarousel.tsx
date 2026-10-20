"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { fetchPublicCatalog } from "@/lib/catalog/client";
import { localizedText } from "@/lib/catalog/types";
import type { CatalogBanner } from "@/lib/catalog/types";

/**
 * A source-gated promotion carousel. Banner rows are never bundled in the
 * client: only current, verified D1 rows returned by /api/catalog can render.
 * An empty state is deliberate until a promotion has been reviewed.
 */
export default function VerifiedPromoCarousel() {
  const { lang, t } = useI18n();
  const [banners, setBanners] = useState<CatalogBanner[]>([]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicCatalog(controller.signal)
      .then((catalog) => setBanners(catalog.banners ?? []))
      .catch(() => setBanners([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (paused || banners.length < 2) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % banners.length), 6000);
    return () => window.clearInterval(timer);
  }, [banners.length, paused]);

  const current = useMemo(() => banners[active] ?? null, [active, banners]);
  const move = (delta: number) => setActive((index) => (index + delta + banners.length) % banners.length);

  return (
    <section
      className="verified-promo"
      aria-label={t("home_banner_aria")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="wrap">
        {current ? (
          <div className="verified-promo-card" role="group" aria-roledescription="slide" aria-label={`${active + 1}/${banners.length}`}>
            <div>
              <span className="sec-tag">{t("promo_source_tag")}</span>
              <h2>{localizedText(current.title, lang)}</h2>
              <p>{localizedText(current.body, lang)}</p>
            </div>
            <a className="btn btn-green" href={`/register?source=banner&campaign=${encodeURIComponent(current.bannerId)}`}>{localizedText(current.ctaLabel, lang)}</a>
            {banners.length > 1 && (
              <div className="verified-promo-controls">
                <button type="button" onClick={() => move(-1)} aria-label={t("promo_previous")}>←</button>
                <span>{active + 1} / {banners.length}</span>
                <button type="button" onClick={() => move(1)} aria-label={t("promo_next")}>→</button>
              </div>
            )}
          </div>
        ) : (
          <div className="verified-promo-empty home-lead-banner">
            <span className="sec-tag">{t("home_banner_tag")}</span>
            <h1>{t("home_banner_title")}</h1>
            <p>{t("home_banner_body")}</p>
            <div className="home-lead-actions">
              <a className="btn btn-green" href="/register?source=banner">{t("home_banner_register")}</a>
              <a className="btn btn-ghost" href="#markets">{t("home_banner_explore")}</a>
            </div>
            <small>{loading ? t("home_banner_loading") : t("home_banner_disclaimer")}</small>
          </div>
        )}
      </div>
    </section>
  );
}
