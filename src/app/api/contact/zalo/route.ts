import { NextResponse } from "next/server";
import { getCloudflareEnv } from "@/lib/cloudflare/env";

export async function GET() {
  const configured = getCloudflareEnv().ZALO_CONTACT_URL;
  let url: string | null = null;
  try {
    const parsed = configured ? new URL(configured) : null;
    if (parsed?.protocol === "https:") url = parsed.toString();
  } catch {
    url = null;
  }
  return NextResponse.json({ configured: Boolean(url), url }, { headers: { "Cache-Control": "public, max-age=300" } });
}
