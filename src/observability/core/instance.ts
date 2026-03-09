/**
 * Base Observability Instance
 *
 * Abstract base class for all observability implementations
 */

import type {
  Span,
  SpanType,
  AnySpan,
  StartSpanOptions,
  CreateSpanOptions,
  ExportedSpan,
  ObservabilityInstance,
  ObservabilityBridge,
  ObservabilityExporter,
  TracingEvent,
  TracingOptions,
  TraceState,
  CustomSamplerOptions,
} from './types.js';
import {
  TracingEventType,
  SamplingStrategyType,
} from './types.js';
import type { ObservabilityInstanceConfig, SpanOutputProcessor } from './config.js';
import { ObservabilityBus } from './event-bus.js';

/**
 * Logger interface
 */
interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

const defaultLogger: Logger = {
  debug: () => {},
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

/**
 * Abstract base class for observability instances
 */
export abstract class BaseObservabilityInstance implements ObservabilityInstance {
  protected config: ObservabilityInstanceConfig;
  protected observabilityBus: ObservabilityBus;
  protected logger: Logger = defaultLogger;

  constructor(config: ObservabilityInstanceConfig) {
    this.config = {
      serviceName: config.serviceName,
      name: config.name,
      sampling: config.sampling ?? { type: SamplingStrategyType.ALWAYS },
      exporters: config.exporters ?? [],
      spanOutputProcessors: config.spanOutputProcessors ?? [],
      bridge: config.bridge ?? undefined,
      includeInternalSpans: config.includeInternalSpans ?? false,
      requestContextKeys: config.requestContextKeys ?? [],
      serializationOptions: config.serializationOptions,
    };

    this.observabilityBus = new ObservabilityBus();

    // Register exporters
    for (const exporter of this.config.exporters) {
      this.observabilityBus.registerExporter(exporter);
    }

    // Register bridge
    if (this.config.bridge) {
      this.observabilityBus.registerBridge(this.config.bridge);
    }

    // Initialize bridge if present
    if (this.config.bridge?.init) {
      this.config.bridge.init({ config: this.config });
    }
  }

  /**
   * Set logger
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
    this.observabilityBus.setLogger(logger);

    // Propagate to exporters
    for (const exporter of this.config.exporters) {
      if ('setLogger' in exporter && typeof exporter.setLogger === 'function') {
        exporter.setLogger(logger);
      }
    }

    // Propagate to bridge
    if (this.config.bridge?.setLogger) {
      this.config.bridge.setLogger(logger);
    }

    this.logger.debug(
      `[Observability] Initialized [service=${this.config.serviceName}] [instance=${this.config.name}] [sampling=${this.config.sampling?.type}] [bridge=${!!this.config.bridge}]`
    );
  }

  /**
   * Start a new span
   */
  startSpan<TType extends SpanType>(options: StartSpanOptions<TType>): Span<TType> {
    const { customSamplerOptions, requestContext, tracingOptions, ...rest } = options;

    // Determine sampling
    if (options.parent) {
      // Child span: inherit sampling from parent
      if (!options.parent.isValid) {
        const { NoOpSpan } = require('./noop-span');
        return new NoOpSpan<TType>({ ...rest, metadata: options.metadata }, this);
      }
    } else {
      // Root span: perform sampling check
      if (!this.shouldSample(customSamplerOptions)) {
        const { NoOpSpan } = require('./noop-span');
        return new NoOpSpan<TType>({ ...rest, metadata: options.metadata }, this);
      }
    }

    // Compute or inherit trace state
    let traceState: TraceState | undefined;
    if (options.parent) {
      traceState = options.parent.traceState;
    } else {
      traceState = this.computeTraceState(tracingOptions);
    }

    // Merge metadata
    const tracingMetadata = !options.parent ? tracingOptions?.metadata : undefined;
    const mergedMetadata = metadata || tracingMetadata
      ? { ...options.metadata, ...tracingMetadata }
      : options.metadata;

    // Extract metadata from RequestContext
    const enrichedMetadata = this.extractMetadataFromRequestContext(
      requestContext,
      mergedMetadata,
      traceState
    );

    // Tags only for root spans
    const tags = !options.parent ? tracingOptions?.tags : undefined;

    // Extract traceId and parentSpanId for root spans
    const traceId = !options.parent
      ? (options.traceId ?? tracingOptions?.traceId)
      : options.traceId;
    const parentSpanId = !options.parent
      ? (options.parentSpanId ?? tracingOptions?.parentSpanId)
      : options.parentSpanId;

    // Create the span
    const span = this.createSpan<TType>({
      ...rest,
      traceId,
      parentSpanId,
      metadata: enrichedMetadata,
      traceState,
      tags,
    });

    // Wire up lifecycle events
    this.wireSpanLifecycle(span);

    // Emit span started event
    if (!span.isEvent) {
      this.emitSpanStarted(span);
    } else {
      // Event spans immediately emit ended
      this.emitSpanEnded(span);
    }

    return span;
  }

  /**
   * Rebuild a span from exported data
   */
  rebuildSpan<TType extends SpanType>(cached: ExportedSpan<TType>): Span<TType> {
    const span = this.createSpan<TType>({
      name: cached.name,
      type: cached.type,
      traceId: cached.traceId,
      spanId: cached.id,
      parentSpanId: cached.parentSpanId,
      startTime: cached.startTime instanceof Date ? cached.startTime : new Date(cached.startTime),
      input: cached.input,
      attributes: cached.attributes,
      metadata: cached.metadata,
      entityType: cached.entityType,
      entityId: cached.entityId,
      entityName: cached.entityName,
    });

    this.wireSpanLifecycle(span);
    return span;
  }

  /**
   * Abstract method to create a span - must be implemented by subclasses
   */
  protected abstract createSpan<TType extends SpanType>(
    options: CreateSpanOptions<TType>
  ): Span<TType>;

  /**
   * Get configuration
   */
  getConfig(): Readonly<ObservabilityInstanceConfig> {
    return { ...this.config };
  }

  /**
   * Get exporters
   */
  getExporters(): readonly ObservabilityExporter[] {
    return [...this.config.exporters];
  }

  /**
   * Get span output processors
   */
  getSpanOutputProcessors(): readonly SpanOutputProcessor[] {
    return [...(this.config.spanOutputProcessors || [])];
  }

  /**
   * Get the bridge
   */
  getBridge(): ObservabilityBridge | undefined {
    return this.config.bridge;
  }

  /**
   * Get the event bus
   */
  getObservabilityBus(): ObservabilityBus {
    return this.observabilityBus;
  }

  /**
   * Wire up span lifecycle events
   */
  private wireSpanLifecycle<TType extends SpanType>(span: Span<TType>): void {
    if (!this.config.includeInternalSpans && span.isInternal) {
      return;
    }

    const originalEnd = span.end.bind(span);
    const originalUpdate = span.update.bind(span);

    span.end = (options?: any) => {
      if (span.isEvent) return;
      originalEnd(options);
      this.emitSpanEnded(span);
    };

    span.update = (options: any) => {
      if (span.isEvent) return;
      originalUpdate(options);
      this.emitSpanUpdated(span);
    };
  }

  /**
   * Check if should sample
   */
  protected shouldSample(options?: CustomSamplerOptions): boolean {
    const { sampling } = this.config;

    switch (sampling?.type) {
      case undefined:
        return true;
      case SamplingStrategyType.ALWAYS:
        return true;
      case SamplingStrategyType.NEVER:
        return false;
      case SamplingStrategyType.RATIO:
        if (
          sampling.probability === undefined ||
          sampling.probability < 0 ||
          sampling.probability > 1
        ) {
          this.logger.warn(
            `Invalid sampling probability: ${sampling.probability}. Expected value between 0 and 1. Defaulting to no sampling.`
          );
          return false;
        }
        return Math.random() < sampling.probability;
      case SamplingStrategyType.CUSTOM:
        return sampling.sampler?.(options) ?? true;
      default:
        throw new Error(`Sampling strategy type not implemented: ${(sampling as any).type}`);
    }
  }

  /**
   * Compute trace state
   */
  protected computeTraceState(tracingOptions?: TracingOptions): TraceState | undefined {
    const configuredKeys = this.config.requestContextKeys ?? [];
    const additionalKeys = tracingOptions?.requestContextKeys ?? [];
    const allKeys = [...configuredKeys, ...additionalKeys];

    const hideInput = tracingOptions?.hideInput;
    const hideOutput = tracingOptions?.hideOutput;

    if (allKeys.length === 0 && hideInput === undefined && hideOutput === undefined) {
      return undefined;
    }

    return {
      requestContextKeys: allKeys.length > 0 ? allKeys : undefined,
      hideInput,
      hideOutput,
    };
  }

  /**
   * Extract metadata from request context
   */
  protected extractMetadataFromRequestContext(
    requestContext: any,
    explicitMetadata: Record<string, any> | undefined,
    traceState: TraceState | undefined
  ): Record<string, any> | undefined {
    if (!requestContext || !traceState?.requestContextKeys?.length) {
      return explicitMetadata;
    }

    const extracted: Record<string, any> = {};
    for (const key of traceState.requestContextKeys) {
      try {
        const value = requestContext.get?.(key);
        if (value !== undefined) {
          extracted[key] = value;
        }
      } catch {
        // Ignore errors
      }
    }

    if (Object.keys(extracted).length === 0 && !explicitMetadata) {
      return undefined;
    }

    return { ...extracted, ...explicitMetadata };
  }

  /**
   * Process span through output processors
   */
  protected processSpan(span?: AnySpan): AnySpan | undefined {
    if (!this.config.spanOutputProcessors || !span) return span;

    for (const processor of this.config.spanOutputProcessors) {
      if (!span) break;
      try {
        span = processor.process(span);
      } catch (error) {
        this.logger.error(`[Observability] Processor error [name=${processor.name}]`, error);
      }
    }
    return span;
  }

  /**
   * Get span for export
   */
  getSpanForExport(span: AnySpan): any {
    if (!span.isValid) return undefined;
    if (span.isInternal && !this.config.includeInternalSpans) return undefined;

    const processedSpan = this.processSpan(span);
    return processedSpan?.exportSpan?.(this.config.includeInternalSpans);
  }

  /**
   * Emit span started event
   */
  protected emitSpanStarted(span: AnySpan): void {
    const exportedSpan = this.getSpanForExport(span);
    if (exportedSpan) {
      const event: TracingEvent = {
        type: TracingEventType.SPAN_STARTED,
        exportedSpan,
      };
      this.observabilityBus.emit(event);
    }
  }

  /**
   * Emit span ended event
   */
  protected emitSpanEnded(span: AnySpan): void {
    const exportedSpan = this.getSpanForExport(span);
    if (exportedSpan) {
      const event: TracingEvent = {
        type: TracingEventType.SPAN_ENDED,
        exportedSpan,
      };
      this.observabilityBus.emit(event);
    }
  }

  /**
   * Emit span updated event
   */
  protected emitSpanUpdated(span: AnySpan): void {
    const exportedSpan = this.getSpanForExport(span);
    if (exportedSpan) {
      const event: TracingEvent = {
        type: TracingEventType.SPAN_UPDATED,
        exportedSpan,
      };
      this.observabilityBus.emit(event);
    }
  }

  /**
   * Flush observability data
   */
  async flush(): Promise<void> {
    this.logger.debug(`[Observability] Flush started [name=${this.config.name}]`);
    await this.observabilityBus.flush();
    this.logger.debug(`[Observability] Flush completed [name=${this.config.name}]`);
  }

  /**
   * Shutdown observability
   */
  async shutdown(): Promise<void> {
    this.logger.debug(`[Observability] Shutdown started [name=${this.config.name}]`);

    await this.observabilityBus.shutdown();

    const shutdownPromises: Promise<void>[] = [
      ...this.config.exporters.map((e) => e.shutdown()),
      ...(this.config.spanOutputProcessors || []).map((p) => p.shutdown()),
    ];

    if (this.config.bridge) {
      shutdownPromises.push(this.config.bridge.shutdown());
    }

    if (shutdownPromises.length > 0) {
      const results = await Promise.allSettled(shutdownPromises);
      for (const result of results) {
        if (result.status === 'rejected') {
          this.logger.error(
            `[Observability] Component shutdown failed [name=${this.config.name}]:`,
            result.reason
          );
        }
      }
    }

    this.logger.info(`[Observability] Shutdown completed [name=${this.config.name}]`);
  }
}
