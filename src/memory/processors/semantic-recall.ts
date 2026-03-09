/**
 * Semantic Recall Processor
 * Based on Mastra SemanticRecall processor
 */

import type { MemoryProcessor, ProcessorContext } from "./base.js";
import type { CoreMessage, SemanticRecallConfig, MessageContentV2, EmbedderOptions } from "../types.js";
import type { MemoryStorage } from "../storage/base.js";
import type { VectorStore } from "../vector/base.js";
import type { Embedder } from "../embedder/base.js";

/**
 * Semantic recall processor configuration
 */
export interface SemanticRecallProcessorConfig {
  storage: MemoryStorage;
  vector: VectorStore;
  embedder: Embedder;
  embedderOptions?: EmbedderOptions;
  indexName: string;
  topK?: number;
  messageRange?: number | { before: number; after: number };
  scope?: "thread" | "resource";
  threshold?: number;
}

/**
 * Default message range configuration
 */
const DEFAULT_MESSAGE_RANGE = { before: 1, after: 1 };
const DEFAULT_TOP_K = 4;

/**
 * Semantic Recall Processor
 * 
 * Retrieves relevant past messages using vector similarity search.
 */
export class SemanticRecall implements MemoryProcessor {
  readonly id = "semantic-recall";
  readonly name = "Semantic Recall Processor";

  private storage: MemoryStorage;
  private vector: VectorStore;
  private embedder: Embedder;
  private embedderOptions?: EmbedderOptions;
  private indexName: string;
  private topK: number;
  private messageRange: number | { before: number; after: number };
  private scope: "thread" | "resource";
  private threshold: number;

  constructor(config: SemanticRecallProcessorConfig) {
    this.storage = config.storage;
    this.vector = config.vector;
    this.embedder = config.embedder;
    this.embedderOptions = config.embedderOptions;
    this.indexName = config.indexName;
    this.topK = config.topK ?? DEFAULT_TOP_K;
    this.messageRange = config.messageRange ?? DEFAULT_MESSAGE_RANGE;
    this.scope = config.scope ?? "resource";
    this.threshold = config.threshold ?? 0.7;
  }

  async processInputStep(args: {
    messages: CoreMessage[];
    context: ProcessorContext;
  }): Promise<CoreMessage[]> {
    const { messages, context } = args;

    // Get the last user message as query
    const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
    if (!lastUserMessage) return messages;

    const queryText = this.messageToText(lastUserMessage);

    // Embed the query
    const { vector: queryVector } = await this.embedder.embed(queryText, this.embedderOptions);

    // Search for similar messages
    const results = await this.vector.query({
      indexName: this.indexName,
      queryVector,
      topK: this.topK,
      minScore: this.threshold,
      filter: {
        resourceId: context.resourceId,
        ...(this.scope === "thread" && { threadId: context.threadId }),
      },
    });

    if (results.length === 0) return messages;

    // Get message context (before/after each match)
    const messageRange = typeof this.messageRange === "number"
      ? { before: this.messageRange, after: this.messageRange }
      : this.messageRange;

    const retrievedMessages: CoreMessage[] = [];
    const retrievedIds = new Set<string>();

    for (const result of results) {
      const msgId = result.metadata?.messageId as string;
      const msgThreadId = result.metadata?.threadId as string;
      
      if (!msgId || !msgThreadId) continue;

      // Get surrounding messages
      const { messages: threadMessages } = await this.storage.listMessages({
        threadId: msgThreadId,
        perPage: 1000, // Get all messages to find context
      });

      const msgIndex = threadMessages.findIndex(m => m.id === msgId);
      if (msgIndex === -1) continue;

      const start = Math.max(0, msgIndex - messageRange.before);
      const end = Math.min(threadMessages.length, msgIndex + messageRange.after + 1);

      for (let i = start; i < end; i++) {
        const msg = threadMessages[i];
        if (msg && !retrievedIds.has(msg.id)) {
          retrievedMessages.push(msg);
          retrievedIds.add(msg.id);
        }
      }
    }

    if (retrievedMessages.length === 0) return messages;

    // Sort retrieved messages by date
    retrievedMessages.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Remove duplicates from original messages
    const filteredMessages = messages.filter(m => !retrievedIds.has(m.id));

    // Insert semantic recall marker
    const recallMarker: CoreMessage = {
      id: `semantic-recall-${Date.now()}`,
      role: "system",
      content: `<semantic_recall>\nRelevant past conversation retrieved based on semantic similarity:\n</semantic_recall>`,
      createdAt: new Date(),
    };

    return [recallMarker, ...retrievedMessages, ...filteredMessages];
  }

  async processOutputResult(args: {
    messages: CoreMessage[];
    context: ProcessorContext;
  }): Promise<CoreMessage[]> {
    const { messages, context } = args;

    // Embed and store new messages
    for (const message of messages) {
      if (message.role !== "user" && message.role !== "assistant") continue;
      if (message.id.startsWith("working-memory-") || message.id.startsWith("semantic-recall-")) continue;

      const text = this.messageToText(message);
      if (!text.trim()) continue;

      try {
        const { vector } = await this.embedder.embed(text, this.embedderOptions);

        await this.vector.upsert({
          indexName: this.indexName,
          vectors: [vector],
          metadata: [{
            messageId: message.id,
            threadId: context.threadId,
            resourceId: context.resourceId,
            role: message.role,
            timestamp: new Date(message.createdAt).getTime(),
          }],
          ids: [`${context.threadId}-${message.id}`],
        });
      } catch (error) {
        console.error(`Failed to embed message ${message.id}:`, error);
      }
    }

    return messages;
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private messageToText(message: CoreMessage): string {
    if (typeof message.content === "string") return message.content;
    
    const content = message.content as MessageContentV2;
    if (content.parts) {
      return content.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map(p => p.text)
        .join("\n");
    }
    
    return content.content ?? "";
  }
}
