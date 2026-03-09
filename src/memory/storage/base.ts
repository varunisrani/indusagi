/**
 * Memory Storage Abstract Base Class
 * Based on Mastra MemoryStorage
 */

import type {
  CoreMessage,
  StorageThreadType,
  StorageResourceType,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  OrderByInput,
  ObservationalMemoryRecord,
  BufferedObservationChunk,
} from "../types.js";

// Constants for metadata key validation
const SAFE_METADATA_KEY_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const MAX_METADATA_KEY_LENGTH = 128;
const DISALLOWED_METADATA_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Create observational memory input
 */
export interface CreateObservationalMemoryInput {
  threadId: string | null;
  resourceId: string;
  scope: "thread" | "resource";
  config?: import("../types.js").ObservationalMemoryOptions;
  observedTimezone?: string;
}

/**
 * Update active observations input
 */
export interface UpdateActiveObservationsInput {
  id: string;
  observations: string;
  tokenCount: number;
  lastObservedAt: Date;
  observedMessageIds?: string[];
}

/**
 * Update buffered observations input
 */
export interface UpdateBufferedObservationsInput {
  id: string;
  chunk: Omit<BufferedObservationChunk, "id" | "createdAt">;
  lastBufferedAtTime?: Date;
}

/**
 * Swap buffered to active input
 */
export interface SwapBufferedToActiveInput {
  id: string;
  activationRatio: number;
  messageTokensThreshold: number;
  currentPendingTokens: number;
  lastObservedAt?: Date;
  forceMaxActivation?: boolean;
}

/**
 * Swap buffered to active result
 */
export interface SwapBufferedToActiveResult {
  chunksActivated: number;
  messageTokensActivated: number;
  observationTokensActivated: number;
  messagesActivated: number;
  activatedCycleIds: string[];
  activatedMessageIds: string[];
  observations?: string;
  perChunk?: Array<{
    cycleId: string;
    messageTokens: number;
    observationTokens: number;
    messageCount: number;
    observations: string;
  }>;
  suggestedContinuation?: string;
  currentTask?: string;
}

/**
 * Update buffered reflection input
 */
export interface UpdateBufferedReflectionInput {
  id: string;
  reflection: string;
  tokenCount: number;
  inputTokenCount: number;
  reflectedObservationLineCount: number;
}

/**
 * Swap buffered reflection to active input
 */
export interface SwapBufferedReflectionToActiveInput {
  currentRecord: ObservationalMemoryRecord;
  tokenCount: number;
}

/**
 * Create reflection generation input
 */
export interface CreateReflectionGenerationInput {
  currentRecord: ObservationalMemoryRecord;
  reflection: string;
  tokenCount: number;
}

/**
 * Abstract base class for memory storage implementations
 */
export abstract class MemoryStorage {
  /**
   * Whether this storage adapter supports Observational Memory
   */
  readonly supportsObservationalMemory?: boolean = false;

  /**
   * Storage name/identifier
   */
  abstract readonly name: string;

  // ========================================================================
  // Initialization
  // ========================================================================

  /**
   * Initialize storage (create tables, indexes, etc.)
   */
  abstract init(): Promise<void>;

  /**
   * Clear all data (for testing)
   */
  abstract dangerouslyClearAll(): Promise<void>;

  // ========================================================================
  // Thread Operations
  // ========================================================================

  /**
   * Get a thread by ID
   */
  abstract getThreadById(args: { threadId: string }): Promise<StorageThreadType | null>;

  /**
   * Save a thread
   */
  abstract saveThread(args: { thread: StorageThreadType }): Promise<StorageThreadType>;

