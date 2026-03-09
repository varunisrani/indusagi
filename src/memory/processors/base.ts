/**
 * Memory Processor Interface
 * Based on Mastra processor patterns
 */

import type { CoreMessage, MemoryConfig } from "../types.js";

/**
 * Processor context passed to processors
 */
export interface ProcessorContext {
  threadId: string;
  resourceId: string;
  memoryConfig?: MemoryConfig;
  signal?: AbortSignal;
}

/**
 * Base processor interface
 */
export interface MemoryProcessor {
  /**
   * Processor identifier
   */
  readonly id: string;

  /**
   * Processor name
   */
  readonly name: string;

  /**
   * Process messages before sending to LLM (input phase)
   */
  processInputStep?(args: {
    messages: CoreMessage[];
    context: ProcessorContext;
  }): Promise<CoreMessage[]>;

  /**
   * Process messages after receiving from LLM (output phase)
   */
  processOutputResult?(args: {
    messages: CoreMessage[];
    context: ProcessorContext;
  }): Promise<CoreMessage[]>;
}
