"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { LogoLight } from "@/components/Logo";

export default function Footer() {
  const pathname = usePathname();
  const { t } = useI18n();

  const sectionHref = (id: string) => pathname === "/" ? `#${id}` : `/#${id}`;
  const homeHref = pathname === "/" ? "#homeView" : "/";

  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <a className="brand" href="/">
              <LogoLight /> vaytiendanang
            </a>
            <p>{t("foot_about")}</p>
          </div>
          <div>
            <h5>{t("foot_product")}</h5>
            <a href="/chat">{t("cta_chat")}</a>
            <a href={sectionHref("markets")}>{t("nav_markets")}</a>
            <a href={sectionHref("how")}>{t("nav_how")}</a>
          </div>
          <div>
            <h5>{t("foot_loans")}</h5>
            <a href={sectionHref("markets")}>{t("f_home")}</a>
            <a href={sectionHref("markets")}>{t("f_car")}</a>
            <a href={sectionHref("markets")}>{t("f_business")}</a>
            <a href={sectionHref("markets")}>{t("f_personal")}</a>
          </div>
          <div>
            <h5>{t("foot_company")}</h5>
            <a href={sectionHref("why")}>{t("foot_about_l")}</a>
            <a href="/privacy">{t("foot_privacy")}</a>
            <a href="/human">{t("foot_contact")}</a>
          </div>
        </div>
        <div className="foot-bot">
          <span>© 2026 vaytiendanang</span>
          <a
            className="foot-top"
            href={homeHref}
            onClick={(event) => {
              if (pathname === "/") {
                event.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          >
            {t("foot_top")} <span aria-hidden="true">↑</span>
          </a>
        </div>
        <p className="disc">{t("disc")}</p>
      </div>

      {/* Full-bleed sign-off. The letters are deliberately cropped by the band:
          the mark carries on past the edge of the page rather than sitting
          politely inside it. Decorative, so it is hidden from screen readers. */}
      <div className="foot-mark" aria-hidden="true">
        <span className="foot-mark-logo">
          <LogoLight />
        </span>
        <span className="foot-mark-word">VAYTIENDANANG</span>
      </div>
    </footer>
  );
}
