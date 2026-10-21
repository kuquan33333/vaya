import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hồ sơ nội bộ | vaytiendanang",
  robots: { index: false, follow: false, nocache: true },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}
