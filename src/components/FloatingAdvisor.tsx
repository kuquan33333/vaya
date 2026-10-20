"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
const ChatAdvisor = lazy(() => import("./ChatAdvisor"));

export default function FloatingAdvisor() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLAnchorElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const launcher = launcherRef.current;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    const active = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      window.scrollTo(0, scrollY);
      (active ?? launcher)?.focus?.();
    };
  }, [open]);

  if (pathname.startsWith("/chat") || pathname.startsWith("/register")) return null;

  return (
    <>
      {open && (
        <>
          <button className="floating-advisor-backdrop" type="button" aria-label={t("floating_close")} onClick={() => setOpen(false)} />
          <div className="floating-advisor-panel" role="dialog" aria-modal="true" aria-labelledby="floating-advisor-title">
            <div className="floating-advisor-header">
              <div>
                <strong id="floating-advisor-title">vaytiendanang</strong>
                <span>{t("floating_status")}</span>
              </div>
              <div className="floating-advisor-actions">
                <button type="button" onClick={() => { setOpen(false); router.push("/chat"); }}>{t("floating_fullscreen")}</button>
                <button ref={closeRef} className="floating-close" onClick={() => setOpen(false)} aria-label={t("floating_close")}>×</button>
              </div>
            </div>
            <div className="floating-advisor-content">
              <Suspense fallback={<div className="chat-loading" role="status">{t("floating_loading")}</div>}>
                <ChatAdvisor embedded />
              </Suspense>
            </div>
          </div>
        </>
      )}
      <a ref={launcherRef} href="/chat" className="floating-advisor" onClick={(event) => { event.preventDefault(); setOpen((value) => !value); }} aria-expanded={open} aria-controls={open ? "floating-advisor-title" : undefined} aria-label={t("floating_open")}><span aria-hidden="true">✦</span><b>{t("cta_chat")}</b></a>
      <a className="floating-lead" href="/register?source=ai" aria-label={t("floating_register")}>{t("floating_register_short")}</a>
    </>
  );
}
