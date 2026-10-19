import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/i18n/I18nProvider";
import Navbar from "@/components/Navbar";
import CatalogCompareBar from "@/components/CatalogCompareBar";
import SelectState from "@/components/SelectState";
import FloatingAdvisor from "@/components/FloatingAdvisor";
import ZaloContact from "@/components/ZaloContact";

export const metadata: Metadata = {
  title: "vaytiendanang — Tư vấn và so sánh khoản vay",
  description:
    "vaytiendanang tư vấn, phân tích khả năng trả nợ và chỉ so sánh sản phẩm vay có nguồn chính thức được xác minh.",
  ...(process.env.PUBLIC_SITE_URL
    ? { metadataBase: new URL(process.env.PUBLIC_SITE_URL) }
    : {}),
  openGraph: {
    type: "website",
    siteName: "vaytiendanang",
    title: "vaytiendanang — Tư vấn và so sánh khoản vay",
    description: "So sánh điều khoản có nguồn kiểm chứng và nhận tư vấn hồ sơ ngay trên vaytiendanang.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning`: the inline script below rewrites `lang` before
    // React hydrates, which is intentional.
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* "Be Vietnam Pro" carries the full Vietnamese diacritic set that Sora
            lacks — see the html[lang="vi"] override in globals.css. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- the font stack is intentionally shared by every App Router layout */}
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        {/* Applies the saved language to <html lang> before the first paint, so
            the right font is used immediately and nothing flashes. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var v=localStorage.getItem('vaytiendanang_lang')||localStorage.getItem('vaya_lang');if(v==='vi'||v==='zh'||v==='en'){document.documentElement.lang=v;}}catch(e){}})();",
          }}
        />
      </head>
      <body>
        <I18nProvider>
          <Navbar />
          {children}
          {/* Selection basket for the compare feature — lives above every page so
              a pick made on the markets table survives navigation. */}
          <CatalogCompareBar />
          {/* Tracks which native <select> is open so its chevron can point up. */}
          <SelectState />
          <FloatingAdvisor />
          <ZaloContact />
        </I18nProvider>
      </body>
    </html>
  );
}
