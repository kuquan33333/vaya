import { NextRequest, NextResponse } from "next/server";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { createLead, sameOrigin, verifyTurnstile } from "@/lib/leads/service";
import { LeadInputSchema } from "@/lib/leads/schema";
import { checkRateLimit } from "@/lib/security/rateLimit";

function clientIp(request: NextRequest): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "cross_origin_request" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const rate = checkRateLimit(`lead:${ip}`, 5, 60_000);
  if (rate.limited) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)), "Cache-Control": "no-store" } });
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 160) {
    return NextResponse.json({ error: "idempotency_key_required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const parsed = LeadInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_lead", fields: parsed.error.issues.map((issue) => issue.path.join(".")) }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const runtime = getCloudflareEnv();
  if (runtime.LEAD_RATE_LIMIT) {
    try {
      const outcome = await runtime.LEAD_RATE_LIMIT.limit({ key: ip || "unknown" });
      if (!outcome.success) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Cache-Control": "no-store" } });
    } catch {
      // The isolate-local limiter above remains the safe fallback if the
      // optional account-level binding is unavailable during local dev.
    }
  }
  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, runtime.TURNSTILE_SECRET_KEY, ip);
  if (!turnstile.ok) {
    return NextResponse.json({ error: "turnstile_required" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await createLead(runtime, parsed.data, idempotencyKey, {
      origin: request.headers.get("origin"),
      ip,
      userAgent: request.headers.get("user-agent") ?? "",
      requestUrl: request.url,
    });
    return NextResponse.json(
      { ok: true, lead: result, turnstileConfigured: turnstile.configured },
      { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_VIETNAM_PHONE") {
      return NextResponse.json({ error: "invalid_vietnam_phone" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (error instanceof Error && error.message === "DOCUMENT_UPLOADS_NOT_ENABLED") {
      return NextResponse.json({ error: "document_upload_disabled" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    console.error("[lead] create failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "lead_storage_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
