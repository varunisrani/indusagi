/**
 * Main Memory Class
 * Based on Mastra Memory implementation
 */

import type { CoreMessage, MemoryConfig, StorageThreadType, SharedMemoryConfig, WorkingMemoryTemplate, EmbedderOptions } from "./types.js";
import { memoryDefaultOptions, DEFAULT_SEMANTIC_RECALL } from "./types.js";
import type { MemoryStorage } from "./storage/base.js";
import { InMemoryStorage } from "./storage/inmemory.js";
import type { VectorStore } from "./vector/base.js";
import { InMemoryVectorStore } from "./vector/inmemory.js";
import type { Embedder } from "./embedder/base.js";
import type { MemoryProcessor, ProcessorContext } from "./processors/base.js";
import { WorkingMemory } from "./processors/working-memory.js";
import { SemanticRecall } from "./processors/semantic-recall.js";
import { MessageHistory } from "./processors/message-history.js";

/**
 * Memory class that orchestrates all memory processors and storage
 */
export class Memory {
  private storage: MemoryStorage;
  private vector?: VectorStore;
  private embedder?: Embedder;
  private embedderOptions?: EmbedderOptions;
  private config: MemoryConfig;
  private processors: MemoryProcessor[] = [];

  constructor(options: SharedMemoryConfig = {}) {
    this.storage = options.storage ?? new InMemoryStorage();
    this.vector = options.vector;
    this.embedder = options.embedder;
    this.embedderOptions = options.embedderOptions;
    this.config = { ...memoryDefaultOptions, ...options.options };

    this.initializeProcessors();
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  private initializeProcessors(): void {
    // Working memory processor
    if (this.config.workingMemory && 
        typeof this.config.workingMemory === "object" && 
        this.config.workingMemory.enabled !== false) {
      this.processors.push(new WorkingMemory({
        storage: this.storage,
        scope: typeof this.config.workingMemory === "object" 
          ? this.config.workingMemory.scope 
          : "resource",
      }));
    }

    // Semantic recall processor
    if (this.config.semanticRecall && this.vector && this.embedder) {
      const semanticConfig = typeof this.config.semanticRecall === "object"
        ? this.config.semanticRecall
        : DEFAULT_SEMANTIC_RECALL;

      const indexName = this.getEmbeddingIndexName();

      this.processors.push(new SemanticRecall({
        storage: this.storage,
        vector: this.vector,
        embedder: this.embedder,
        embedderOptions: this.embedderOptions,
        indexName,
        topK: semanticConfig.topK,
        messageRange: semanticConfig.messageRange,
        scope: semanticConfig.scope,
        threshold: semanticConfig.threshold,
      }));
    }

    // Message history processor
    if (this.config.lastMessages) {
      this.processors.push(new MessageHistory({
        storage: this.storage,
        lastMessages: typeof this.config.lastMessages === "number" 
          ? this.config.lastMessages 
          : 10,
      }));
    }
  }

  /**
   * Initialize memory system
   */
  async init(): Promise<void> {
    await this.storage.init();

    // Create vector index if needed
    if (this.vector && this.embedder) {
      const indexName = this.getEmbeddingIndexName();
      const indexes = await this.vector.listIndexes();
      
      if (!indexes.includes(indexName)) {
        await this.vector.createIndex({
          indexName,
          dimension: this.embedder.dimensions,
          metric: "cosine",
        });
      }
    }
  }

  // ========================================================================
  // Processor Pipeline
  // ========================================================================

  /**
   * Process messages before sending to LLM
   */
  async processInput(args: {
    messages: CoreMessage[];
    threadId: string;
    resourceId: string;
    memoryConfig?: MemoryConfig;
    signal?: AbortSignal;
  }): Promise<CoreMessage[]> {
    let result = args.messages;
    const context: ProcessorContext = {
      threadId: args.threadId,
      resourceId: args.resourceId,
      memoryConfig: args.memoryConfig ?? this.config,
      signal: args.signal,
    };

    for (const processor of this.processors) {
      if (processor.processInputStep) {
        result = await processor.processInputStep({ messages: result, context });
      }
    }

    return result;
  }

  /**
   * Process messages after receiving from LLM
   */
  async processOutput(args: {
    messages: CoreMessage[];
    threadId: string;
    resourceId: string;
    memoryConfig?: MemoryConfig;
    signal?: AbortSignal;
  }): Promise<CoreMessage[]> {
    let result = args.messages;
    const context: ProcessorContext = {
      threadId: args.threadId,
      resourceId: args.resourceId,
      memoryConfig: args.memoryConfig ?? this.config,
      signal: args.signal,
    };

    for (const processor of this.processors) {
      if (processor.processOutputResult) {
        result = await processor.processOutputResult({ messages: result, context });
      }
    }

    return result;
  }

  // ========================================================================
  // Thread Operations
  // ========================================================================

  /**
   * Get a thread by ID
   */
  async getThread(threadId: string): Promise<StorageThreadType | null> {
    return this.storage.getThreadById({ threadId });
  }

  /**
   * Create a new thread
   */
  async createThread(args: {
    threadId?: string;
    resourceId: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    const thread: StorageThreadType = {
      id: args.threadId ?? crypto.randomUUID(),
      resourceId: args.resourceId,
      title: args.title,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: args.metadata,
    };
    return this.storage.saveThread({ thread });
  }

  /**
   * List threads
   */
  async listThreads(args: {
    resourceId: string;
    limit?: number;
    offset?: number;
  }): Promise<{ threads: StorageThreadType[]; total: number }> {
    const result = await this.storage.listThreads({
      filter: { resourceId: args.resourceId },
      perPage: args.limit ?? 50,
      page: args.offset ? Math.floor(args.offset / (args.limit ?? 50)) : 0,
    });
    return { threads: result.threads, total: result.total };
  }

  /**
   * Delete a thread
   */
  async deleteThread(threadId: string): Promise<void> {
    return this.storage.deleteThread({ threadId });
  }

  // ========================================================================
  // Message Operations
  // ========================================================================

  /**
   * Get messages for a thread
   */
  async getMessages(args: {
    threadId: string;
    limit?: number;
    offset?: number;
  }): Promise<{ messages: CoreMessage[]; total: number }> {
    const result = await this.storage.listMessages({
      threadId: args.threadId,
      perPage: args.limit ?? 100,
      page: args.offset ? Math.floor(args.offset / (args.limit ?? 100)) : 0,
    });
    return { messages: result.messages, total: result.total };
  }

  /**
   * Save messages
   */
  async saveMessages(threadId: string, messages: CoreMessage[]): Promise<void> {
    const messagesWithThreadId = messages.map(m => ({
      ...m,
      threadId: m.threadId ?? threadId,
    }));
    await this.storage.saveMessages({ messages: messagesWithThreadId });
  }

  // ========================================================================
  // Working Memory Operations
  // ========================================================================

  /**
   * Get working memory
   */
  async getWorkingMemory(args: {
    threadId: string;
    resourceId?: string;
    scope?: "thread" | "resource";
  }): Promise<string | null> {
    const scope = args.scope ?? "resource";

    if (scope === "thread") {
      const thread = await this.storage.getThreadById({ threadId: args.threadId });
      return (thread?.metadata?.workingMemory as string) ?? null;
    } else {
      const resource = await this.storage.getResourceById({ resourceId: args.resourceId ?? "" });
      return resource?.workingMemory ?? null;
    }
  }

  /**
   * Update working memory
   */
  async updateWorkingMemory(args: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    scope?: "thread" | "resource";
  }): Promise<void> {
    const scope = args.scope ?? "resource";

    if (scope === "thread") {
      const thread = await this.storage.getThreadById({ threadId: args.threadId });
      if (thread) {
        await this.storage.updateThread({
          id: args.threadId,
          metadata: { ...thread.metadata, workingMemory: args.workingMemory },
        });
      }
    } else {
      await this.storage.updateResource({
        resourceId: args.resourceId ?? "",
        workingMemory: args.workingMemory,
      });
    }
  }

  /**
   * Get working memory template
   */
  async getWorkingMemoryTemplate(args: {
    memoryConfig?: MemoryConfig;
  }): Promise<WorkingMemoryTemplate | null> {
    const config = args.memoryConfig ?? this.config;
    
    if (config.workingMemory && 
        typeof config.workingMemory === "object" && 
        "template" in config.workingMemory &&
        config.workingMemory.template) {
      return {
        format: "markdown",
        content: config.workingMemory.template,
      };
    }

    return null;
  }

  // ========================================================================
  // Resource Operations
  // ========================================================================

  /**
   * Get a resource by ID
   */
  async getResource(resourceId: string): Promise<{ id: string; workingMemory?: string; metadata?: Record<string, unknown> } | null> {
    const resource = await this.storage.getResourceById({ resourceId });
    if (!resource) return null;
    return { id: resourceId, workingMemory: resource.workingMemory, metadata: resource.metadata };
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  /**
   * Get memory configuration
   */
  getConfig(): MemoryConfig {
    return { ...this.config };
  }

  /**
   * Get merged thread configuration
   */
  getMergedThreadConfig(config?: MemoryConfig): MemoryConfig {
    return { ...this.config, ...config };
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private getEmbeddingIndexName(): string {
    const defaultDimensions = 1536;
    const dimensions = this.embedder?.dimensions ?? defaultDimensions;
    const separator = this.vector?.indexSeparator ?? "_";
    
    return dimensions === defaultDimensions
      ? `memory${separator}messages`
      : `memory${separator}messages${separator}${dimensions}`;
  }
}
