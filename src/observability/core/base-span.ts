/**
 * Base Span Implementation
 * 
 * Abstract base class for all span implementations
 */

import type {
  Span,
  SpanType,
  AnySpan,
  CreateSpanOptions,
  EndSpanOptions,
  ErrorSpanOptions,
  UpdateSpanOptions,
  ChildSpanOptions,
  ChildEventOptions,
  ExportedSpan,
  ObservabilityInstance,
  InternalSpanFlags,
} from './types.js';
import { SpanStatus, InternalSpans } from './types.js';
import { deepClean, mergeSerializationOptions } from './serialization.js';
import type { DeepCleanOptions } from './serialization.js';

/**
 * Extended span type with getParentSpan method
 */
type AnyBaseSpan = AnySpan & {
  getParentSpan(includeInternalSpans?: boolean): AnySpan | undefined;
};

/**
 * Determine if a span type should be considered internal
 */
function isSpanInternal(spanType: SpanType, flags?: InternalSpanFlags): boolean {
  if (flags === undefined || flags === InternalSpans.NONE) {
    return false;
  }

  switch (spanType) {
    case SpanType.WORKFLOW_RUN:
    case SpanType.WORKFLOW_STEP:
    case SpanType.WORKFLOW_CONDITIONAL:
    case SpanType.WORKFLOW_PARALLEL:
    case SpanType.WORKFLOW_LOOP:
      return (flags & InternalSpans.WORKFLOW) !== 0;

    case SpanType.AGENT_RUN:
    case SpanType.AGENT_STEP:
    case SpanType.AGENT_DECISION:
      return (flags & InternalSpans.AGENT) !== 0;

    case SpanType.TOOL_CALL:
    case SpanType.MCP_TOOL_CALL:
      return (flags & InternalSpans.TOOL) !== 0;

    case SpanType.MODEL_GENERATION:
    case SpanType.MODEL_STEP:
    case SpanType.MODEL_CHUNK:
      return (flags & InternalSpans.MODEL) !== 0;

    default:
      return false;
  }
}

/**
 * Abstract base class for spans
 */
export abstract class BaseSpan<TType extends SpanType = SpanType> implements Span<TType> {
  public abstract readonly id: string;
  public abstract readonly traceId: string;
  public abstract readonly parentSpanId?: string;

  public name: string;
  public type: TType;
  public description?: string;
  public attributes: Record<string, unknown>;
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
    id?: string;
    domain?: string;
    category?: string;
    details?: Record<string, unknown>;
  };
  public status: SpanStatus = SpanStatus.PENDING;
  public isEvent: boolean;
  public isInternal: boolean;
  public traceState?: {
    requestContextKeys?: string[];
    hideInput?: boolean;
    hideOutput?: boolean;
  };
  public entityType?: string;
  public entityId?: string;
  public entityName?: string;

  protected observabilityInstance: ObservabilityInstance;
  protected deepCleanOptions: Required<DeepCleanOptions>;

  constructor(
    options: CreateSpanOptions<TType>,
    observabilityInstance: ObservabilityInstance
  ) {
    const serializationOptions = observabilityInstance.getConfig().serializationOptions;
    this.deepCleanOptions = mergeSerializationOptions(serializationOptions);

    this.name = options.name;
    this.type = options.type;
    this.description = options.description;
    this.attributes = deepClean(options.attributes || {}, this.deepCleanOptions) as Record<string, unknown>;
    this.metadata = deepClean(options.metadata, this.deepCleanOptions) as Record<string, unknown> | undefined;
    this.parent = options.parent;
    this.startTime = options.startTime ?? new Date();
    this.observabilityInstance = observabilityInstance;
    this.isEvent = options.isEvent ?? false;
    this.isInternal = isSpanInternal(this.type, options.tracingPolicy?.internal);
    this.traceState = options.traceState;

    // Tags only for root spans
    this.tags = !options.parent && options.tags?.length ? options.tags : undefined;

    // Entity context - inherit from closest non-internal parent
    const entityParent = this.getParentSpan(false);
    this.entityType = options.entityType ?? entityParent?.entityType;
    this.entityId = options.entityId ?? entityParent?.entityId;
    this.entityName = options.entityName ?? entityParent?.entityName;

    if (this.isEvent) {
      this.output = deepClean(options.input, this.deepCleanOptions);
    } else {
      this.input = deepClean(options.input, this.deepCleanOptions);
    }
  }

  // Abstract methods
  abstract end(options?: EndSpanOptions<TType>): void;
  abstract error(options: ErrorSpanOptions<TType>): void;
  abstract update(options: UpdateSpanOptions<TType>): void;
  abstract get isValid(): boolean;

  get duration(): number | undefined {
    if (!this.endTime) return undefined;
    return this.endTime.getTime() - this.startTime.getTime();
  }

  get isRootSpan(): boolean {
    return !this.parent;
  }

  createChildSpan<TChildType extends SpanType>(
    options: ChildSpanOptions<TChildType>
  ): Span<TChildType> {
    return this.observabilityInstance.startSpan<TChildType>({
      ...options,
      parent: this as AnySpan,
      isEvent: false,
    });
  }

  createEventSpan<TChildType extends SpanType>(
    options: ChildEventOptions<TChildType>
  ): Span<TChildType> {
    return this.observabilityInstance.startSpan<TChildType>({
      ...options,
      parent: this as AnySpan,
      isEvent: true,
      input: undefined,
      output: options.output,
    });
  }

  getParentSpan(includeInternalSpans?: boolean): AnySpan | undefined {
    if (!this.parent) return undefined;
    if (includeInternalSpans) return this.parent;
    if (this.parent.isInternal) {
      return (this.parent as AnyBaseSpan).getParentSpan(includeInternalSpans);
    }
    return this.parent;
  }

  getParentSpanId(includeInternalSpans?: boolean): string | undefined {
    if (!this.parent) {
      return this.parentSpanId;
    }
    const parentSpan = this.getParentSpan(includeInternalSpans);
    if (parentSpan) {
      return parentSpan.id;
    }
    return (this.parent as AnyBaseSpan).getParentSpanId?.(includeInternalSpans);
  }

  exportSpan(includeInternalSpans?: boolean): ExportedSpan<TType> {
    const hideInput = this.traceState?.hideInput ?? false;
    const hideOutput = this.traceState?.hideOutput ?? false;

    return {
      id: this.id,
      traceId: this.traceId,
      parentSpanId: this.getParentSpanId(includeInternalSpans),
      name: this.name,
      type: this.type,
      entityType: this.entityType as any,
      entityId: this.entityId,
      entityName: this.entityName,
      attributes: this.attributes,
      metadata: this.metadata,
      startTime: this.startTime,
      endTime: this.endTime,
      input: hideInput ? undefined : this.input,
      output: hideOutput ? undefined : this.output,
      errorInfo: this.errorInfo,
      isEvent: this.isEvent,
      isRootSpan: this.isRootSpan,
      ...(this.isRootSpan && this.tags?.length ? { tags: this.tags } : {}),
    };
  }

  async executeInContext<T>(fn: () => Promise<T>): Promise<T> {
    const bridge = this.observabilityInstance.getBridge?.();
    if (bridge?.executeInContext) {
      return bridge.executeInContext(this.id, fn);
    }
    return fn();
  }

  executeInContextSync<T>(fn: () => T): T {
    const bridge = this.observabilityInstance.getBridge?.();
    if (bridge?.executeInContextSync) {
      return bridge.executeInContextSync(this.id, fn);
    }
    return fn();
  }
}