  /**
   * Update a thread
   */
  abstract updateThread(args: {
    id: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageThreadType>;

  /**
   * Delete a thread
   */
  abstract deleteThread(args: { threadId: string }): Promise<void>;

  /**
   * List threads with optional filtering
   */
  abstract listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput>;

  // ========================================================================
  // Message Operations
  // ========================================================================

  /**
   * List messages for a thread
   */
  abstract listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput>;

  /**
   * List messages by ID
   */
  abstract listMessagesById(args: { messageIds: string[] }): Promise<{ messages: CoreMessage[] }>;

  /**
   * Save messages
   */
  abstract saveMessages(args: { messages: CoreMessage[] }): Promise<{ messages: CoreMessage[] }>;

  /**
   * Update messages
   */
  abstract updateMessages(args: {
    messages: (Partial<Omit<CoreMessage, "createdAt">> & { id: string })[];
  }): Promise<CoreMessage[]>;

  /**
   * Delete messages
   */
  abstract deleteMessages(messageIds: string[]): Promise<void>;

  // ========================================================================
  // Resource Operations
  // ========================================================================

  /**
   * Get a resource by ID
   */
  abstract getResourceById(args: { resourceId: string }): Promise<StorageResourceType | null>;

  /**
   * Save a resource
   */
  abstract saveResource(args: { resource: StorageResourceType }): Promise<StorageResourceType>;

  /**
   * Update a resource
   */
  abstract updateResource(args: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType>;

  // ========================================================================
  // Observational Memory Operations (Optional)
  // ========================================================================

  /**
   * Get observational memory record
   */
  async getObservationalMemory(
    _threadId: string | null,
    _resourceId: string,
  ): Promise<ObservationalMemoryRecord | null> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Get observational memory history
   */
  async getObservationalMemoryHistory(
    _threadId: string | null,
    _resourceId: string,
    _limit?: number,
  ): Promise<ObservationalMemoryRecord[]> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Initialize observational memory
   */
  async initializeObservationalMemory(_input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Update active observations
   */
  async updateActiveObservations(_input: UpdateActiveObservationsInput): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Update buffered observations
   */
  async updateBufferedObservations(_input: UpdateBufferedObservationsInput): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Swap buffered observations to active
   */
  async swapBufferedToActive(_input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Create reflection generation
   */
  async createReflectionGeneration(_input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Update buffered reflection
   */
  async updateBufferedReflection(_input: UpdateBufferedReflectionInput): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Swap buffered reflection to active
   */
  async swapBufferedReflectionToActive(_input: SwapBufferedReflectionToActiveInput): Promise<ObservationalMemoryRecord> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Set reflecting flag
   */
  async setReflectingFlag(_id: string, _isReflecting: boolean): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Set observing flag
   */
  async setObservingFlag(_id: string, _isObserving: boolean): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Set buffering observation flag
   */
  async setBufferingObservationFlag(_id: string, _isBuffering: boolean, _lastBufferedAtTokens?: number): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Set buffering reflection flag
   */
  async setBufferingReflectionFlag(_id: string, _isBuffering: boolean): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Insert observational memory record
   */
  async insertObservationalMemoryRecord(_record: ObservationalMemoryRecord): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Clear observational memory
   */
  async clearObservationalMemory(_threadId: string | null, _resourceId: string): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  /**
   * Set pending message tokens
   */
  async setPendingMessageTokens(_id: string, _tokenCount: number): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.name}).`);
  }

  // ========================================================================
  // Protected Helpers
  // ========================================================================

  /**
   * Parse order by configuration
   */
  protected parseOrderBy(
    orderBy?: OrderByInput,
    defaultDirection: "ASC" | "DESC" = "DESC",
  ): { field: "createdAt" | "updatedAt"; direction: "ASC" | "DESC" } {
    return {
      field: orderBy?.field ?? "createdAt",
      direction: orderBy?.direction ?? defaultDirection,
    };
  }

  /**
   * Validate metadata keys to prevent injection attacks
   */
  protected validateMetadataKeys(metadata: Record<string, unknown> | undefined): void {
    if (!metadata) return;

    for (const key of Object.keys(metadata)) {
      if (DISALLOWED_METADATA_KEYS.has(key)) {
        throw new Error(`Invalid metadata key: "${key}".`);
      }

      if (!SAFE_METADATA_KEY_PATTERN.test(key)) {
        throw new Error(
          `Invalid metadata key: "${key}". Keys must start with a letter or underscore and contain only alphanumeric characters and underscores.`,
        );
      }

      if (key.length > MAX_METADATA_KEY_LENGTH) {
        throw new Error(`Metadata key "${key}" exceeds maximum length of ${MAX_METADATA_KEY_LENGTH} characters.`);
      }
    }
  }

  /**
   * Validate pagination parameters
   */
  protected validatePagination(page: number, perPage: number): void {
    if (!Number.isFinite(page) || !Number.isSafeInteger(page) || page < 0) {
      throw new Error("page must be >= 0");
    }

    if (!Number.isFinite(perPage) || !Number.isSafeInteger(perPage) || perPage < 0) {
      throw new Error("perPage must be >= 0");
    }

    if (perPage === 0) {
      return;
    }

    const offset = page * perPage;
    if (!Number.isSafeInteger(offset) || offset > Number.MAX_SAFE_INTEGER) {
      throw new Error("page value too large");
    }
  }

  /**
   * Validate pagination input
   */
  protected validatePaginationInput(page: number, perPageInput: number | false): void {
    if (perPageInput !== false) {
      if (typeof perPageInput !== "number" || !Number.isFinite(perPageInput) || !Number.isSafeInteger(perPageInput)) {
        throw new Error("perPage must be false or a safe integer");
      }
      if (perPageInput < 0) {
        throw new Error("perPage must be >= 0");
      }
    }

    if (perPageInput === false) {
      if (page !== 0) {
        throw new Error("page must be 0 when perPage is false");
      }
      if (!Number.isFinite(page) || !Number.isSafeInteger(page)) {
        throw new Error("page must be >= 0");
      }
      return;
    }

    this.validatePagination(page, perPageInput);
  }
}

/**
 * Normalize perPage value
 */
export function normalizePerPage(perPageInput: number | false | undefined, defaultPerPage: number): number {
  if (perPageInput === false) return Number.MAX_SAFE_INTEGER;
  if (perPageInput === 0) return 0;
  if (perPageInput === undefined) return defaultPerPage;
  return perPageInput;
}

/**
 * Calculate pagination offset
 */
export function calculatePagination(
  page: number,
  perPageInput: number | false | undefined,
  perPage: number,
): { offset: number; perPage: number | false } {
  return {
    offset: page * perPage,
    perPage: perPageInput === false ? false : perPageInput ?? perPage,
  };
}
