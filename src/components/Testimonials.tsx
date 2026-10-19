"use client";

import React from "react";
import { useI18n } from "@/i18n/I18nProvider";

const ITEMS = ["1", "2", "3"] as const;

export default function Testimonials() {
  const { t } = useI18n();
  return (
    <section className="section" style={{ background: "var(--surface)" }}>
      <div className="wrap">
        <div className="sec-head center reveal">
          <span className="sec-tag">{t("love_tag")}</span>
          <h2>{t("love_title")}</h2>
        </div>
        <div className="tst-grid" id="tstGrid">
          {ITEMS.map((id) => (
            <div className="tst reveal" key={id}>
              <div className="stars" aria-hidden="true">✓</div>
              <p>{t(`proof_desc_${id}`)}</p>
              <div className="who">
                <span className="a proof-icon" aria-hidden="true">{id}</span>
                <div><b>{t(`proof_title_${id}`)}</b><small>vaytiendanang</small></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
