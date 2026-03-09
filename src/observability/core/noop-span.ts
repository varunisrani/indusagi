/**
 * No-Op Span Implementation
 * 
 * A no-operation span used when tracing is disabled or not sampled
 */

import type {
  SpanType,
  AnySpan,
  Span,
  CreateSpanOptions,
  EndSpanOptions,
  ErrorSpanOptions,
  UpdateSpanOptions,
  ChildSpanOptions,
  ChildEventOptions,
  ExportedSpan,
  ObservabilityInstance,
} from './types.js';
import { SpanStatus } from './types.js';

/**
 * No-operation span - does nothing
 * Used when tracing is disabled or span is not sampled
 */
export class NoOpSpan<TType extends SpanType> implements Span<TType> {
  public readonly id: string;
  public readonly traceId: string;
  public readonly parentSpanId?: string;

  public name: string;
  public type: TType;
  public description?: string;
  public attributes: Record<string, unknown> = {};
  public metadata?: Record<string, unknown>;
  public tags?: string[];
  public parent?: AnySpan;
  public startTime: Date;
  public endTime?: Date;
  public input?: unknown;
  public output?: unknown;
  public errorInfo?: {
    message: string;
    stack?: string;
    type?: string;
  };
  public status: SpanStatus = SpanStatus.PENDING;
  public isEvent: boolean = false;
  public isInternal: boolean = false;
  public traceState?: {
    requestContextKeys?: string[];
    hideInput?: boolean;
    hideOutput?: boolean;
  };
  public entityType?: string;
  public entityId?: string;
  public entityName?: string;

  constructor(
    options: CreateSpanOptions<TType>,
    _observabilityInstance: ObservabilityInstance
  ) {
    this.id = 'noop';
    this.traceId = 'noop';
    this.name = options.name;
    this.type = options.type;
    this.description = options.description;
    this.startTime = options.startTime ?? new Date();
    this.parent = options.parent;
    this.isEvent = options.isEvent ?? false;
  }

  get duration(): undefined {
    return undefined;
  }

  get isRootSpan(): boolean {
    return !this.parent;
  }

  get isValid(): boolean {
    return false;
  }

  end(_options?: EndSpanOptions<TType>): void {
    // No-op
  }

  error(_options: ErrorSpanOptions<TType>): void {
    // No-op
  }

  update(_options: UpdateSpanOptions<TType>): void {
    // No-op
  }

  createChildSpan<TChildType extends SpanType>(
    options: ChildSpanOptions<TChildType>
  ): Span<TChildType> {
    // Return a no-op child span
    return new NoOpSpan<TChildType>(
      { ...options, parent: this as AnySpan, type: options.type },
      {} as ObservabilityInstance
    );
  }

  createEventSpan<TChildType extends SpanType>(
    options: ChildEventOptions<TChildType>
  ): Span<TChildType> {
    return new NoOpSpan<TChildType>(
      { ...options, parent: this as AnySpan, type: options.type, isEvent: true },
      {} as ObservabilityInstance
    );
  }

  exportSpan(_includeInternalSpans?: boolean): ExportedSpan<TType> {
    return {
      id: this.id,
      traceId: this.traceId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      type: this.type,
      entityType: this.entityType as any,
      entityId: this.entityId,
      entityName: this.entityName,
      attributes: this.attributes,
      metadata: this.metadata,
      startTime: this.startTime,
      endTime: this.endTime,
      input: this.input,
      output: this.output,
      errorInfo: this.errorInfo,
      isEvent: this.isEvent,
      isRootSpan: this.isRootSpan,
      tags: this.tags,
    };
  }

  async executeInContext<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  executeInContextSync<T>(fn: () => T): T {
    return fn();
  }
}
