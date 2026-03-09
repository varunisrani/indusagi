/**
 * Processors Module Exports
 */

// Base processor interface
export type { MemoryProcessor, ProcessorContext } from "./base.js";

// Working memory processor
export { WorkingMemory } from "./working-memory.js";
export type { WorkingMemoryProcessorConfig } from "./working-memory.js";

// Semantic recall processor
export { SemanticRecall } from "./semantic-recall.js";
export type { SemanticRecallProcessorConfig } from "./semantic-recall.js";

// Message history processor
export { MessageHistory } from "./message-history.js";
export type { MessageHistoryProcessorConfig } from "./message-history.js";

// Observational memory processor
export {
  ObservationalMemory,
  OBSERVATIONAL_MEMORY_DEFAULTS,
  OBSERVATION_CONTINUATION_HINT,
} from "./observational-memory/index.js";
export type { ObservationalMemoryProcessorConfig } from "./observational-memory/index.js";

// Token counter
export { TokenCounter, createTokenCounter } from "./observational-memory/token-counter.js";

// Observer agent
export {
  OBSERVER_SYSTEM_PROMPT,
  OBSERVER_EXTRACTION_INSTRUCTIONS,
  OBSERVER_OUTPUT_FORMAT_BASE,
  OBSERVER_GUIDELINES,
  buildObserverSystemPrompt,
  buildObserverPrompt,
  parseObserverOutput,
  formatMessagesForObserver,
  sanitizeObservationLines,
  detectDegenerateRepetition,
  optimizeObservationsForContext,
  type ObserverResult,
} from "./observational-memory/observer-agent.js";

// Reflector agent
export {
  REFLECTOR_SYSTEM_PROMPT,
  COMPRESSION_GUIDANCE,
  buildReflectorSystemPrompt,
  buildReflectorPrompt,
  parseReflectorOutput,
  validateCompression,
  type ReflectorResult,
} from "./observational-memory/reflector-agent.js";
