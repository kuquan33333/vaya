import { NextResponse } from "next/server";
import { getCloudflareEnv } from "@/lib/cloudflare/env";

export async function GET() {
  const siteKey = getCloudflareEnv().TURNSTILE_SITE_KEY;
  return NextResponse.json(
    { configured: Boolean(siteKey), siteKey: siteKey ?? null },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
