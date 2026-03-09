/**
 * In-Memory Storage Implementation
 * Based on Mastra InMemoryMemory
 */

import type {
  CoreMessage,
  MessageContentV2,
  StorageThreadType,
  StorageResourceType,
  StorageMessageType,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  ObservationalMemoryRecord,
  BufferedObservationChunk,
} from "../types.js";
import {
  MemoryStorage,
  normalizePerPage,
  calculatePagination,
  type CreateObservationalMemoryInput,
  type UpdateActiveObservationsInput,
  type UpdateBufferedObservationsInput,
  type SwapBufferedToActiveInput,
  type SwapBufferedToActiveResult,
  type CreateReflectionGenerationInput,
  type UpdateBufferedReflectionInput,
  type SwapBufferedReflectionToActiveInput,
} from "./base.js";

/**
 * In-memory database structure
 */
export interface InMemoryDB {
  threads: Map<string, StorageThreadType>;
  messages: Map<string, StorageMessageType>;
  resources: Map<string, StorageResourceType>;
  observationalMemory: Map<string, ObservationalMemoryRecord[]>;
}

/**
 * Create a new in-memory database
 */
export function createInMemoryDB(): InMemoryDB {
  return {
    threads: new Map(),
    messages: new Map(),
    resources: new Map(),
    observationalMemory: new Map(),
  };
}

/**
 * In-Memory Storage Implementation
 */
export class InMemoryStorage extends MemoryStorage {
  readonly name = "inmemory";
  readonly supportsObservationalMemory = true;

  private db: InMemoryDB;

  constructor(db?: InMemoryDB) {
    super();
    this.db = db ?? createInMemoryDB();
  }

  async init(): Promise<void> {
    // Nothing to initialize for in-memory storage
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.threads.clear();
    this.db.messages.clear();
    this.db.resources.clear();
    this.db.observationalMemory.clear();
  }

  // ========================================================================
  // Thread Operations
  // ========================================================================

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const thread = this.db.threads.get(threadId);
    return thread ? { ...thread, metadata: thread.metadata ? { ...thread.metadata } : thread.metadata } : null;
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    this.db.threads.set(thread.id, thread);
    return thread;
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    const thread = this.db.threads.get(id);

    if (!thread) {
      throw new Error(`Thread with id ${id} not found`);
    }

    if (title !== undefined) thread.title = title;
    if (metadata !== undefined) thread.metadata = { ...thread.metadata, ...metadata };
    thread.updatedAt = new Date();

    return thread;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    this.db.threads.delete(threadId);

