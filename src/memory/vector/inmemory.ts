/**
 * In-Memory Vector Store Implementation
 * Based on Mastra vector store patterns
 */

import { VectorStore, type CreateIndexParams, type UpsertVectorParams, type QueryVectorParams, type UpdateVectorParams, type DeleteVectorParams, type DeleteVectorsParams } from "./base.js";
import type { IndexStats, VectorQueryResult } from "../types.js";

/**
 * Vector record stored in the index
 */
interface VectorRecord {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Index configuration
 */
interface IndexConfig {
  dimension: number;
  metric: "cosine" | "euclidean" | "dotproduct";
  vectors: Map<string, VectorRecord>;
}

/**
 * In-Memory Vector Store Implementation
 */
export class InMemoryVectorStore extends VectorStore {
  readonly id = "inmemory";

  private indexes = new Map<string, IndexConfig>();

  async createIndex(params: CreateIndexParams): Promise<void> {
    const { indexName, dimension, metric = "cosine", indexConfig } = params;

    if (this.indexes.has(indexName)) {
      // Validate existing index
      const existing = this.indexes.get(indexName)!;
      if (existing.dimension !== dimension) {
        throw new Error(
          `Index "${indexName}" already exists with dimension ${existing.dimension}, but ${dimension} was requested.`
        );
      }
      return;
    }

    this.indexes.set(indexName, {
      dimension,
      metric,
      vectors: new Map(),
    });
  }

  async upsert(params: UpsertVectorParams): Promise<string[]> {
    const { indexName, vectors, metadata, ids } = params;

    const index = this.indexes.get(indexName);
    if (!index) {
      throw new Error(`Index "${indexName}" does not exist. Create it first with createIndex().`);
    }

    const generatedIds: string[] = [];

    for (let i = 0; i < vectors.length; i++) {
      const vector = vectors[i];
      
      // Validate vector dimension
      if (vector.length !== index.dimension) {
        throw new Error(
          `Vector at index ${i} has dimension ${vector.length}, but index "${indexName}" expects ${index.dimension}.`
        );
      }

      const id = ids?.[i] ?? crypto.randomUUID();
      
      index.vectors.set(id, {
        id,
        vector,
        metadata: metadata?.[i],
      });

      generatedIds.push(id);
    }

    return generatedIds;
  }

  async query(params: QueryVectorParams): Promise<VectorQueryResult[]> {
    const { indexName, queryVector, topK = 10, filter, includeVector, minScore } = params;

    const index = this.indexes.get(indexName);
    if (!index) {
      throw new Error(`Index "${indexName}" does not exist.`);
    }

    // Validate query vector dimension
    if (queryVector.length !== index.dimension) {
      throw new Error(
        `Query vector has dimension ${queryVector.length}, but index "${indexName}" expects ${index.dimension}.`
      );
    }

    const results: VectorQueryResult[] = [];

    for (const [id, record] of index.vectors) {
      // Apply filter if provided
      if (filter && !this.matchesFilter(record.metadata, filter)) {
        continue;
      }

      const score = this.calculateSimilarity(queryVector, record.vector, index.metric);
      
      // Apply minimum score filter
      if (minScore !== undefined && score < minScore) {
        continue;
      }

      results.push({
        id,
        score,
        metadata: record.metadata,
        vector: includeVector ? record.vector : undefined,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  async updateVector(params: UpdateVectorParams): Promise<void> {
    const { indexName, id, vector, metadata } = params;

    const index = this.indexes.get(indexName);
    if (!index) {
      throw new Error(`Index "${indexName}" does not exist.`);
    }

    const existing = index.vectors.get(id);
    if (!existing) {
      throw new Error(`Vector with id "${id}" not found in index "${indexName}".`);
    }

    if (vector) {
      if (vector.length !== index.dimension) {
        throw new Error(
          `Vector has dimension ${vector.length}, but index "${indexName}" expects ${index.dimension}.`
        );
      }
      existing.vector = vector;
    }

    if (metadata) {
      existing.metadata = { ...existing.metadata, ...metadata };
    }
  }

  async deleteVector(params: DeleteVectorParams): Promise<void> {
    const { indexName, id } = params;

    const index = this.indexes.get(indexName);
    if (!index) {
      throw new Error(`Index "${indexName}" does not exist.`);
    }

    if (!index.vectors.delete(id)) {
      throw new Error(`Vector with id "${id}" not found in index "${indexName}".`);
    }
  }

  async deleteVectors(params: DeleteVectorsParams): Promise<void> {
    const { indexName, ids, filter } = params;

    const index = this.indexes.get(indexName);
    if (!index) {
      throw new Error(`Index "${indexName}" does not exist.`);
    }

    if (ids) {
      for (const id of ids) {
        index.vectors.delete(id);
      }
    } else if (filter) {
      // Delete by filter
      for (const [id, record] of index.vectors) {
        if (this.matchesFilter(record.metadata, filter)) {
          index.vectors.delete(id);
        }
      }
    }
  }

  async listIndexes(): Promise<string[]> {
    return Array.from(this.indexes.keys());
  }

  async describeIndex(params: { indexName: string }): Promise<IndexStats> {
    const { indexName } = params;

    const index = this.indexes.get(indexName);
    if (!index) {
      throw new Error(`Index "${indexName}" does not exist.`);
    }

    return {
      dimension: index.dimension,
      metric: index.metric,
      count: index.vectors.size,
    };
  }

  async deleteIndex(params: { indexName: string }): Promise<void> {
    const { indexName } = params;

    if (!this.indexes.delete(indexName)) {
      throw new Error(`Index "${indexName}" does not exist.`);
    }
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  /**
   * Calculate similarity between two vectors
   */
  private calculateSimilarity(
    a: number[],
    b: number[],
    metric: "cosine" | "euclidean" | "dotproduct",
  ): number {
    switch (metric) {
      case "cosine":
        return this.cosineSimilarity(a, b);
      case "euclidean":
        return this.euclideanSimilarity(a, b);
      case "dotproduct":
        return this.dotProduct(a, b);
      default:
        return this.cosineSimilarity(a, b);
    }
  }

  /**
   * Cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Euclidean similarity (1 / (1 + distance))
   */
  private euclideanSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let sumSquared = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sumSquared += diff * diff;
    }

    const distance = Math.sqrt(sumSquared);
    return 1 / (1 + distance);
  }

  /**
   * Dot product
   */
  private dotProduct(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result += a[i] * b[i];
    }

    return result;
  }

  /**
   * Check if metadata matches filter
   */
  private matchesFilter(
    metadata: Record<string, unknown> | undefined,
    filter: Record<string, unknown>,
  ): boolean {
    if (!metadata) return false;

    for (const [key, value] of Object.entries(filter)) {
      if (metadata[key] !== value) {
        return false;
      }
    }

    return true;
  }
}
