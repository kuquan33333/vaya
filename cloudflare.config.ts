import { bindings, defineConfig, defineWorker } from "cf/config";

const workerName = process.env.CF_APP_WORKER_NAME ?? "vaytiendanang";
const databaseName = process.env.CF_D1_DATABASE_NAME ?? "vaytiendanang-db";
const leadQueueName = process.env.CF_LEAD_QUEUE_NAME ?? "vaytiendanang-lead-notifications";
const rateLimitSuffix = process.env.CF_RATE_LIMIT_SUFFIX ?? "";
// Workers Rate Limit namespaces must be positive integer strings. Keep these
// stable across deploys so counters are not reset by an arbitrary namespace
// rename; the optional suffix remains useful for isolated preview accounts.
const leadRateLimitNamespace = process.env.CF_LEAD_RATE_LIMIT_NAMESPACE ?? `57281401${rateLimitSuffix}`;
const chatRateLimitNamespace = process.env.CF_CHAT_RATE_LIMIT_NAMESPACE ?? `57281402${rateLimitSuffix}`;

export default defineConfig({
  worker: defineWorker({
    name: workerName,
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-19",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    observability: {
      enabled: true,
      headSamplingRate: 1,
      redactQueryString: true,
      logs: { enabled: true, invocationLogs: true, persist: true },
    },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ name: databaseName }),
      LEAD_QUEUE: bindings.queue({ name: leadQueueName }),
      LEAD_RATE_LIMIT: bindings.rateLimit({ namespace: leadRateLimitNamespace, simple: { limit: 5, period: 60 } }),
      CHAT_RATE_LIMIT: bindings.rateLimit({ namespace: chatRateLimitNamespace, simple: { limit: 20, period: 60 } }),
      LLM_PROVIDER: bindings.text("qwen"),
      // Telegram is the only document delivery channel. The route still
      // fails closed until the bot token, chat id and signing key are set.
      DOCUMENT_UPLOADS_ENABLED: bindings.text("true"),
      DASHSCOPE_API_KEY: bindings.secret(),
      DASHSCOPE_BASE_URL: bindings.secret(),
      DASHSCOPE_MODEL: bindings.secret(),
      DASHSCOPE_EMBEDDING_MODEL: bindings.secret(),
      DEEPSEEK_API_KEY: bindings.secret(),
      DEEPSEEK_BASE_URL: bindings.secret(),
      DEEPSEEK_MODEL: bindings.secret(),
      TELEGRAM_BOT_TOKEN: bindings.secret(),
      TELEGRAM_CHAT_ID: bindings.secret(),
      TURNSTILE_SECRET_KEY: bindings.secret(),
      TURNSTILE_SITE_KEY: bindings.secret(),
      ZALO_CONTACT_URL: bindings.secret(),
      PUBLIC_SITE_URL: bindings.secret(),
      STAFF_ACCESS_TEAM_DOMAIN: bindings.secret(),
      STAFF_ACCESS_AUD: bindings.secret(),
      DOCUMENT_UPLOAD_SIGNING_KEY: bindings.secret(),
    },
  }),
});
