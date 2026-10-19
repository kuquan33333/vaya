"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const { lang } = useI18n();
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
      aria-label="Ưu đãi đã xác minh"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="wrap">
        {current ? (
          <div className="verified-promo-card" role="group" aria-roledescription="slide" aria-label={`${active + 1}/${banners.length}`}>
            <div>
              <span className="sec-tag">Ưu đãi có nguồn</span>
              <h2>{localizedText(current.title, lang)}</h2>
              <p>{localizedText(current.body, lang)}</p>
            </div>
            <button
              className="btn btn-green"
              onClick={() => router.push(`/register?source=banner&campaign=${encodeURIComponent(current.bannerId)}`)}
            >
              {localizedText(current.ctaLabel, lang)}
            </button>
            {banners.length > 1 && (
              <div className="verified-promo-controls">
                <button type="button" onClick={() => move(-1)} aria-label="Ưu đãi trước">←</button>
                <span>{active + 1} / {banners.length}</span>
                <button type="button" onClick={() => move(1)} aria-label="Ưu đãi tiếp theo">→</button>
              </div>
            )}
          </div>
        ) : (
          <div className="verified-promo-empty">
            <span className="sec-tag">Ưu đãi</span>
            <b>{loading ? "Đang kiểm tra ưu đãi…" : "Chưa có ưu đãi đủ căn cứ để công bố"}</b>
            <span>Ưu đãi chỉ xuất hiện sau khi nguồn, điều kiện và thời hạn được nhân viên xác minh.</span>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push("/register?source=banner")}>Đăng ký để được tư vấn</button>
          </div>
        )}
      </div>
    </section>
  );
}
