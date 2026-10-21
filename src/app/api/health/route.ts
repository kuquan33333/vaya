import { NextResponse } from "next/server";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { documentUploadsEnabled } from "@/lib/leads/service";
import { verifyTelegramConfiguration } from "@/lib/leads/telegram";

export async function GET() {
  const runtime = getCloudflareEnv();
  const telegramVerified = await verifyTelegramConfiguration(runtime);
  const checks = {
    database: Boolean(runtime.DB),
    telegramDocuments: documentUploadsEnabled(runtime) && telegramVerified,
    leadQueue: Boolean(runtime.LEAD_QUEUE),
    llm: Boolean(runtime.DASHSCOPE_API_KEY || runtime.DEEPSEEK_API_KEY),
    ragEmbedding: Boolean(runtime.DASHSCOPE_API_KEY),
    telegram: telegramVerified,
    turnstile: Boolean(runtime.TURNSTILE_SECRET_KEY),
    turnstileSiteKey: Boolean(runtime.TURNSTILE_SITE_KEY),
    zalo: Boolean(runtime.ZALO_CONTACT_URL),
    publicSiteUrl: Boolean(runtime.PUBLIC_SITE_URL),
    staffAccess: Boolean(runtime.STAFF_ACCESS_TEAM_DOMAIN && runtime.STAFF_ACCESS_AUD),
  };
  const ready =
    checks.database &&
    checks.leadQueue &&
    checks.llm &&
    checks.ragEmbedding &&
    checks.telegram &&
    checks.turnstile &&
    checks.turnstileSiteKey &&
    checks.zalo &&
    checks.publicSiteUrl &&
    checks.staffAccess;
  const status = ready ? "ok" : "degraded";
  return NextResponse.json(
    { status, checks, timestamp: new Date().toISOString() },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
