"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render(element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void; "error-callback"?: () => void }): string;
      reset(widgetId?: string): void;
    };
  }
}

export default function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  useEffect(() => {
    let disposed = false;
    fetch("/api/turnstile/sitekey")
      .then((response) => response.json() as Promise<{ siteKey: string | null }>)
      .then(({ siteKey }) => {
        if (!siteKey || disposed || !container.current) return;
        const render = () => {
          if (!window.turnstile || !container.current || disposed) return;
          widget.current = window.turnstile.render(container.current, {
            sitekey: siteKey,
            callback: (token) => onToken(token),
            "expired-callback": () => onToken(null),
            "error-callback": () => onToken(null),
          });
        };
        if (window.turnstile) render();
        else {
          const script = document.createElement("script");
          script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          script.async = true;
          script.defer = true;
          script.onload = render;
          document.head.appendChild(script);
        }
      })
      .catch(() => onToken(null));
    return () => {
      disposed = true;
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
    };
  }, [onToken]);
  return <div ref={container} aria-label="Cloudflare Turnstile" />;
}
