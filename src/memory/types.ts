/**
 * Memory System Type Definitions
 * Based on Mastra memory types
 */

import type { JSONSchema7 } from "json-schema";
import type { ZodObject } from "zod";

// ============================================================================
// Message Types
// ============================================================================

/**
 * Message content types for V2 format
 */
export interface MessageContentV2 {
  format: 2;
  content: string;
  parts: MessagePart[];
  metadata?: Record<string, unknown>;
}

export type MessagePart = 
  | { type: "text"; text: string }
  | { type: "image"; image: string; mimeType?: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: "tool-result"; toolCallId: string; toolName: string; result: unknown };

/**
 * Core message type used throughout the memory system
 */
export interface CoreMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string | MessageContentV2;
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
}

/**
 * Storage message format (for persistence)
 */
export interface StorageMessageType {
  id: string;
  thread_id: string;
  content: string;
  role: string;
  type: "text" | "tool-call" | "tool-result";
  createdAt: Date;
  updatedAt?: Date;
  resourceId: string | null;
}

// ============================================================================
// Thread Types
// ============================================================================

/**
 * Thread (conversation) record
 */
export interface StorageThreadType {
  id: string;
  title?: string;
  resourceId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Resource Types
// ============================================================================

/**
 * Resource (user/session) record
 */
export interface StorageResourceType {
  id: string;
  workingMemory?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Memory Configuration Types
// ============================================================================

/**
 * Vector index configuration for optimizing semantic recall performance
 */
export interface VectorIndexConfig {
  type?: "ivfflat" | "hnsw" | "flat";
  metric?: "cosine" | "euclidean" | "dotproduct";
  ivf?: {
    lists?: number;
  };
  hnsw?: {
    m?: number;
    efConstruction?: number;
  };
}

/**
 * Semantic recall configuration
 */
export interface SemanticRecallConfig {
  /** Number of similar messages to retrieve */
  topK: number;
  /** Messages to include before/after each match */
  messageRange: number | { before: number; after: number };
  /** Scope: thread (per conversation) or resource (cross-conversation) */
  scope?: "thread" | "resource";
  /** Vector index configuration */
  indexConfig?: VectorIndexConfig;
  /** Minimum similarity threshold (0-1) */
  threshold?: number;
  /** Index name for the vector store */
  indexName?: string;
}

/**
 * Base working memory configuration
 */
export interface BaseWorkingMemory {
  enabled: boolean;
  /** Scope for working memory storage */
  scope?: "thread" | "resource";
}

/**
 * Template-based working memory
 */
export interface TemplateWorkingMemory extends BaseWorkingMemory {
  template: string;
  schema?: never;
}

/**
 * Schema-based working memory
 */
export interface SchemaWorkingMemory extends BaseWorkingMemory {
  schema: ZodObject<any> | JSONSchema7;
  template?: never;
}

/**
 * Working memory configuration union type
 */
export type WorkingMemoryConfig = 
  | TemplateWorkingMemory 
  | SchemaWorkingMemory 
  | (BaseWorkingMemory & { template?: never; schema?: never });

/**
 * Model settings for Observer/Reflector agents
 */
export interface ObservationalMemoryModelSettings {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  [key: string]: unknown;
}

/**
 * Observation step configuration
 */
export interface ObservationConfig {
  model?: string;
  messageTokens?: number;
  modelSettings?: ObservationalMemoryModelSettings;
  providerOptions?: Record<string, Record<string, unknown>>;
  maxTokensPerBatch?: number;
  bufferTokens?: number | false;
  bufferActivation?: number;
  blockAfter?: number;
  instruction?: string;
}

/**
 * Reflection step configuration
 */
export interface ReflectionConfig {
  model?: string;
  observationTokens?: number;
  modelSettings?: ObservationalMemoryModelSettings;
  providerOptions?: Record<string, Record<string, unknown>>;
  blockAfter?: number;
  bufferActivation?: number;
  instruction?: string;
}

/**
 * Observational memory configuration
 */
export interface ObservationalMemoryOptions {
  enabled?: boolean;
  model?: string;
  observation?: ObservationConfig;
  reflection?: ReflectionConfig;
  scope?: "resource" | "thread";
  shareTokenBudget?: boolean;
}

/**
 * Main memory configuration
 */
export interface MemoryConfig {
  /** Read-only mode (no learning) */
  readOnly?: boolean;
  /** Number of recent messages to include (or false to disable) */
  lastMessages?: number | false;
  /** Semantic recall configuration */
  semanticRecall?: boolean | SemanticRecallConfig;
  /** Working memory configuration */
  workingMemory?: WorkingMemoryConfig;
  /** Observational memory configuration */
  observationalMemory?: boolean | ObservationalMemoryOptions;
  /** Auto-generate thread titles */
  generateTitle?: boolean | {
    model: string;
    instructions?: string;
  };
}

/**
 * Shared memory configuration (for Memory class constructor)
 */
export interface SharedMemoryConfig {
  storage?: import("./storage/base.js").MemoryStorage;
  vector?: import("./vector/base.js").VectorStore;
  embedder?: import("./embedder/base.js").Embedder;
  embedderOptions?: EmbedderOptions;
  options?: MemoryConfig;
}

// ============================================================================
// Embedding Types
// ============================================================================

/**
 * Embedding result
 */
export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
  usage?: {
    inputTokens: number;
  };
}

/**
 * Embedder options
 */
export interface EmbedderOptions {
  dimensions?: number;
  providerOptions?: Record<string, unknown>;
}

// ============================================================================
// Vector Store Types
// ============================================================================

/**
 * Vector query result
 */
export interface VectorQueryResult {
  id: string;
  score: number;
  vector?: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Index statistics
 */
export interface IndexStats {
  dimension: number;
  metric?: string;
  count: number;
}

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Pagination input for list operations
 */
export interface PaginationInput {
  page?: number;
  perPage?: number | false;
}

/**
 * Pagination output for list operations
 */
export interface PaginationOutput {
  page: number;
  perPage: number | false;
  total: number;
  hasMore: boolean;
}

/**
 * Order by configuration
 */
export interface OrderByInput {
  field: "createdAt" | "updatedAt";
  direction: "ASC" | "DESC";
}

// ============================================================================
// Storage List Types
// ============================================================================

/**
 * Storage list messages input
 */
export interface StorageListMessagesInput extends PaginationInput {
  threadId: string | string[];
  resourceId?: string;
  include?: Array<{
    id: string;
    threadId?: string;
    withPreviousMessages?: number;
    withNextMessages?: number;
  }>;
  filter?: {
    dateRange?: {
      start?: Date;
      end?: Date;
    };
  };
  orderBy?: OrderByInput;
}

/**
 * Storage list messages output
 */
export interface StorageListMessagesOutput extends PaginationOutput {
  messages: CoreMessage[];
}

/**
 * Storage list threads input
 */
export interface StorageListThreadsInput extends PaginationInput {
  filter?: {
    resourceId?: string;
    metadata?: Record<string, unknown>;
  };
  orderBy?: OrderByInput;
}

/**
 * Storage list threads output
 */
export interface StorageListThreadsOutput extends PaginationOutput {
  threads: StorageThreadType[];
}

// ============================================================================
// Observational Memory Types
// ============================================================================

/**
 * Buffered observation chunk
 */
export interface BufferedObservationChunk {
  id: string;
  cycleId?: string;
  observations: string;
  tokenCount: number;
  messageIds: string[];
  messageTokens?: number;
  lastObservedAt?: Date;
  createdAt: Date;
  suggestedContinuation?: string;
  currentTask?: string;
}

/**
 * Observational memory record
 */
export interface ObservationalMemoryRecord {
  id: string;
  scope: "thread" | "resource";
  threadId: string | null;
  resourceId: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastObservedAt?: Date;
  lastReflectedAt?: Date;
  
