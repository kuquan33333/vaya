import { bindings, defineConfig, defineWorker, triggers } from "cf/config";

const workerName = process.env.CF_INGESTOR_WORKER_NAME ?? "vaytiendanang-ingestor";
const databaseName = process.env.CF_D1_DATABASE_NAME ?? "vaytiendanang-db";
const leadQueueName = process.env.CF_LEAD_QUEUE_NAME ?? "vaytiendanang-lead-notifications";
const deadLetterQueueName = process.env.CF_LEAD_QUEUE_DLQ_NAME ?? "vaytiendanang-lead-notifications-dlq";

export default defineConfig({
  worker: defineWorker({
    name: workerName,
    entrypoint: "./src/index.ts",
    compatibilityDate: "2026-10-19",
    compatibilityFlags: ["nodejs_compat"],
    triggers: [
      // 00:00 UTC = 07:00 Asia/Ho_Chi_Minh.
      triggers.scheduled({ schedule: "0 0 * * *" }),
      triggers.queue({
        name: leadQueueName,
        maxBatchSize: 10,
        maxBatchTimeout: 30,
        maxRetries: 5,
        retryDelay: 60,
        deadLetterQueue: deadLetterQueueName,
      }),
    ],
    observability: {
      enabled: true,
      headSamplingRate: 1,
      redactQueryString: true,
      logs: { enabled: true, invocationLogs: true, persist: true },
    },
    env: {
      DB: bindings.d1({ name: databaseName }),
      LEAD_QUEUE: bindings.queue({ name: leadQueueName }),
      PUBLIC_SITE_URL: bindings.secret(),
      TELEGRAM_BOT_TOKEN: bindings.secret(),
      TELEGRAM_CHAT_ID: bindings.secret(),
      CRAWLER_TRIGGER_TOKEN: bindings.secret(),
    },
  }),
});
