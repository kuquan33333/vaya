"use client";

import { useEffect, useState } from "react";
import VerifiedPromoCarousel from "@/components/VerifiedPromoCarousel";
import VerifiedMarketsSection from "@/components/VerifiedMarketsSection";
import PurposePicker from "@/components/PurposePicker";
import WhySection from "@/components/WhySection";
import HowSection from "@/components/HowSection";
import Manifesto from "@/components/Manifesto";
import ValueBand from "@/components/ValueBand";
import Testimonials from "@/components/Testimonials";
import Faq from "@/components/Faq";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import RateFlow from "@/components/RateFlow";
import FooterReveal from "@/components/FooterReveal";
import { useI18n } from "@/i18n/I18nProvider";
import type { CatalogFilter } from "@/components/VerifiedMarketsSection";
import type { Purpose } from "@/data/banks";

export default function Home() {
  const { t } = useI18n();
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("all");

  const focusCatalog = (purpose: Purpose) => {
    const filter: CatalogFilter = purpose === "personal" ? "unsecured" : purpose;
    setCatalogFilter(filter);
    requestAnimationFrame(() => document.getElementById("markets")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  // Reveal-on-scroll (IntersectionObserver) — ported from the source's global
  // observer. Observes every `.reveal:not(.in)` element after mount.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Smooth-scroll to a section when arriving with a hash (e.g. from /#markets).
  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      // Wait a frame so layout is ready.
      requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth" }));
    }
  }, []);

  return (
    <main id="homeView">
      {/* Opaque column that slides away to uncover the pinned footer. */}
      <div className="page-above">
        {/* Banner/registration first; the full AI experience lives in FloatingAdvisor and /chat. */}
        <VerifiedPromoCarousel />

        <section className="trust">
          <div className="lab">{t("trust")}</div>
          <p className="trust-note">{t("trust_note")}</p>
        </section>

        <PurposePicker onPurposeSelect={focusCatalog} />

        <VerifiedMarketsSection selectedFilter={catalogFilter} onFilterChange={setCatalogFilter} />
        <WhySection />
        <HowSection />
        <Manifesto />
        <ValueBand />
        <RateFlow />
        <Testimonials />
        <Faq />
        <CTA />
      </div>

      <FooterReveal>
        <Footer />
      </FooterReveal>
    </main>
  );
}
