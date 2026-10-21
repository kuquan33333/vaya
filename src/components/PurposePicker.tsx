"use client";

// Wallet-pocket loan-purpose tiles (main-page quick entry): a white "card"
// peeking from a colored pocket, white line icon, label + starting rate. Each
// tile opens the chat advisor seeded with that purpose.
import React, { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { purpName, type Purpose } from "@/data/banks";
import { fetchPublicCatalog } from "@/lib/catalog/client";
import type { CatalogProduct } from "@/lib/catalog/types";

const WALLET: [Purpose, string][] = [
  ["home", "#00A863"],
  ["car", "#2F6BFF"],
  ["business", "#8180C8"],
  ["personal", "#FF6341"],
  ["secured", "#0FB6B6"],
];

const WICON: Record<Purpose, React.ReactNode> = {
  home: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  car: (
    <>
      <path d="M3 13l2-5h14l2 5v5H3z" />
      <circle cx="7.5" cy="18" r="1.6" />
      <circle cx="16.5" cy="18" r="1.6" />
    </>
  ),
  business: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="1" />
      <path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2" />
    </>
  ),
  personal: <path d="M13 3L4 14h7l-1 7 9-11h-7z" />,
  secured: (
    <>
      <rect x="4" y="10" width="16" height="10" rx="1" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </>
  ),
};

export default function PurposePicker({
  onPurposeSelect,
}: {
  onPurposeSelect?: (purpose: Purpose) => void;
}) {
  const { lang, t } = useI18n();
  const [products, setProducts] = useState<CatalogProduct[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicCatalog(controller.signal)
      .then((catalog) => setProducts(catalog.products))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const productCount = (purpose: Purpose): number => {
    const categories = purpose === "personal"
      ? new Set(["unsecured", "cash", "motorbike-installment", "phone-appliance-installment", "goods-service-installment"])
      : purpose === "home"
        ? new Set(["home", "secured"])
        : purpose === "car"
          ? new Set(["car", "motorbike-installment"])
          : purpose === "business"
            ? new Set(["business", "secured"])
            : new Set(["secured"]);
    return products.filter((product) => product.purposeCode === purpose || categories.has(product.category)).length;
  };

  const open = (p: Purpose) => {
    onPurposeSelect?.(p);
    requestAnimationFrame(() => document.getElementById("markets")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <section className="section purpose-sec">
      <div className="wrap">
        <div className="sec-head center reveal">
          <span className="sec-tag">{t("pp_tag")}</span>
          <h2>{t("pp_title")}</h2>
        </div>
        <div className="wallets">
          {WALLET.map(([p, c]) => (
            <button
              key={p}
              className="wallet"
              style={{ ["--wc" as string]: c } as React.CSSProperties}
              onClick={() => open(p)}
            >
              <span className="w-peek" />
              <span className="w-pocket">
                <span className="w-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    {WICON[p]}
                  </svg>
                </span>
                <span className="w-name">{purpName(p, lang)}</span>
                <span className="w-sub">
                  {productCount(p) > 0
                    ? t("pp_verified").replace("{count}", String(productCount(p)))
                    : t("rate_pending")}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
