/**
 * Observational Memory Processor
 * Based on Mastra ObservationalMemory
 */

import type { MemoryProcessor, ProcessorContext } from "../base.js";
import type { CoreMessage, ObservationalMemoryOptions, ObservationConfig, ReflectionConfig } from "../../types.js";
import type { MemoryStorage } from "../../storage/base.js";
import { TokenCounter, createTokenCounter } from "./token-counter.js";
import {
  buildObserverSystemPrompt,
  buildObserverPrompt,
  parseObserverOutput,
  OBSERVER_SYSTEM_PROMPT,
  OBSERVER_EXTRACTION_INSTRUCTIONS,
  OBSERVER_OUTPUT_FORMAT_BASE,
  OBSERVER_GUIDELINES,
  formatMessagesForObserver,
  sanitizeObservationLines,
  detectDegenerateRepetition,
  optimizeObservationsForContext,
  type ObserverResult,
} from "./observer-agent.js";
import {
  buildReflectorSystemPrompt,
  buildReflectorPrompt,
  parseReflectorOutput,
  REFLECTOR_SYSTEM_PROMPT,
  COMPRESSION_GUIDANCE,
  validateCompression,
  type ReflectorResult,
} from "./reflector-agent.js";

/**
 * Default observational memory configuration
 */
export const OBSERVATIONAL_MEMORY_DEFAULTS = {
  observation: {
    model: "google/gemini-2.5-flash",
    messageTokens: 30_000,
    modelSettings: { temperature: 0.3, maxOutputTokens: 100_000 },
    maxTokensPerBatch: 10_000,
    bufferTokens: 0.2,
    bufferActivation: 0.8,
  },
  reflection: {
    model: "google/gemini-2.5-flash",
    observationTokens: 40_000,
    modelSettings: { temperature: 0, maxOutputTokens: 100_000 },
    bufferActivation: 0.5,
  },
} as const;

/**
 * Continuation hint for observation batches
 */
export const OBSERVATION_CONTINUATION_HINT = `This message is not from the user...`;

/**
 * Observational memory processor configuration
 */
export interface ObservationalMemoryProcessorConfig {
  storage: MemoryStorage;
  config: ObservationalMemoryOptions;
  model?: string;
  callLLM?: (params: {
    systemPrompt: string;
    userPrompt: string;
    model?: string;
    modelSettings?: Record<string, unknown>;
  }) => Promise<string>;
}

/**
 * Observational Memory Processor
 * 
 * Implements a three-tier memory system:
 * 1. Observer: Extracts observations from messages
 * 2. Reflector: Consolidates observations when they grow too large
 * 3. Actor: Uses observations as context for responses
 */
export class ObservationalMemory implements MemoryProcessor {
  readonly id = "observational-memory";
  readonly name = "Observational Memory Processor";

  private storage: MemoryStorage;
  private config: ObservationalMemoryOptions;
  private model?: string;
  private callLLM?: ObservationalMemoryProcessorConfig["callLLM"];
  private tokenCounter: TokenCounter;

  constructor(config: ObservationalMemoryProcessorConfig) {
    this.storage = config.storage;
    this.config = config.config;
    this.model = config.model;
    this.callLLM = config.callLLM;
    this.tokenCounter = new TokenCounter();
  }

  // ========================================================================
  // Input Processing
  // ========================================================================

  async processInputStep(args: {
    messages: CoreMessage[];
    context: ProcessorContext;
  }): Promise<CoreMessage[]> {
    const { messages, context } = args;

    // Get or initialize observational memory record
    const record = await this.getOrCreateRecord(context);

    // Build context with observations
    const contextMessages: CoreMessage[] = [];

    // Add observations if available
    if (record.activeObservations) {
      const observationsMessage: CoreMessage = {
        id: `observations-${Date.now()}`,
        role: "system",
        content: `<observational_memory>\n${record.activeObservations}\n</observational_memory>`,
        createdAt: new Date(),
      };
      contextMessages.push(observationsMessage);
    }

    // Get recent messages from storage
    const { messages: storedMessages } = await this.storage.listMessages({
      threadId: context.threadId,
      perPage: 50,
      orderBy: { field: "createdAt", direction: "DESC" },
    });

    // Reverse to get chronological order
    const chronologicalMessages = storedMessages.reverse();

    // Combine: observations + stored messages + new messages
    return [...contextMessages, ...chronologicalMessages, ...messages];
  }

  // ========================================================================
  // Output Processing
  // ========================================================================

  async processOutputResult(args: {
    messages: CoreMessage[];
    context: ProcessorContext;
  }): Promise<CoreMessage[]> {
    const { messages, context } = args;

    // Check if read-only
    if (context.memoryConfig?.readOnly) {
      return messages;
    }

    // Save new messages
    await this.storage.saveMessages({ messages });

    // Check if observation is needed
    const record = await this.getOrCreateRecord(context);
    const newTokens = this.tokenCounter.countMessages(messages);
    const totalPendingTokens = record.pendingMessageTokens + newTokens;

    const observationConfig = this.getObservationConfig();
    const threshold = observationConfig.messageTokens ?? 30_000;

    if (totalPendingTokens >= threshold) {
      // Trigger observation
      await this.runObservation(context, record, totalPendingTokens);
    }

    return messages;
  }