    // Delete all messages in the thread
    for (const [key, msg] of this.db.messages) {
      if (msg.thread_id === threadId) {
        this.db.messages.delete(key);
      }
    }
  }

  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, filter } = args;
    const { field, direction } = this.parseOrderBy(orderBy);

    this.validatePaginationInput(page, perPageInput ?? 100);
    const perPage = normalizePerPage(perPageInput, 100);

    // Start with all threads
    let threads = Array.from(this.db.threads.values());

    // Apply resourceId filter if provided
    if (filter?.resourceId) {
      threads = threads.filter(t => t.resourceId === filter.resourceId);
    }

    // Validate and apply metadata filter
    this.validateMetadataKeys(filter?.metadata);

    if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
      threads = threads.filter(thread => {
        if (!thread.metadata) return false;
        return Object.entries(filter.metadata!).every(
          ([key, value]) => deepEquals(thread.metadata![key], value)
        );
      });
    }

    // Sort threads
    threads.sort((a, b) => {
      const aValue = new Date(a[field]).getTime();
      const bValue = new Date(b[field]).getTime();
      return direction === "ASC" ? aValue - bValue : bValue - aValue;
    });

    // Clone threads for output
    const clonedThreads = threads.map(thread => ({
      ...thread,
      metadata: thread.metadata ? { ...thread.metadata } : thread.metadata,
    }));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      threads: clonedThreads.slice(offset, offset + perPage),
      total: clonedThreads.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedThreads.length,
    };
  }

  // ========================================================================
  // Message Operations
  // ========================================================================

  async listMessages({
    threadId,
    resourceId: optionalResourceId,
    include,
    filter,
    perPage: perPageInput,
    page = 0,
    orderBy,
  }: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw new Error("threadId must be a non-empty string or array of non-empty strings");
    }

    const threadIdSet = new Set(threadIds);
    const { field, direction } = this.parseOrderBy(orderBy, "ASC");

    const perPage = normalizePerPage(perPageInput, 40);

    if (page < 0) {
      throw new Error("page must be >= 0");
    }

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    // Get messages matching threadId(s)
    let threadMessages = Array.from(this.db.messages.values()).filter(msg => {
      if (threadIdSet && !threadIdSet.has(msg.thread_id)) return false;
      if (optionalResourceId && msg.resourceId !== optionalResourceId) return false;
      return true;
    });

    // Apply date filtering
    if (filter?.dateRange) {
      const { start, end } = filter.dateRange;
      if (start) {
        threadMessages = threadMessages.filter(msg => new Date(msg.createdAt) >= start);
      }
      if (end) {
        threadMessages = threadMessages.filter(msg => new Date(msg.createdAt) <= end);
      }
    }

    // Sort messages
    threadMessages.sort((a, b) => {
      const aDate = field === "updatedAt" ? a.updatedAt : a.createdAt;
      const bDate = field === "updatedAt" ? b.updatedAt : b.createdAt;
      const aValue = new Date(aDate ?? a.createdAt).getTime();
      const bValue = new Date(bDate ?? b.createdAt).getTime();
      return direction === "ASC" ? aValue - bValue : bValue - aValue;
    });

    const totalThreadMessages = threadMessages.length;

    // Apply pagination
    const paginatedMessages = threadMessages.slice(offset, offset + perPage);

    // Convert to CoreMessage format
    const messages: CoreMessage[] = paginatedMessages.map(msg => this.parseStoredMessage(msg));
    const messageIds = new Set(messages.map(m => m.id));

    // Add included messages
    if (include && include.length > 0) {
      for (const includeItem of include) {
        const targetMessage = this.db.messages.get(includeItem.id);
        if (targetMessage && !messageIds.has(targetMessage.id)) {
          const convertedMessage = this.parseStoredMessage(targetMessage);
          messages.push(convertedMessage);
          messageIds.add(targetMessage.id);
        }
      }
    }

    // Final sort
    messages.sort((a, b) => {
      const aValue = new Date(a.createdAt).getTime();
      const bValue = new Date(b.createdAt).getTime();
      return direction === "ASC" ? aValue - bValue : bValue - aValue;
    });

    return {
      messages,
      total: totalThreadMessages,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < totalThreadMessages,
    };
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: CoreMessage[] }> {
    const rawMessages = messageIds
      .map(id => this.db.messages.get(id))
      .filter((msg): msg is StorageMessageType => !!msg);

    return {
      messages: rawMessages.map(m => this.parseStoredMessage(m)),
    };
  }

  async saveMessages(args: { messages: CoreMessage[] }): Promise<{ messages: CoreMessage[] }> {
    const { messages } = args;

    // Update thread timestamps
    const threadIds = new Set(messages.map(msg => msg.threadId).filter((id): id is string => Boolean(id)));
    for (const threadId of threadIds) {
      const thread = this.db.threads.get(threadId);
      if (thread) {
        thread.updatedAt = new Date();
      }
    }

    // Save messages
    for (const message of messages) {
      const storageMessage: StorageMessageType = {
        id: message.id,
        thread_id: message.threadId || "",
        content: typeof message.content === "string" 
          ? message.content 
          : JSON.stringify(message.content),
        role: message.role,
        type: "text",
        createdAt: message.createdAt,
        resourceId: message.resourceId || null,
      };
      this.db.messages.set(message.id, storageMessage);
    }

    return { messages };
  }

  async updateMessages(args: {
    messages: (Partial<Omit<CoreMessage, "createdAt">> & { id: string })[];
  }): Promise<CoreMessage[]> {
    const updatedMessages: CoreMessage[] = [];

    for (const update of args.messages) {
      const storageMsg = this.db.messages.get(update.id);
      if (!storageMsg) continue;

      if (update.role !== undefined) storageMsg.role = update.role;
      if (update.resourceId !== undefined) storageMsg.resourceId = update.resourceId;
      if (update.threadId !== undefined) storageMsg.thread_id = update.threadId;
      
      if (update.content !== undefined) {
        storageMsg.content = typeof update.content === "string"
          ? update.content
          : JSON.stringify(update.content);
      }

      updatedMessages.push(this.parseStoredMessage(storageMsg));
    }

    return updatedMessages;
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;

    const threadIds = new Set<string>();

    for (const messageId of messageIds) {
      const message = this.db.messages.get(messageId);
      if (message && message.thread_id) {
        threadIds.add(message.thread_id);
      }
      this.db.messages.delete(messageId);
    }

    // Update thread timestamps
    const now = new Date();
    for (const threadId of threadIds) {
      const thread = this.db.threads.get(threadId);
      if (thread) {
        thread.updatedAt = now;
      }
    }
  }

  // ========================================================================
  // Resource Operations
  // ========================================================================

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const resource = this.db.resources.get(resourceId);
    return resource
      ? { ...resource, metadata: resource.metadata ? { ...resource.metadata } : resource.metadata }
      : null;
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    this.db.resources.set(resource.id, resource);
    return resource;
  }

  async updateResource({
    resourceId,
    workingMemory,
    metadata,
  }: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    let resource = this.db.resources.get(resourceId);

    if (!resource) {
      resource = {
        id: resourceId,
        workingMemory,
        metadata: metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      resource = {
        ...resource,
        workingMemory: workingMemory !== undefined ? workingMemory : resource.workingMemory,
        metadata: {
          ...resource.metadata,
          ...metadata,
        },
        updatedAt: new Date(),
      };
    }

    this.db.resources.set(resourceId, resource);
    return resource;
  }

  // ========================================================================
  // Observational Memory Operations
  // ========================================================================

  private getObservationalMemoryKey(threadId: string | null, resourceId: string): string {
    if (threadId) {
      return `thread:${threadId}`;
    }
    return `resource:${resourceId}`;
  }

  async getObservationalMemory(threadId: string | null, resourceId: string): Promise<ObservationalMemoryRecord | null> {
    const key = this.getObservationalMemoryKey(threadId, resourceId);
    const records = this.db.observationalMemory.get(key);
    return records?.[0] ?? null;
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit?: number,
  ): Promise<ObservationalMemoryRecord[]> {
    const key = this.getObservationalMemoryKey(threadId, resourceId);
    const records = this.db.observationalMemory.get(key) ?? [];
    return limit != null ? records.slice(0, limit) : records;
  }

  async initializeObservationalMemory(input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    const { threadId, resourceId, scope, config, observedTimezone } = input;
    const key = this.getObservationalMemoryKey(threadId, resourceId);
    const now = new Date();

    const record: ObservationalMemoryRecord = {
      id: crypto.randomUUID(),
      scope,
      threadId,
      resourceId,
      createdAt: now,
      updatedAt: now,
      lastObservedAt: undefined,
      originType: "initial",
      generationCount: 0,
      activeObservations: "",
      bufferedObservationChunks: undefined,
      bufferedReflection: undefined,
      totalTokensObserved: 0,
      observationTokenCount: 0,
      pendingMessageTokens: 0,
      isReflecting: false,
      isObserving: false,
      isBufferingObservation: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
      config,
      observedTimezone,
      metadata: {},
    };

    const existing = this.db.observationalMemory.get(key) ?? [];
    this.db.observationalMemory.set(key, [record, ...existing]);

    return record;
  }

  async insertObservationalMemoryRecord(record: ObservationalMemoryRecord): Promise<void> {
    const key = this.getObservationalMemoryKey(record.threadId, record.resourceId);
    const existing = this.db.observationalMemory.get(key) ?? [];
    
    let inserted = false;
    for (let i = 0; i < existing.length; i++) {
      if (record.generationCount >= existing[i]!.generationCount) {
        existing.splice(i, 0, record);
        inserted = true;
        break;
      }
    }
    if (!inserted) existing.push(record);
    this.db.observationalMemory.set(key, existing);
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    const { id, observations, tokenCount, lastObservedAt, observedMessageIds } = input;
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.activeObservations = observations;
    record.observationTokenCount = tokenCount;
    record.totalTokensObserved += tokenCount;
    record.pendingMessageTokens = 0;
    record.lastObservedAt = lastObservedAt;
    record.updatedAt = new Date();

    if (observedMessageIds) {
      record.observedMessageIds = observedMessageIds;
    }
  }

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    const { id, chunk, lastBufferedAtTime } = input;
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    const newChunk: BufferedObservationChunk = {
      id: `ombuf-${crypto.randomUUID()}`,
      cycleId: chunk.cycleId,
      observations: chunk.observations,
      tokenCount: chunk.tokenCount,
      messageIds: chunk.messageIds,
      messageTokens: chunk.messageTokens,
      lastObservedAt: chunk.lastObservedAt,
      createdAt: new Date(),
      suggestedContinuation: chunk.suggestedContinuation,
      currentTask: chunk.currentTask,
    };

    const existingChunks = Array.isArray(record.bufferedObservationChunks) 
      ? record.bufferedObservationChunks 
      : [];
    record.bufferedObservationChunks = [...existingChunks, newChunk];

    if (lastBufferedAtTime) {
      record.lastBufferedAtTime = lastBufferedAtTime;
    }

    record.updatedAt = new Date();
  }

  async swapBufferedToActive(input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    const { id, activationRatio, lastObservedAt, messageTokensThreshold, currentPendingTokens, forceMaxActivation } = input;
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    const chunks = Array.isArray(record.bufferedObservationChunks) 
      ? record.bufferedObservationChunks 
      : [];
    if (chunks.length === 0) {
      return {
        chunksActivated: 0,
        messageTokensActivated: 0,
        observationTokensActivated: 0,
        messagesActivated: 0,
        activatedCycleIds: [],
        activatedMessageIds: [],
      };
    }

    const retentionFloor = messageTokensThreshold * (1 - activationRatio);
    const targetMessageTokens = Math.max(0, currentPendingTokens - retentionFloor);

    let cumulativeMessageTokens = 0;
    let chunksToActivate = 1;

    for (let i = 0; i < chunks.length; i++) {
      cumulativeMessageTokens += chunks[i]!.messageTokens ?? 0;
      if (cumulativeMessageTokens >= targetMessageTokens) {
        chunksToActivate = i + 1;
        break;
      }
    }

    const activatedChunks = chunks.slice(0, chunksToActivate);
    const remainingChunks = chunks.slice(chunksToActivate);

    const activatedContent = activatedChunks.map(c => c.observations).join("\n\n");
    const activatedTokens = activatedChunks.reduce((sum, c) => sum + c.tokenCount, 0);
    const activatedMessageTokens = activatedChunks.reduce((sum, c) => sum + (c.messageTokens ?? 0), 0);
    const activatedMessageCount = activatedChunks.reduce((sum, c) => sum + c.messageIds.length, 0);
    const activatedCycleIds = activatedChunks.map(c => c.cycleId).filter((id): id is string => !!id);
    const activatedMessageIds = activatedChunks.flatMap(c => c.messageIds);

    const latestChunk = activatedChunks[activatedChunks.length - 1];
    const derivedLastObservedAt = lastObservedAt ?? 
      (latestChunk?.lastObservedAt ? new Date(latestChunk.lastObservedAt) : new Date());

    if (record.activeObservations) {
      record.activeObservations = `${record.activeObservations}\n\n${activatedContent}`;
    } else {
      record.activeObservations = activatedContent;
    }

    record.observationTokenCount = (record.observationTokenCount ?? 0) + activatedTokens;
    record.pendingMessageTokens = Math.max(0, (record.pendingMessageTokens ?? 0) - activatedMessageTokens);
    record.bufferedObservationChunks = remainingChunks.length > 0 ? remainingChunks : undefined;
    record.lastObservedAt = derivedLastObservedAt;
    record.updatedAt = new Date();

    return {
      chunksActivated: activatedChunks.length,
      messageTokensActivated: activatedMessageTokens,
      observationTokensActivated: activatedTokens,
      messagesActivated: activatedMessageCount,
      activatedCycleIds,
      activatedMessageIds,
      observations: activatedContent,
      suggestedContinuation: latestChunk?.suggestedContinuation ?? undefined,
      currentTask: latestChunk?.currentTask ?? undefined,
    };
  }

  async createReflectionGeneration(input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
    const { currentRecord, reflection, tokenCount } = input;
    const key = this.getObservationalMemoryKey(currentRecord.threadId, currentRecord.resourceId);
    const now = new Date();

    const newRecord: ObservationalMemoryRecord = {
      id: crypto.randomUUID(),
      scope: currentRecord.scope,
      threadId: currentRecord.threadId,
      resourceId: currentRecord.resourceId,
      createdAt: now,
      updatedAt: now,
      lastObservedAt: currentRecord.lastObservedAt ?? now,
      originType: "reflection",
      generationCount: currentRecord.generationCount + 1,
      activeObservations: reflection,
      config: currentRecord.config,
      totalTokensObserved: currentRecord.totalTokensObserved,
      observationTokenCount: tokenCount,
      pendingMessageTokens: 0,
      isReflecting: false,
      isObserving: false,
      isBufferingObservation: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
      observedTimezone: currentRecord.observedTimezone,
      metadata: {},
    };

    const existing = this.db.observationalMemory.get(key) ?? [];
    this.db.observationalMemory.set(key, [newRecord, ...existing]);

    return newRecord;
  }

  async updateBufferedReflection(input: UpdateBufferedReflectionInput): Promise<void> {
    const { id, reflection, tokenCount, inputTokenCount, reflectedObservationLineCount } = input;
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    const existing = record.bufferedReflection || "";
    record.bufferedReflection = existing ? `${existing}\n\n${reflection}` : reflection;
    record.bufferedReflectionTokens = (record.bufferedReflectionTokens || 0) + tokenCount;
    record.bufferedReflectionInputTokens = (record.bufferedReflectionInputTokens || 0) + inputTokenCount;
    record.reflectedObservationLineCount = reflectedObservationLineCount;
    record.updatedAt = new Date();
  }

  async swapBufferedReflectionToActive(input: SwapBufferedReflectionToActiveInput): Promise<ObservationalMemoryRecord> {
    const { currentRecord, tokenCount } = input;
    const record = this.findObservationalMemoryRecordById(currentRecord.id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${currentRecord.id}`);
    }

    if (!record.bufferedReflection) {
      throw new Error("No buffered reflection to swap");
    }

    const bufferedReflection = record.bufferedReflection;
    const reflectedLineCount = record.reflectedObservationLineCount ?? 0;

    const currentObservations = record.activeObservations ?? "";
    const allLines = currentObservations.split("\n");
    const unreflectedLines = allLines.slice(reflectedLineCount);
    const unreflectedContent = unreflectedLines.join("\n").trim();

    const newObservations = unreflectedContent 
      ? `${bufferedReflection}\n\n${unreflectedContent}` 
      : bufferedReflection;

    const newRecord = await this.createReflectionGeneration({
      currentRecord: record,
      reflection: newObservations,
      tokenCount,
    });

    record.bufferedReflection = undefined;
    record.bufferedReflectionTokens = undefined;
    record.bufferedReflectionInputTokens = undefined;
    record.reflectedObservationLineCount = undefined;

    return newRecord;
  }

  async setReflectingFlag(id: string, isReflecting: boolean): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) throw new Error(`Observational memory record not found: ${id}`);
    record.isReflecting = isReflecting;
    record.updatedAt = new Date();
  }

  async setObservingFlag(id: string, isObserving: boolean): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) throw new Error(`Observational memory record not found: ${id}`);
    record.isObserving = isObserving;
    record.updatedAt = new Date();
  }

  async setBufferingObservationFlag(id: string, isBuffering: boolean, lastBufferedAtTokens?: number): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) throw new Error(`Observational memory record not found: ${id}`);
    record.isBufferingObservation = isBuffering;
    if (lastBufferedAtTokens !== undefined) {
      record.lastBufferedAtTokens = lastBufferedAtTokens;
    }
    record.updatedAt = new Date();
  }

  async setBufferingReflectionFlag(id: string, isBuffering: boolean): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) throw new Error(`Observational memory record not found: ${id}`);
    record.isBufferingReflection = isBuffering;
    record.updatedAt = new Date();
  }

  async clearObservationalMemory(threadId: string | null, resourceId: string): Promise<void> {
    const key = this.getObservationalMemoryKey(threadId, resourceId);
    this.db.observationalMemory.delete(key);
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) throw new Error(`Observational memory record not found: ${id}`);
    record.pendingMessageTokens = tokenCount;
    record.updatedAt = new Date();
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private parseStoredMessage(message: StorageMessageType): CoreMessage {
    let parsedContent: string | MessageContentV2;
    
    try {
      const parsed = JSON.parse(message.content);
      if (typeof parsed === "string") {
        parsedContent = {
          format: 2,
          content: parsed,
          parts: [{ type: "text", text: parsed }],
        };
      } else {
        parsedContent = parsed;
      }
    } catch {
      parsedContent = {
        format: 2,
        content: message.content,
        parts: [{ type: "text", text: message.content }],
      };
    }

    return {
      id: message.id,
      threadId: message.thread_id,
      content: parsedContent,
      role: message.role as CoreMessage["role"],
      createdAt: message.createdAt,
      resourceId: message.resourceId ?? undefined,
    };
  }

  private findObservationalMemoryRecordById(id: string): ObservationalMemoryRecord | null {
    for (const records of this.db.observationalMemory.values()) {
      const record = records.find(r => r.id === id);
      if (record) return record;
    }
    return null;
  }
}

/**
 * Deep equality check
 */
function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;
  
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  
  if (aKeys.length !== bKeys.length) return false;
  
  return aKeys.every(key => deepEquals(aObj[key], bObj[key]));
}
