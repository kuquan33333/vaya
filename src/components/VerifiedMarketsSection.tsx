"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import {
  fetchPublicCatalog,
  formatDate,
  formatVnd,
  primaryRate,
  rateLabel,
} from "@/lib/catalog/client";
import {
  CATALOG_COMPARE_MAX,
  toggleCatalogCompare,
  useCatalogCompare,
} from "@/lib/catalog/compareStore";
import type { CatalogProduct } from "@/lib/catalog/types";

export type CatalogFilter = "all" | "home" | "car" | "business" | "unsecured" | "secured";
type Filter = CatalogFilter;
const FILTERS: Filter[] = ["all", "home", "car", "business", "unsecured", "secured"];

const filterLabel: Record<Filter, string> = {
  all: "Tất cả",
  home: "Mua nhà / đất",
  car: "Ô tô",
  business: "Kinh doanh",
  unsecured: "Tín chấp",
  secured: "Có tài sản đảm bảo",
};

function productPurpose(product: CatalogProduct): Filter {
  if (product.category === "unsecured") return "unsecured";
  if (product.category === "home") return "home";
  if (product.category === "car" || product.category === "motorbike-installment") return "car";
  if (product.category === "business") return "business";
  if (product.category === "secured") return "secured";
  return "all";
}

function ProductCard({
  product,
  selected,
  onCompare,
  openHref,
  registerHref,
}: {
  product: CatalogProduct;
  selected: boolean;
  onCompare: () => void;
  openHref: string;
  registerHref: string;
}) {
  const rate = primaryRate(product);
  return (
    <article className="pkg verified-product-card">
      <div className="pkg-top">
        <span className="verified-badge">Đã xác minh nguồn</span>
        <span className="confidence-badge">Tin cậy: {product.confidence}</span>
      </div>
      <div className="pkg-name">
        <span className="pkg-bank">{product.providerName.vi}</span>
        <span className="pkg-type">{product.productName.vi}</span>
      </div>
      <div className="pkg-rate-box">
        <div>
          <div className="k">Lãi suất theo nguồn</div>
          <div className="v g">{rateLabel(product)}</div>
        </div>
        <div>
          <div className="k">Hạn mức</div>
          <div className="v">{formatVnd(product.maxAmountVnd)}</div>
        </div>
      </div>
      <div className="pkg-meta">
        <span>Thời hạn: <b>{product.minTermMonths ?? "—"}–{product.maxTermMonths ?? "—"} tháng</b></span>
        <span>Quan sát: <b>{formatDate(product.observedAt)}</b></span>
        <span>{rate?.rateType === "promotional" ? "Có kỳ ưu đãi" : "Điều khoản công khai"}</span>
      </div>
      <p className="verified-note">
        Chỉ hiển thị số liệu có căn cứ từ nguồn chính thức. Phí chưa công bố không được tự suy ra.
      </p>
      <div className="pkg-acts">
        <button className={"cmp-tog card" + (selected ? " on" : "")} onClick={onCompare} aria-pressed={selected}>
          {selected ? "✓" : "⇄"} So sánh
        </button>
        <a className="pkg-cta" href={openHref}>Xem điều khoản</a>
        <a className="pkg-cta" href={registerHref}>Đăng ký tư vấn</a>
      </div>
    </article>
  );
}

