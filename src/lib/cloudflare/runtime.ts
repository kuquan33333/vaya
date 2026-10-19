import { getCloudflareEnv } from "./env";

const DEFAULT_DASHSCOPE_BASE_URL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

export interface RuntimeConfig {
  provider: "qwen" | "deepseek";
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
  embeddingModel: string;
}

/**
 * Read secrets from the Workers binding first, with process.env only as a
 * local-development fallback. No secret value is ever returned to a client or
 * included in logs.
 */
export function runtimeValue(name: keyof Env): string | undefined {
  try {
    const workerValue = getCloudflareEnv()[name];
    if (typeof workerValue === "string" && workerValue.length > 0) {
      return workerValue;
    }
  } catch {
    // The Node dev server has no `cloudflare:workers` runtime binding.
  }
  if (typeof process !== "undefined") {
    const value = process.env[name];
    return value || undefined;
  }
  return undefined;
}

export function getRuntimeConfig(): RuntimeConfig {
  const provider = (runtimeValue("LLM_PROVIDER") ?? "qwen").toLowerCase();
  if (provider === "deepseek") {
    return {
      provider: "deepseek",
      apiKey: runtimeValue("DEEPSEEK_API_KEY"),
      baseUrl: runtimeValue("DEEPSEEK_BASE_URL") ?? DEFAULT_DEEPSEEK_BASE_URL,
      model: runtimeValue("DEEPSEEK_MODEL") ?? "deepseek-chat",
      embeddingModel:
        runtimeValue("DASHSCOPE_EMBEDDING_MODEL") ?? "text-embedding-v3",
    };
  }
  return {
    provider: "qwen",
    apiKey: runtimeValue("DASHSCOPE_API_KEY"),
    baseUrl: runtimeValue("DASHSCOPE_BASE_URL") ?? DEFAULT_DASHSCOPE_BASE_URL,
    model: runtimeValue("DASHSCOPE_MODEL") ?? "qwen-plus",
    embeddingModel:
      runtimeValue("DASHSCOPE_EMBEDDING_MODEL") ?? "text-embedding-v3",
  };
}
