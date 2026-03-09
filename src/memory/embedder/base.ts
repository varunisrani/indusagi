/**
 * Embedder Abstract Base Class
 * Based on Mastra Embedder patterns
 */

import type { EmbeddingResult, EmbedderOptions } from "../types.js";

/**
 * Embedder configuration
 */
export interface EmbedderConfig {
  model: string;
  dimensions?: number;
  batchSize?: number;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Abstract base class for embedding model implementations
 */
export abstract class Embedder {
  /**
   * Embedder name/identifier
   */
  abstract readonly name: string;

  /**
   * Model identifier
   */
  abstract readonly model: string;

  /**
   * Output dimensions
   */
  abstract readonly dimensions: number;

  /**
   * Generate embedding for a single text
   */
  abstract embed(text: string, options?: EmbedderOptions): Promise<EmbeddingResult>;

  /**
   * Generate embeddings for multiple texts
   */
  abstract embedBatch(texts: string[], options?: EmbedderOptions): Promise<EmbeddingResult[]>;
}