export default function VerifiedMarketsSection({
  selectedFilter = "all",
  onFilterChange,
}: {
  selectedFilter?: CatalogFilter;
  onFilterChange?: (filter: CatalogFilter) => void;
}) {
  const { t } = useI18n();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>(selectedFilter);
  const [search, setSearch] = useState("");
  const [lenderType, setLenderType] = useState<"all" | "bank" | "consumer-finance">("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const selected = useCatalogCompare();

  useEffect(() => setFilter(selectedFilter), [selectedFilter]);
  const changeFilter = (value: Filter) => {
    setFilter(value);
    onFilterChange?.(value);
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicCatalog(controller.signal)
      .then((data) => {
        setProducts(data.products);
        setMessage(data.message);
      })
      .catch(() => setMessage("Chưa thể tải catalog đã xác minh. Vui lòng thử lại sau."))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products
      .filter((product) => filter === "all" || productPurpose(product) === filter)
      .filter((product) => lenderType === "all" || product.lenderType === lenderType)
      .filter((product) => !minAmount || product.maxAmountVnd == null || product.maxAmountVnd >= Number(minAmount))
      .filter((product) => !maxAmount || product.minAmountVnd == null || product.minAmountVnd <= Number(maxAmount))
      .filter((product) => !termMonths || ((product.minTermMonths == null || product.minTermMonths <= Number(termMonths)) && (product.maxTermMonths == null || product.maxTermMonths >= Number(termMonths))))
      .filter((product) => {
        if (!query) return true;
        return `${product.providerName.vi} ${product.productName.vi} ${product.category}`.toLowerCase().includes(query);
      })
    .sort((a, b) => (primaryRate(a)?.basis === primaryRate(b)?.basis
      ? (primaryRate(a)?.annualRatePercent ?? primaryRate(a)?.monthlyRatePercent ?? Infinity) - (primaryRate(b)?.annualRatePercent ?? primaryRate(b)?.monthlyRatePercent ?? Infinity)
      : a.stableSlug.localeCompare(b.stableSlug)));
  }, [filter, lenderType, maxAmount, minAmount, products, search, termMonths]);

  return (
    <section className="section" id="markets">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="sec-tag">Catalog vaytiendanang</span>
          <h2>So sánh khoản vay có nguồn kiểm chứng</h2>
          <p>
            Chúng tôi chỉ xếp hạng sản phẩm khi có lãi suất, cơ sở tính và thời điểm quan sát rõ ràng từ nguồn chính thức.
          </p>
        </div>

        <div className="verified-catalog-note">
          <b>{loading ? "Đang tải dữ liệu…" : `${products.length} sản phẩm đã xác minh`}</b>
          <span>{message ?? "Lãi suất hiển thị theo đúng cơ sở ghi trong nguồn; không phải cam kết duyệt vay."}</span>
          <a className="btn btn-green btn-sm" href="/register?source=banner">Đăng ký để được kiểm tra hồ sơ</a>
        </div>

        <div className="table-card reveal">
          <div className="filters verified-filters">
            {FILTERS.map((item) => (
              <button key={item} className={filter === item ? "on" : ""} onClick={() => changeFilter(item)}>
                {filterLabel[item]}
              </button>
            ))}
          </div>
          <div className="mkt-tools">
            <label className="search">
              <span aria-hidden="true">⌕</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm ngân hàng hoặc sản phẩm" />
            </label>
            <select className="sortsel" value={lenderType} onChange={(event) => setLenderType(event.target.value as typeof lenderType)} aria-label="Loại nhà cung cấp">
              <option value="all">Mọi nhà cung cấp</option>
              <option value="bank">Ngân hàng</option>
              <option value="consumer-finance">Công ty tài chính</option>
            </select>
            <input className="catalog-filter-input" inputMode="numeric" value={minAmount} onChange={(event) => setMinAmount(event.target.value.replace(/\D/g, ""))} placeholder="Hạn mức từ" aria-label="Hạn mức từ" />
            <input className="catalog-filter-input" inputMode="numeric" value={maxAmount} onChange={(event) => setMaxAmount(event.target.value.replace(/\D/g, ""))} placeholder="Hạn mức đến" aria-label="Hạn mức đến" />
            <input className="catalog-filter-input" inputMode="numeric" value={termMonths} onChange={(event) => setTermMonths(event.target.value.replace(/\D/g, ""))} placeholder="Số tháng" aria-label="Số tháng" />
            <span className="cnt">{shown.length} sản phẩm</span>
            <span className="cnt">{selected.length}/{CATALOG_COMPARE_MAX} đã chọn</span>
          </div>
          {shown.length === 0 ? (
            <div className="empty verified-empty">
              <div className="empty-ic">⌁</div>
              <div className="empty-t">Chưa có sản phẩm đủ căn cứ để xếp hạng</div>
              <div className="empty-d">
                Không dùng dữ liệu minh họa thay cho lãi suất thật. Bạn vẫn có thể gửi yêu cầu để nhân viên kiểm tra nguồn và hồ sơ.
              </div>
              <a className="btn btn-green btn-sm" href="/register?source=market">Gửi yêu cầu tư vấn</a>
            </div>
          ) : (
            <div className="pkg-grid">
              {shown.map((product) => (
                <ProductCard
                  key={product.stableSlug}
                  product={product}
                  selected={selected.includes(product.stableSlug)}
                  onCompare={() => toggleCatalogCompare(product.stableSlug)}
                  openHref={`/product/${product.stableSlug}`}
                  registerHref={`/register?source=card&productId=${encodeURIComponent(product.productId)}&providerId=${encodeURIComponent(product.providerId)}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
