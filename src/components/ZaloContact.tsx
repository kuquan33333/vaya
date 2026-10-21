"use client";

import { useEffect, useState } from "react";

export default function ZaloContact() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/contact/zalo").then((response) => response.json() as Promise<{ url?: string | null }>).then((data) => setUrl(data.url ?? null)).catch(() => undefined);
  }, []);
  if (!url) return null;
  return <a className="floating-zalo" href={url} target="_blank" rel="noreferrer" aria-label="Liên hệ nhân viên qua Zalo">Zalo</a>;
}
