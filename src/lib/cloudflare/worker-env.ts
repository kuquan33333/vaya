import { env } from "cloudflare:workers";

/**
 * Cloudflare Workers' native runtime binding. The regular Next.js build
 * aliases this module to next-workers-shim.ts; Vinext leaves it native so
 * production requests receive the real D1, R2, Queue, and secret bindings.
 */
export { env };
