import { env } from "@/lib/cloudflare/worker-env";

/**
 * Access Cloudflare bindings through the Workers runtime. The platform
 * bridge is kept in one module so local Next.js builds and pure unit tests
 * can use the catalog fallback without importing a platform-specific binding
 * everywhere.
 */
export function getCloudflareEnv(): Env {
  return env;
}
