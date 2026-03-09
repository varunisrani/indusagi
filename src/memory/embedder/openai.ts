/**
 * OpenAI Embedder Implementation
 * Based on Mastra embedder patterns
 */

import { Embedder, type EmbedderConfig } from "./base.js";
import type { EmbeddingResult, EmbedderOptions } from "../types.js";

/**
 * OpenAI API response type
 */
interface OpenAIEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Embedder Configuration
 */
export interface OpenAIEmbedderConfig extends EmbedderConfig {
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
}

/**
 * Default dimensions for OpenAI embedding models
 */
const MODEL_DIMENSIONS: Record<string, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
};

/**
 * OpenAI Embedder Implementation
 */
export class OpenAIEmbedder extends Embedder {
  readonly name = "openai";
  readonly model: string;
  readonly dimensions: number;

  private apiKey: string;
  private baseUrl: string;
  private organization?: string;
  private batchSize: number;

  constructor(config: OpenAIEmbedderConfig) {
    super();
    
    this.model = config.model ?? "text-embedding-3-small";
    this.dimensions = config.dimensions ?? MODEL_DIMENSIONS[this.model] ?? 1536;
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
    this.organization = config.organization;
    this.batchSize = config.batchSize ?? 100;

    if (!this.apiKey) {
      throw new Error(
        "OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in config."
      );
    }
  }

  async embed(text: string, options?: EmbedderOptions): Promise<EmbeddingResult> {
    const results = await this.embedBatch([text], options);
    return results[0];
  }

  async embedBatch(texts: string[], options?: EmbedderOptions): Promise<EmbeddingResult[]> {
    // Process in batches to avoid API limits
    const results: EmbeddingResult[] = [];
    
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const batchResults = await this.embedBatchInternal(batch, options);
      results.push(...batchResults);
    }

    return results;
  }

  private async embedBatchInternal(
    texts: string[],
    options?: EmbedderOptions,
  ): Promise<EmbeddingResult[]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (this.organization) {
      headers["OpenAI-Organization"] = this.organization;
    }

    const body: Record<string, unknown> = {
      input: texts,
      model: this.model,
      dimensions: options?.dimensions ?? this.dimensions,
    };

    // Add provider options if provided
    if (options?.providerOptions) {
      Object.assign(body, options.providerOptions);
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `OpenAI embedding failed: ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Use default error message
      }

      throw new Error(errorMessage);
    }

    const data = (await response.json()) as OpenAIEmbeddingResponse;

    // Sort by index to ensure correct order
    const sortedData = [...data.data].sort((a, b) => a.index - b.index);

    return sortedData.map((item, i) => ({
      vector: item.embedding,
      model: this.model,
      dimensions: item.embedding.length,
      usage: {
        inputTokens: Math.round(data.usage.prompt_tokens / texts.length),
      },
    }));
  }
}

/**
 * Create an OpenAI embedder with default configuration
 */
export function createOpenAIEmbedder(config?: Partial<OpenAIEmbedderConfig>): OpenAIEmbedder {
  return new OpenAIEmbedder({
    model: "text-embedding-3-small",
    ...config,
  });
}
