/**
 * Shared embedding configuration. Both the ingest pipeline (embeddings/actions)
 * and the retrieval pipeline (chat/actions) must use the same model and dimensions,
 * otherwise cosine similarity scores become meaningless.
 */
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;
