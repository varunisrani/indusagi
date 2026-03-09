/**
 * Memory Module - Public Exports
 * Based on Mastra memory patterns
 */

// Main Memory class
export { Memory } from "./memory.js";

// Types
export type {
  // Message types
  CoreMessage,
  MessageContentV2,
  MessagePart,
  StorageMessageType,
  
  // Thread types
  StorageThreadType,
  
  // Resource types
  StorageResourceType,
  
  // Configuration types
  MemoryConfig,
  SharedMemoryConfig,
  SemanticRecallConfig,
  WorkingMemoryConfig,
  ObservationalMemoryOptions,
  ObservationConfig,
  ReflectionConfig,
  ObservationalMemoryModelSettings,
  VectorIndexConfig,
  
  // Embedding types
  EmbeddingResult,
  EmbedderOptions,
  
  // Vector store types
  VectorQueryResult,
  IndexStats,
  
  // Pagination types
  PaginationInput,
  PaginationOutput,
  OrderByInput,
  
  // Storage list types
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  
  // Observational memory types
  ObservationalMemoryRecord,
  BufferedObservationChunk,
  
  // Working memory template
  WorkingMemoryTemplate,
} from "./types.js";

// Export defaults
export {
  memoryDefaultOptions,
  DEFAULT_SEMANTIC_RECALL,
  DEFAULT_OBSERVATIONAL_MEMORY,
} from "./types.js";

// Storage
export { MemoryStorage } from "./storage/base.js";
export type {
  CreateObservationalMemoryInput,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  UpdateBufferedReflectionInput,
  SwapBufferedReflectionToActiveInput,
  CreateReflectionGenerationInput,
} from "./storage/base.js";
export { InMemoryStorage, createInMemoryDB } from "./storage/inmemory.js";
export type { InMemoryDB } from "./storage/inmemory.js";

// Vector Store
export { VectorStore } from "./vector/base.js";
export type {
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  UpdateVectorParams,
  DeleteVectorParams,
  DeleteVectorsParams,
} from "./vector/base.js";
export { InMemoryVectorStore } from "./vector/inmemory.js";

// Embedder
export { Embedder } from "./embedder/base.js";
export type { EmbedderConfig } from "./embedder/base.js";
export { OpenAIEmbedder, createOpenAIEmbedder } from "./embedder/openai.js";
export type { OpenAIEmbedderConfig } from "./embedder/openai.js";

// Processors
export type { MemoryProcessor, ProcessorContext } from "./processors/base.js";
export { WorkingMemory } from "./processors/working-memory.js";
export type { WorkingMemoryProcessorConfig } from "./processors/working-memory.js";
export { SemanticRecall } from "./processors/semantic-recall.js";
export type { SemanticRecallProcessorConfig } from "./processors/semantic-recall.js";
export { MessageHistory } from "./processors/message-history.js";
export type { MessageHistoryProcessorConfig } from "./processors/message-history.js";

// Observational Memory Processor
export {
  ObservationalMemory,
  OBSERVATIONAL_MEMORY_DEFAULTS,
  OBSERVATION_CONTINUATION_HINT,
} from "./processors/observational-memory/index.js";
export type { ObservationalMemoryProcessorConfig } from "./processors/observational-memory/index.js";

// Token Counter
export { TokenCounter, createTokenCounter } from "./processors/observational-memory/token-counter.js";

// Observer Agent
export {
  buildObserverSystemPrompt,
  buildObserverPrompt,
  parseObserverOutput,
  formatMessagesForObserver,
  sanitizeObservationLines,
  detectDegenerateRepetition,
  optimizeObservationsForContext,
  OBSERVER_SYSTEM_PROMPT,
  OBSERVER_EXTRACTION_INSTRUCTIONS,
  OBSERVER_OUTPUT_FORMAT_BASE,
  OBSERVER_GUIDELINES,
  type ObserverResult,
} from "./processors/observational-memory/observer-agent.js";

// Reflector Agent
export {
  buildReflectorSystemPrompt,
  buildReflectorPrompt,
  parseReflectorOutput,
  validateCompression,
  REFLECTOR_SYSTEM_PROMPT,
  COMPRESSION_GUIDANCE,
  type ReflectorResult,
} from "./processors/observational-memory/reflector-agent.js";

// Tools
export {
  createUpdateWorkingMemoryTool,
  createUpdateWorkingMemoryToolVNext,
  deepMergeWorkingMemory,
  extractWorkingMemoryTags,
  removeWorkingMemoryTags,
} from "./tools/working-memory.js";
export type {
  UpdateWorkingMemoryInput,
  UpdateWorkingMemoryResult,
} from "./tools/working-memory.js";