  // ========================================================================
  // Observation
  // ========================================================================

  private async runObservation(
    context: ProcessorContext,
    record: import("../../types.js").ObservationalMemoryRecord,
    pendingTokens: number,
  ): Promise<void> {
    const observationConfig = this.getObservationConfig();

    // Get unobserved messages
    const { messages } = await this.storage.listMessages({
      threadId: context.threadId,
      perPage: 100,
    });

    // Build prompt
    const systemPrompt = buildObserverSystemPrompt(false, observationConfig.instruction);
    const userPrompt = buildObserverPrompt(record.activeObservations || undefined, messages);

    // Call LLM
    if (!this.callLLM) {
      console.warn("ObservationalMemory: No LLM call function provided, skipping observation");
      return;
    }

    try {
      const output = await this.callLLM({
        systemPrompt,
        userPrompt,
        model: observationConfig.model ?? this.model,
        modelSettings: observationConfig.modelSettings as Record<string, unknown>,
      });

      const result = parseObserverOutput(output);

      if (result.degenerate) {
        console.warn("ObservationalMemory: Degenerate output detected, skipping");
        return;
      }

      // Update record with new observations
      const newObservations = record.activeObservations
        ? `${record.activeObservations}\n\n${result.observations}`
        : result.observations;

      const newTokenCount = this.tokenCounter.countObservations(newObservations);

      await this.storage.updateActiveObservations({
        id: record.id,
        observations: newObservations,
        tokenCount: newTokenCount,
        lastObservedAt: new Date(),
      });

      // Check if reflection is needed
      const reflectionConfig = this.getReflectionConfig();
      const reflectionThreshold = reflectionConfig.observationTokens ?? 40_000;

      if (newTokenCount >= reflectionThreshold) {
        await this.runReflection(context, newObservations);
      }
    } catch (error) {
      console.error("ObservationalMemory: Observation failed:", error);
    }
  }

  // ========================================================================
  // Reflection
  // ========================================================================

  private async runReflection(
    context: ProcessorContext,
    observations: string,
  ): Promise<void> {
    const reflectionConfig = this.getReflectionConfig();

    if (!this.callLLM) {
      return;
    }

    const systemPrompt = buildReflectorSystemPrompt(reflectionConfig.instruction);
    const userPrompt = buildReflectorPrompt(observations);

    try {
      let output = await this.callLLM({
        systemPrompt,
        userPrompt,
        model: reflectionConfig.model ?? this.model,
        modelSettings: reflectionConfig.modelSettings as Record<string, unknown>,
      });

      let result = parseReflectorOutput(output);

      // Try compression if needed
      const targetThreshold = reflectionConfig.observationTokens ?? 40_000;
      let compressionLevel: 0 | 1 | 2 | 3 = 0;

      while (
        !result.degenerate &&
        compressionLevel < 3 &&
        !validateCompression(this.tokenCounter.countObservations(result.observations), targetThreshold)
      ) {
        compressionLevel = Math.min(3, compressionLevel + 1) as 0 | 1 | 2 | 3;
        const retryPrompt = buildReflectorPrompt(observations, undefined, compressionLevel);
        output = await this.callLLM({
          systemPrompt,
          userPrompt: retryPrompt,
          model: reflectionConfig.model ?? this.model,
          modelSettings: reflectionConfig.modelSettings as Record<string, unknown>,
        });
        result = parseReflectorOutput(output);
      }

      if (result.degenerate) {
        console.warn("ObservationalMemory: Degenerate reflection output, keeping original observations");
        return;
      }

      // Create new generation with reflected observations
      const record = await this.getOrCreateRecord(context);
      await this.storage.createReflectionGeneration({
        currentRecord: record,
        reflection: result.observations,
        tokenCount: this.tokenCounter.countObservations(result.observations),
      });
    } catch (error) {
      console.error("ObservationalMemory: Reflection failed:", error);
    }
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private async getOrCreateRecord(
    context: ProcessorContext,
  ): Promise<import("../../types.js").ObservationalMemoryRecord> {
    const scope = this.config.scope ?? "thread";
    const threadId = scope === "thread" ? context.threadId : null;

    let record = await this.storage.getObservationalMemory(threadId, context.resourceId);

    if (!record) {
      record = await this.storage.initializeObservationalMemory({
        threadId,
        resourceId: context.resourceId,
        scope,
        config: this.config,
      });
    }

    return record;
  }

  private getObservationConfig(): ObservationConfig {
    return {
      ...OBSERVATIONAL_MEMORY_DEFAULTS.observation,
      ...this.config.observation,
    };
  }

  private getReflectionConfig(): ReflectionConfig {
    return {
      ...OBSERVATIONAL_MEMORY_DEFAULTS.reflection,
      ...this.config.reflection,
    };
  }
}
