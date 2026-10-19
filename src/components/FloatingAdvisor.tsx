"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ChatAdvisor from "./ChatAdvisor";

export default function FloatingAdvisor() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (pathname.startsWith("/chat") || pathname.startsWith("/register")) return null;
  return (
    <>
      {open && <div className="floating-advisor-panel" role="dialog" aria-modal="true" aria-label="Tư vấn AI vaytiendanang"><div className="floating-advisor-actions"><button type="button" onClick={() => { setOpen(false); router.push("/chat"); }}>Mở toàn màn hình</button><button className="floating-close" onClick={() => setOpen(false)} aria-label="Đóng">×</button></div><ChatAdvisor /></div>}
      <button className="floating-advisor" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Mở tư vấn AI"><span aria-hidden="true">✦</span><b>Tư vấn AI</b></button>
      <button className="floating-lead" onClick={() => router.push("/register?source=ai")} aria-label="Đăng ký tư vấn nhân viên">Đăng ký</button>
    </>
  );
}
