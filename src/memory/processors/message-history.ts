/**
 * Message History Processor
 * Based on Mastra MessageHistory processor
 */

import type { MemoryProcessor, ProcessorContext } from "./base.js";
import type { CoreMessage } from "../types.js";
import type { MemoryStorage } from "../storage/base.js";

/**
 * Message history processor configuration
 */
export interface MessageHistoryProcessorConfig {
  storage: MemoryStorage;
  lastMessages?: number;
}

/**
 * Message History Processor
 * 
 * Retrieves recent messages from storage for context continuity.
 */
export class MessageHistory implements MemoryProcessor {
  readonly id = "message-history";
  readonly name = "Message History Processor";

  private storage: MemoryStorage;
  private lastMessages: number;

  constructor(config: MessageHistoryProcessorConfig) {
    this.storage = config.storage;
    this.lastMessages = config.lastMessages ?? 10;
  }

  async processInputStep(args: {
    messages: CoreMessage[];
    context: ProcessorContext;
  }): Promise<CoreMessage[]> {
    const { messages, context } = args;

    // Get recent messages from storage
    const { messages: storedMessages } = await this.storage.listMessages({
      threadId: context.threadId,
      perPage: this.lastMessages,
      orderBy: { field: "createdAt", direction: "DESC" },
    });

    // Reverse to get chronological order
    const chronologicalMessages = storedMessages.reverse();

    // Merge with incoming messages, avoiding duplicates
    const incomingIds = new Set(messages.map(m => m.id));
    const newMessages = chronologicalMessages.filter(m => !incomingIds.has(m.id));

    return [...newMessages, ...messages];
  }

  async processOutputResult(args: {
    messages: CoreMessage[];
    context: ProcessorContext;
  }): Promise<CoreMessage[]> {
    const { messages, context } = args;

    // Check if read-only
    if (context.memoryConfig?.readOnly) {
      return messages;
    }

    // Save new messages to storage
    const existingMessages = await this.storage.listMessages({
      threadId: context.threadId,
      perPage: 1000,
    });

    const existingIds = new Set(existingMessages.messages.map(m => m.id));
    const newMessages = messages.filter(m => !existingIds.has(m.id));

    if (newMessages.length > 0) {
      await this.storage.saveMessages({ messages: newMessages });
    }

    return messages;
  }
}
