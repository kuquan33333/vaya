import { describe, expect, it } from "vitest";
import { clearStore, getPolicyChunks, type PolicyChunkDatabase } from "@/lib/ai/rag/store";

function db(rows: unknown[]): PolicyChunkDatabase {
  return {
    prepare: () => ({
      all: async <T>() => ({ results: rows as T[] }),
    }),
  };
}

describe("durable policy chunk gate", () => {
  it("accepts only finite, bounded embeddings returned from the verified D1 query", async () => {
    const chunks = await getPolicyChunks(db([
      { chunk_id: "ok", bank: "Bank A", section: "fees", text: "Phí theo nguồn", embedding_json: "[1,0]" },
      { chunk_id: "bad", bank: "Bank A", section: "bad", text: "Không dùng", embedding_json: "[1,\"nan\"]" },
    ]));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].id).toBe("ok");
  });

  it("fails closed when D1 is unavailable", async () => {
    const unavailable: PolicyChunkDatabase = {
      prepare: () => { throw new Error("database unavailable"); },
    };
    clearStore();
    expect(await getPolicyChunks(unavailable)).toEqual([]);
  });
});
