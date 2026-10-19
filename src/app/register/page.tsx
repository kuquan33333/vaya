"use client";

import { Suspense } from "react";
import RegistrationForm from "@/components/RegistrationForm";

export default function RegisterPage() {
  return <Suspense fallback={null}><RegistrationForm /></Suspense>;
}
