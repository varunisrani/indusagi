/**
 * Vector Store Abstract Base Class
 * Based on Mastra MastraVector
 */

import type { IndexStats, VectorQueryResult } from "../types.js";

/**
 * Create index parameters
 */
export interface CreateIndexParams {
  indexName: string;
  dimension: number;
  metric?: "cosine" | "euclidean" | "dotproduct";
  indexConfig?: {
    type?: "ivfflat" | "hnsw" | "flat";
    ivf?: { lists?: number };
    hnsw?: { m?: number; efConstruction?: number };
  };
}

/**
 * Upsert vector parameters
 */
export interface UpsertVectorParams {
  indexName: string;
  vectors: number[][];
  metadata?: Record<string, unknown>[];
  ids?: string[];
}

/**
 * Query vector parameters
 */
export interface QueryVectorParams {
  indexName: string;
  queryVector: number[];
  topK?: number;
  filter?: Record<string, unknown>;
  includeVector?: boolean;
  minScore?: number;
}

/**
 * Update vector parameters
 */
export interface UpdateVectorParams {
  indexName: string;
  id: string;
  vector?: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Delete vector parameters
 */
export interface DeleteVectorParams {
  indexName: string;
  id: string;
}

/**
 * Delete vectors parameters
 */
export interface DeleteVectorsParams {
  indexName: string;
  ids?: string[];
  filter?: Record<string, unknown>;
}

/**
 * Describe index parameters
 */
export interface DescribeIndexParams {
  indexName: string;
}

/**
 * Delete index parameters
 */
export interface DeleteIndexParams {
  indexName: string;
}

/**
 * Abstract base class for vector store implementations
 */
export abstract class VectorStore {
  /**
   * Unique identifier for this vector store
   */
  abstract readonly id: string;

  /**
   * Index separator used for generating index names
   */
  readonly indexSeparator: string = "_";

  // ========================================================================
  // Abstract Methods
  // ========================================================================

  /**
   * Create a new vector index
   */
  abstract createIndex(params: CreateIndexParams): Promise<void>;

  /**
   * Upsert vectors into an index
   */
  abstract upsert(params: UpsertVectorParams): Promise<string[]>;

  /**
   * Query vectors from an index
   */
  abstract query(params: QueryVectorParams): Promise<VectorQueryResult[]>;

  /**
   * Update a vector in an index
   */
  abstract updateVector(params: UpdateVectorParams): Promise<void>;

  /**
   * Delete a single vector from an index
   */
  abstract deleteVector(params: DeleteVectorParams): Promise<void>;

  /**
   * Delete multiple vectors from an index
   */
  abstract deleteVectors(params: DeleteVectorsParams): Promise<void>;

  /**
   * List all indexes
   */
  abstract listIndexes(): Promise<string[]>;

  /**
   * Describe an index
   */
  abstract describeIndex(params: DescribeIndexParams): Promise<IndexStats>;

  /**
   * Delete an index
   */
  abstract deleteIndex(params: DeleteIndexParams): Promise<void>;

  // ========================================================================
  // Protected Helpers
  // ========================================================================

  /**
   * Validate existing index dimensions
   */
  protected async validateExistingIndex(
    indexName: string,
    dimension: number,
    metric: string,
  ): Promise<void> {
    try {
      const stats = await this.describeIndex({ indexName });
      if (stats.dimension !== dimension) {
        throw new Error(
          `Index "${indexName}" already exists with dimension ${stats.dimension}, but ${dimension} was requested. ` +
          `Use a different index name or delete the existing index first.`
        );
      }
      if (stats.metric && stats.metric !== metric) {
        throw new Error(
          `Index "${indexName}" already exists with metric ${stats.metric}, but ${metric} was requested. ` +
          `Use a different index name or delete the existing index first.`
        );
      }
    } catch (error) {
      // Index doesn't exist, which is fine
      if ((error as Error).message?.includes("does not exist")) {
        return;
      }
      throw error;
    }
  }
}

/**
 * Validate upsert input
 */
export function validateUpsertInput(
  storeName: string,
  vectors: number[][],
  metadata?: Record<string, unknown>[],
  ids?: string[],
): void {
  if (!vectors || vectors.length === 0) {
    throw new Error(`${storeName}: No vectors provided for upsert`);
  }

  if (metadata && metadata.length !== vectors.length) {
    throw new Error(
      `${storeName}: Metadata array length (${metadata.length}) must match vectors length (${vectors.length})`
    );
  }

  if (ids && ids.length !== vectors.length) {
    throw new Error(
      `${storeName}: IDs array length (${ids.length}) must match vectors length (${vectors.length})`
    );
  }
}

/**
 * Validate topK value
 */
export function validateTopK(storeName: string, topK?: number): void {
  if (topK !== undefined && (!Number.isInteger(topK) || topK <= 0)) {
    throw new Error(`${storeName}: topK must be a positive integer`);
  }
}

/**
 * Validate vector values
 */
export function validateVectorValues(storeName: string, vectors: number[][]): void {
  for (let i = 0; i < vectors.length; i++) {
    const vector = vectors[i];
    if (!Array.isArray(vector)) {
      throw new Error(`${storeName}: Vector at index ${i} is not an array`);
    }
    if (vector.length === 0) {
      throw new Error(`${storeName}: Vector at index ${i} is empty`);
    }
    for (let j = 0; j < vector.length; j++) {
      if (typeof vector[j] !== "number" || !Number.isFinite(vector[j])) {
        throw new Error(
          `${storeName}: Invalid vector value at index [${i}][${j}]: ${vector[j]}`
        );
      }
    }
  }
}
