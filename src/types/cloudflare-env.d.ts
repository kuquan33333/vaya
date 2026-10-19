import type { D1Database, Fetcher, Queue, RateLimit } from "@cloudflare/workers-types";

declare global {
  interface Env {
    ASSETS?: Fetcher;
    DB?: D1Database;
    LEAD_QUEUE?: Queue<unknown>;
    LEAD_RATE_LIMIT?: RateLimit;
    CHAT_RATE_LIMIT?: RateLimit;
    LLM_PROVIDER?: string;
    DOCUMENT_UPLOADS_ENABLED?: string;
    DASHSCOPE_API_KEY?: string;
    DASHSCOPE_BASE_URL?: string;
    DASHSCOPE_MODEL?: string;
    DASHSCOPE_EMBEDDING_MODEL?: string;
    DEEPSEEK_API_KEY?: string;
    DEEPSEEK_BASE_URL?: string;
    DEEPSEEK_MODEL?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    TURNSTILE_SECRET_KEY?: string;
    TURNSTILE_SITE_KEY?: string;
    ZALO_CONTACT_URL?: string;
    PUBLIC_SITE_URL?: string;
    STAFF_ACCESS_TEAM_DOMAIN?: string;
    STAFF_ACCESS_AUD?: string;
    DOCUMENT_UPLOAD_SIGNING_KEY?: string;
  }
}

export {};
