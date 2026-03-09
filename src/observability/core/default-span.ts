/**
 * Default Span Implementation
 * 
 * Standard span implementation with full functionality
 */

import type {
  SpanType,
  ObservabilityInstance,
  EndSpanOptions,
  ErrorSpanOptions,
  UpdateSpanOptions,
  CreateSpanOptions,
} from './types.js';
import { SpanStatus } from './types.js';
import { BaseSpan } from './base-span.js';
import { deepClean } from './serialization.js';

/**
 * Default span implementation
 */
export class DefaultSpan<TType extends SpanType> extends BaseSpan<TType> {
  public readonly id: string;
  public readonly traceId: string;
  public readonly parentSpanId?: string;

  constructor(
    options: CreateSpanOptions<TType>,
    observabilityInstance: ObservabilityInstance
  ) {
    super(options, observabilityInstance);

    // If spanId and traceId are provided, use them (rebuilt span)
    if (options.spanId && options.traceId) {
      this.id = options.spanId;
      this.traceId = options.traceId;
      if (options.parentSpanId) {
        this.parentSpanId = options.parentSpanId;
      }
      return;
    }

    // Try bridge first for non-internal spans
    const bridge = observabilityInstance.getBridge?.();
    if (bridge && !this.isInternal) {
      const bridgeIds = bridge.createSpan?.(options);
      if (bridgeIds) {
        this.id = bridgeIds.spanId;
        this.traceId = bridgeIds.traceId;
        this.parentSpanId = bridgeIds.parentSpanId;
        return;
      }
    }

    // Generate IDs ourselves
    if (options.parent) {
      this.traceId = options.parent.traceId;
      this.parentSpanId = options.parent.id;
      this.id = generateSpanId();
      return;
    }

    this.traceId = getOrCreateTraceId(options);
    this.id = generateSpanId();

    if (options.parentSpanId) {
      if (isValidSpanId(options.parentSpanId)) {
        this.parentSpanId = options.parentSpanId;
      } else {
        console.error(
          `[Indusagi Tracing] Invalid parentSpanId: must be 1-16 hexadecimal characters, got "${options.parentSpanId}". Ignoring.`
        );
      }
    }
  }

  end(options?: EndSpanOptions<TType>): void {
    if (this.isEvent) return;

    this.endTime = new Date();

    if (options?.output !== undefined) {
      this.output = deepClean(options.output, this.deepCleanOptions);
    }
    if (options?.attributes) {
      this.attributes = {
        ...this.attributes,
        ...deepClean(options.attributes, this.deepCleanOptions),
      };
    }
    if (options?.metadata) {
      this.metadata = {
        ...this.metadata,
        ...deepClean(options.metadata, this.deepCleanOptions),
      } as Record<string, unknown>;
    }
  }

  error(options: ErrorSpanOptions<TType>): void {
    if (this.isEvent) return;

    const { error, endSpan = true, attributes, metadata } = options;

    this.errorInfo = {
      message: error.message,
      stack: error.stack,
      type: error.constructor?.name || 'Error',
    };

    // Extract additional error details if available
    if ('id' in error) this.errorInfo.id = String((error as any).id);
    if ('domain' in error) this.errorInfo.domain = String((error as any).domain);
    if ('category' in error) this.errorInfo.category = String((error as any).category);
    if ('details' in error) this.errorInfo.details = (error as any).details;

    this.status = SpanStatus.ERROR;

    if (attributes) {
      this.attributes = {
        ...this.attributes,
        ...deepClean(attributes, this.deepCleanOptions),
      };
    }
    if (metadata) {
      this.metadata = {
        ...this.metadata,
        ...deepClean(metadata, this.deepCleanOptions),
      } as Record<string, unknown>;
    }

    if (endSpan) {
      this.end();
    } else {
      this.update({});
    }
  }

  update(options: UpdateSpanOptions<TType>): void {
    if (this.isEvent) return;

    if (options.input !== undefined) {
      this.input = deepClean(options.input, this.deepCleanOptions);
    }
    if (options.output !== undefined) {
      this.output = deepClean(options.output, this.deepCleanOptions);
    }
    if (options.attributes) {
      this.attributes = {
        ...this.attributes,
        ...deepClean(options.attributes, this.deepCleanOptions),
      };
    }
    if (options.metadata) {
      this.metadata = {
        ...this.metadata,
        ...deepClean(options.metadata, this.deepCleanOptions),
      } as Record<string, unknown>;
    }
  }

  get isValid(): boolean {
    return true;
  }

  async export(): Promise<string> {
    return JSON.stringify({
      spanId: this.id,
      traceId: this.traceId,
      startTime: this.startTime,
      endTime: this.endTime,
      attributes: this.attributes,
      metadata: this.metadata,
    });
  }
}

// ============================================================================
// ID Generation Utilities
// ============================================================================

/**
 * Generate OpenTelemetry-compatible span ID (64-bit, 16 hex chars)
 */
function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate OpenTelemetry-compatible trace ID (128-bit, 32 hex chars)
 */
function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate OpenTelemetry-compatible trace ID (1-32 hex characters)
 */
function isValidTraceId(traceId: string): boolean {
  return /^[0-9a-f]{1,32}$/i.test(traceId);
}

/**
 * Validate OpenTelemetry-compatible span ID (1-16 hex characters)
 */
function isValidSpanId(spanId: string): boolean {
  return /^[0-9a-f]{1,16}$/i.test(spanId);
}

/**
 * Get or create a trace ID from options
 */
function getOrCreateTraceId(options: CreateSpanOptions<SpanType>): string {
  if (options.traceId) {
    if (isValidTraceId(options.traceId)) {
      return options.traceId;
    } else {
      console.error(
        `[Indusagi Tracing] Invalid traceId: must be 1-32 hexadecimal characters, got "${options.traceId}". Generating new trace ID.`
      );
    }
  }
  return generateTraceId();
}
