/**
 * Embedding utilities for pgvector conversion.
 * Ensures consistent formatting when storing embeddings in PostgreSQL.
 */

/**
 * Convert an embedding array to pgvector format string.
 * pgvector expects embeddings as a string in format "[0.1,0.2,0.3,...]"
 *
 * @param embedding - Array of numbers representing the embedding vector
 * @returns String in pgvector format
 *
 * @example
 * toPgVector([0.1, 0.2, 0.3]) // returns "[0.1,0.2,0.3]"
 */
export function toPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}
