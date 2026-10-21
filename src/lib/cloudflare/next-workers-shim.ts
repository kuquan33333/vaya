/**
 * Node/Next build shim only. The Cloudflare/Vinext build resolves the native
 * `cloudflare:workers` module instead; returning an empty binding set here
 * keeps local Next route collection honest (APIs return degraded/503 rather
 * than pretending that D1 or secrets exist).
 */
export const env = {} as Env;
