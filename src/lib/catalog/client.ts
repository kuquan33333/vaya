import type { CatalogBanner, CatalogProduct, CatalogProvider } from "./types";
import { selectUsableRate } from "./rateSelection";

export interface PublicCatalogResponse {
  catalogReady: boolean;
  version: string;
  fetchedAt: string;
  isFallback: boolean;
  products: CatalogProduct[];
  providers: CatalogProvider[];
  banners: CatalogBanner[];
  message: string | null;
}

export async function fetchPublicCatalog(signal?: AbortSignal): Promise<PublicCatalogResponse> {
  const response = await fetch("/api/catalog", {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`catalog_http_${response.status}`);
  return (await response.json()) as PublicCatalogResponse;
}

export function primaryRate(product: CatalogProduct) {
  return selectUsableRate(product);
}

export function rateLabel(product: CatalogProduct): string {
  const rate = primaryRate(product);
  if (!rate) return "—";
  if (rate.basis === "monthly-flat") return `${rate.monthlyRatePercent}%/tháng (dư nợ gốc)`;
  return `${rate.annualRatePercent}%/năm`;
}

export function formatVnd(value: number | null): string {
  if (value == null) return "Chưa công bố";
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}

export function formatDate(value: string | null): string {
  if (!value) return "Chưa có ngày quan sát";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}
