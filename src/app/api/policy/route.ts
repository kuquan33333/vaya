import { NextRequest, NextResponse } from "next/server";
import { getLLMProvider } from "@/lib/ai/provider";
import { getPolicyChunks } from "@/lib/ai/rag/store";
import { retrieveTopK } from "@/lib/ai/rag/retrieve";
import { embedText } from "@/lib/ai/rag/embed";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { parseLang } from "@/lib/i18n/apiMessages";
import { sameOrigin } from "@/lib/leads/service";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { detectInjection, sanitizeMessage } from "@/lib/security/inputGuard";

export interface PolicyQueryResult {
  answer: string;
  citations: { bank: string; section: string }[];
  belowThreshold: boolean;
  error?: boolean;
}

/**
 * POST /api/policy
 * Body: { question: string }
 * RAG pipeline: embed query -> retrieve top-K -> LLM answer with citations.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "cross_origin_request" }, { status: 403 });
  const runtime = getCloudflareEnv();
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = checkRateLimit(`policy:${ip}`, 10, 60_000);
  if (rate.limited) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } });
  if (runtime.CHAT_RATE_LIMIT) {
    try {
      const outcome = await runtime.CHAT_RATE_LIMIT.limit({ key: `policy:${ip}` });
      if (!outcome.success) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
    } catch {
      // The isolate-local limiter remains the local/dev fallback.
    }
  }
  let body: { question?: string; lang?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? sanitizeMessage(body.question) : null;
  const lang = parseLang(body.lang);
  if (!question || detectInjection(question)) {
    return NextResponse.json(
      { error: "question is required" },
      { status: 400 },
    );
  }

  try {
    const queryEmbedding = await embedText(question);
    const chunks = await getPolicyChunks(runtime.DB);
    const top = retrieveTopK(queryEmbedding, chunks, 5);

    if (top.length === 0) {
      return NextResponse.json({
        answer: "not found in the documents",
        citations: [],
        belowThreshold: true,
      });
    }

    const llm = getLLMProvider();
    const answer = await llm.answerPolicyQuery(
      question,
      top.map((t) => ({
        text: t.chunk.text,
        bank: t.chunk.bank,
        section: t.chunk.section,
      })),
      lang,
    );

    // Deduplicate citations based on bank + section
    const uniqueCitations = Array.from(
      new Set(top.map((t) => `${t.chunk.bank}|${t.chunk.section}`)),
    ).map((str) => {
      const [bank, section] = str.split("|");
      return { bank, section };
    });

    return NextResponse.json({
      answer,
      citations: uniqueCitations,
      belowThreshold: false,
    });
  } catch {
    return NextResponse.json(
      {
        answer: "not found in the documents",
        citations: [],
        belowThreshold: true,
        error: true,
      },
      { status: 503 },
    );
  }
}
