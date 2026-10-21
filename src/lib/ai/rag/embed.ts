import OpenAI from "openai";
import { runtimeValue } from "@/lib/cloudflare/runtime";
import { LLMNotConfiguredError } from "@/lib/ai/provider";

function getEmbeddingClient(): OpenAI {
  // DashScope supplies the embedding model used by D1 policy_chunks. Keep
  // embeddings independent from the conversational provider so selecting
  // DeepSeek for chat does not silently send an unsupported embedding request
  // to the DeepSeek endpoint.
  const apiKey = runtimeValue("DASHSCOPE_API_KEY");
  if (!apiKey) throw new LLMNotConfiguredError();
  return new OpenAI({
    apiKey,
    baseURL:
      runtimeValue("DASHSCOPE_BASE_URL") ??
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  });
}

/**
 * Embed a single text string using DashScope text-embedding-v3.
 * Returns the embedding vector as a number array.
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await getEmbeddingClient().embeddings.create({
    model: runtimeValue("DASHSCOPE_EMBEDDING_MODEL") ?? "text-embedding-v3",
    input: text,
  });
  return response.data[0].embedding;
}
