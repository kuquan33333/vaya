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
            <a className="btn btn-green" href={`/register?source=banner&campaign=${encodeURIComponent(current.bannerId)}`}>{localizedText(current.ctaLabel, lang)}</a>
            {banners.length > 1 && (
              <div className="verified-promo-controls">
                <button type="button" onClick={() => move(-1)} aria-label="Ưu đãi trước">←</button>
                <span>{active + 1} / {banners.length}</span>
                <button type="button" onClick={() => move(1)} aria-label="Ưu đãi tiếp theo">→</button>
              </div>
            )}
          </div>
        ) : (
          <div className="verified-promo-empty home-lead-banner">
            <span className="sec-tag">vaytiendanang · Tư vấn khoản vay</span>
            <h1>Tìm gói vay phù hợp với nhu cầu của bạn</h1>
            <p>Vay tiền mặt, vay tiêu dùng, mua xe và mua hàng trả góp. Nhân viên hỗ trợ kiểm tra điều kiện và chuẩn bị hồ sơ.</p>
            <div className="home-lead-actions">
              <a className="btn btn-green" href="/register?source=banner">Đăng ký vay ngay →</a>
              <a className="btn btn-ghost" href="#markets">Khám phá gói vay</a>
            </div>
            <small>{loading ? "Đang tải dữ liệu sản phẩm đã kiểm chứng…" : "Lãi suất và ưu đãi chỉ công bố sau khi kiểm chứng; việc đăng ký không bảo đảm được duyệt."}</small>
          </div>
        )}
      </div>
    </section>
  );
}
