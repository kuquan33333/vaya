/* ================================================================
   Policy chunk store.
   The in-memory array remains a small unit-test/legacy adapter. Production
   requests read only reviewer-approved chunks from D1 because a Worker
   isolate is not durable and must not depend on local filesystem state.
   ================================================================ */

export interface PolicyChunk {
  id: string;
  bank: string;
  packageId?: string;
  section: string;
  text: string;
  embedding: number[];
}

export interface PolicyChunkDatabase {
  prepare(query: string): {
    all<T>(): Promise<{ results: T[] }>;
  };
}

interface PolicyChunkRow {
  chunk_id: string;
  bank: string;
  section: string;
  text: string;
  embedding_json: string;
}

const chunks: PolicyChunk[] = [];

export function addChunk(chunk: PolicyChunk): void {
  chunks.push(chunk);
}

export function getAllChunks(): PolicyChunk[] {
  return chunks;
}

function parseEmbedding(value: string): number[] | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 4096) return null;
    const embedding = parsed.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
    return embedding.length === parsed.length ? embedding : null;
  } catch {
    return null;
  }
}

/** Read only source-backed, reviewer-approved chunks from canonical D1. */
export async function getPolicyChunks(db?: PolicyChunkDatabase): Promise<PolicyChunk[]> {
  if (!db) return getAllChunks();
  try {
    const rows = await db.prepare(
      `SELECT chunk_id, bank, section, text, embedding_json
       FROM policy_chunks
       WHERE status = 'verified'
       ORDER BY observed_at DESC
       LIMIT 5000`,
    ).all<PolicyChunkRow>();
    return rows.results.flatMap((row) => {
      const embedding = parseEmbedding(row.embedding_json);
      if (!embedding || !row.text.trim() || !row.bank.trim() || !row.section.trim()) return [];
      return [{
        id: row.chunk_id,
        bank: row.bank,
        section: row.section,
        text: row.text.slice(0, 12_000),
        embedding,
      }];
    });
  } catch {
    // A missing/unmigrated table fails closed: no RAG context is safer than
    // silently falling back to stale or bundled policy text.
    return [];
  }
}

export function clearStore(): void {
  chunks.length = 0;
}

/**
 * Compatibility no-op retained for the original ingestion API. Callers must
 * persist the source/embedding outside the Worker process (D1 or R2).
 */
export function saveStore(): void {}

/** Compatibility no-op; Workers cannot rely on a writable local filesystem. */
export function loadStore(): void {}
