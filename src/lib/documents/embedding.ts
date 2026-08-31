// A zero-dependency, zero-API-key local embedding for the "semantic" half
// of hybrid retrieval (see src/lib/documents/search.ts). Crado's only model
// provider today is Anthropic, which has no embeddings API, and adding a
// second vendor purely for embeddings would mean a new third-party
// credential this MVP doesn't have configured — a one-way-door decision
// per CLAUDE.md, not something to add unasked. This uses the "hashing
// trick" (Weinberger et al.): every token is hashed into a fixed-size
// vector with a randomized sign, which is a real, well-known, if simple,
// lexical embedding technique — genuinely captures word-overlap
// similarity, costs nothing, needs no network call, and is fully
// deterministic and unit-testable. It is NOT a neural/contextual
// embedding. Swapping in a real provider (OpenAI, Voyage, etc.) behind the
// same signature is a drop-in upgrade once a key is approved — nothing
// else in the ingestion/retrieval pipeline needs to change.
export const EMBEDDING_DIMENSIONS = 512;

/** Deterministic: the same text always produces the same vector, so a
 * document re-index (or a test) never has to worry about drift. */
export function computeHashedEmbedding(
  text: string,
  dimensions: number = EMBEDDING_DIMENSIONS,
): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  for (const token of tokenize(text)) {
    const index = hashString(token, INDEX_SEED) % dimensions;
    const sign = hashString(token, SIGN_SEED) % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }
  return normalize(vector);
}

/** pgvector's text input/output format for a `vector` column — PostgREST
 * (and therefore supabase-js) expects this literal, not a raw JS array,
 * for both inserting a vector value and passing one as an RPC argument. */
export function toVectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(",")}]`;
}

/** Cosine similarity, for unit-testing the embedding's behavior directly
 * without a database — pgvector's `<=>` operator does the equivalent work
 * server-side at query time. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // both inputs are already L2-normalized by computeHashedEmbedding
}

const INDEX_SEED = 0x811c9dc5;
const SIGN_SEED = 0x9e3779b9;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

// FNV-1a — small, fast, deterministic; exactly what feature hashing needs,
// no cryptographic property required.
function hashString(input: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}