  // Origin tracking
  originType: "initial" | "reflection";
  generationCount: number;
  
  // Active observations
  activeObservations: string;
  observationTokenCount: number;
  totalTokensObserved: number;
  
  // Buffering
  bufferedObservationChunks?: BufferedObservationChunk[];
  bufferedReflection?: string;
  bufferedReflectionTokens?: number;
  bufferedReflectionInputTokens?: number;
  
  // Message tracking
  observedMessageIds?: string[];
  pendingMessageTokens: number;
  
  // State flags
  isReflecting: boolean;
  isObserving: boolean;
  isBufferingObservation: boolean;
  isBufferingReflection: boolean;
  lastBufferedAtTokens: number;
  lastBufferedAtTime: Date | null;
  
  // Configuration
  config?: ObservationalMemoryOptions;
  observedTimezone?: string;
  reflectedObservationLineCount?: number;
  
  // Metadata
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Working Memory Template
// ============================================================================

/**
 * Working memory template format
 */
export interface WorkingMemoryTemplate {
  format: "json" | "markdown";
  content: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default memory options
 */
export const memoryDefaultOptions: MemoryConfig = {
  lastMessages: 10,
  semanticRecall: false,
  generateTitle: false,
  workingMemory: {
    enabled: false,
    template: `
# User Information
- **First Name**: 
- **Last Name**: 
- **Location**: 
- **Occupation**: 
- **Interests**: 
- **Goals**: 
- **Events**: 
- **Facts**: 
- **Projects**: 
`,
  },
};

/**
 * Default semantic recall configuration
 */
export const DEFAULT_SEMANTIC_RECALL: SemanticRecallConfig = {
  topK: 4,
  messageRange: { before: 1, after: 1 },
  scope: "resource",
  threshold: 0.7,
};

/**
 * Default observational memory configuration
 */
export const DEFAULT_OBSERVATIONAL_MEMORY: ObservationalMemoryOptions = {
  enabled: true,
  scope: "thread",
  observation: {
    messageTokens: 30_000,
    modelSettings: { temperature: 0.3, maxOutputTokens: 100_000 },
    bufferTokens: 0.2,
    bufferActivation: 0.8,
  },
  reflection: {
    observationTokens: 40_000,
    modelSettings: { temperature: 0, maxOutputTokens: 100_000 },
    bufferActivation: 0.5,
  },
};
