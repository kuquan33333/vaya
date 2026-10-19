import { bindings, defineConfig, defineWorker, triggers } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "vaytiendanang-ingestor",
    entrypoint: "./src/index.ts",
    compatibilityDate: "2026-10-19",
    compatibilityFlags: ["nodejs_compat"],
    triggers: [
      // 00:00 UTC = 07:00 Asia/Ho_Chi_Minh.
      triggers.scheduled({ schedule: "0 0 * * *" }),
      triggers.queue({
        name: "vaytiendanang-lead-notifications",
        maxBatchSize: 10,
        maxBatchTimeout: 30,
        maxRetries: 5,
        retryDelay: 60,
        deadLetterQueue: "vaytiendanang-lead-notifications-dlq",
      }),
    ],
    observability: {
      enabled: true,
      headSamplingRate: 1,
      redactQueryString: true,
      logs: { enabled: true, invocationLogs: true, persist: true },
    },
    env: {
      DB: bindings.d1({ name: "vaytiendanang-db" }),
      LEAD_DOCUMENTS: bindings.r2({ name: "vaytiendanang-lead-documents" }),
      LEAD_QUEUE: bindings.queue({ name: "vaytiendanang-lead-notifications" }),
      PUBLIC_SITE_URL: bindings.secret(),
      TELEGRAM_BOT_TOKEN: bindings.secret(),
      TELEGRAM_CHAT_ID: bindings.secret(),
      CRAWLER_TRIGGER_TOKEN: bindings.secret(),
    },
  }),
});
