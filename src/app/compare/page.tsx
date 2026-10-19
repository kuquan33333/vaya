"use client";

import { Suspense } from "react";
import VerifiedComparePage from "@/components/VerifiedComparePage";

export default function Compare() {
  return (
    <Suspense fallback={null}>
      <VerifiedComparePage />
    </Suspense>
  );
}
