/**
 * Core Types for Indusagi Observability
 * 
 * Based on Mastra Observability patterns and OpenTelemetry standards.
 * These types define the structure for spans, events, and configuration.
 */

// ============================================================================
// Span Types Enumeration
// ============================================================================

/**
 * Span types for different operations in the agent system
 */
export enum SpanType {
  // Agent lifecycle
  AGENT_RUN = 'agent_run',
  AGENT_STEP = 'agent_step',
  AGENT_DECISION = 'agent_decision',
  
  // AI/Model operations
  MODEL_GENERATION = 'model_generation',
  MODEL_STEP = 'model_step',
  MODEL_CHUNK = 'model_chunk',
  
  // Tool operations
  TOOL_CALL = 'tool_call',
  MCP_TOOL_CALL = 'mcp_tool_call',
  
  // Memory operations
  MEMORY_OPERATION = 'memory_operation',
  MEMORY_RETRIEVE = 'memory_retrieve',
  MEMORY_STORE = 'memory_store',
  
  // Workflow operations
  WORKFLOW_RUN = 'workflow_run',
  WORKFLOW_STEP = 'workflow_step',
  WORKFLOW_CONDITIONAL = 'workflow_conditional',
  WORKFLOW_PARALLEL = 'workflow_parallel',
  WORKFLOW_LOOP = 'workflow_loop',
  
  // Custom operations
  GENERIC = 'generic',
}

/**
 * Span status enumeration
 */
export enum SpanStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  ERROR = 'error',
  ABORTED = 'aborted',
}

// ============================================================================
// Tracing Event Types
// ============================================================================

/**
 * Types of tracing events emitted during span lifecycle
 */
export enum TracingEventType {
  SPAN_STARTED = 'SPAN_STARTED',
  SPAN_ENDED = 'SPAN_ENDED',
  SPAN_UPDATED = 'SPAN_UPDATED',
  SPAN_ERROR = 'SPAN_ERROR',
}

// ============================================================================
// Core Span Interfaces
// ============================================================================

/**
 * Error information attached to spans
 */
export interface SpanErrorInfo {
  message: string;
  stack?: string;
  type?: string;
  id?: string;
  domain?: string;
  category?: string;
  details?: Record<string, unknown>;
}

/**
 * Trace state for controlling span behavior
 */
export interface TraceState {
  requestContextKeys?: string[];
  hideInput?: boolean;
  hideOutput?: boolean;
}

/**
 * Entity type that created the span
 */
export type EntityType = 'agent' | 'workflow' | 'tool' | 'model' | 'memory' | 'custom';

/**
 * Exported span structure - lightweight version for exporters
 */
export interface ExportedSpan<TType extends SpanType = SpanType> {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  type: TType;
  entityType?: EntityType;
  entityId?: string;
  entityName?: string;
  attributes: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  startTime: Date;
  endTime?: Date;
  input?: unknown;
  output?: unknown;
  errorInfo?: SpanErrorInfo;
  isEvent: boolean;
  isRootSpan: boolean;
  tags?: string[];
}

/**
 * Any exported span type
 */
export type AnyExportedSpan = ExportedSpan<SpanType>;

// ============================================================================
// Span Interface
// ============================================================================

/**
 * Main Span interface - represents a unit of work in the system
 */
export interface Span<TType extends SpanType = SpanType> {
  // Identification
  readonly id: string;
  readonly traceId: string;
  readonly parentSpanId?: string;
  
  // Content
  name: string;
  type: TType;
  description?: string;
  
  // Timing
  startTime: Date;
  endTime?: Date;
  readonly duration?: number;
  
  // Data
  input?: unknown;
  output?: unknown;
  attributes: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tags?: string[];
  
  // Error handling
  errorInfo?: SpanErrorInfo;
  status: SpanStatus;
  
  // Flags
  isEvent: boolean;
  isInternal: boolean;
  readonly isRootSpan: boolean;
  readonly isValid: boolean;
  
  // Trace state
  traceState?: TraceState;
  
  // Entity context
  entityType?: EntityType;
  entityId?: string;
  entityName?: string;
  
  // Parent reference
  parent?: Span<SpanType>;
  
  // Lifecycle methods
  end(options?: EndSpanOptions<TType>): void;
  error(options: ErrorSpanOptions<TType>): void;
  update(options: UpdateSpanOptions<TType>): void;
  
  // Child span creation
  createChildSpan<TChildType extends SpanType>(
    options: ChildSpanOptions<TChildType>
  ): Span<TChildType>;
  
  // Event span creation
  createEventSpan<TChildType extends SpanType>(
    options: ChildEventOptions<TChildType>
  ): Span<TChildType>;
  
  // Export
  exportSpan(includeInternalSpans?: boolean): ExportedSpan<TType>;
  
  // Context execution
  executeInContext<T>(fn: () => Promise<T>): Promise<T>;
  executeInContextSync<T>(fn: () => T): T;
}

/**
 * Any span type
 */
export type AnySpan = Span<SpanType>;

// ============================================================================
// Span Options Interfaces
// ============================================================================

/**
 * Options for creating a span
 */
export interface CreateSpanOptions<TType extends SpanType = SpanType> {
  name: string;
  type: TType;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  parent?: AnySpan;
  startTime?: Date;
  input?: unknown;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isEvent?: boolean;
  traceState?: TraceState;
  tags?: string[];
  entityType?: EntityType;
  entityId?: string;
  entityName?: string;
  tracingPolicy?: {
    internal?: InternalSpanFlags;
  };
}

/**
 * Options for starting a span (includes additional context)
 */
export interface StartSpanOptions<TType extends SpanType = SpanType>
  extends CreateSpanOptions<TType> {
  requestContext?: RequestContext;
  customSamplerOptions?: CustomSamplerOptions;
  tracingOptions?: TracingOptions;
}

/**
 * Options for ending a span
 */
export interface EndSpanOptions<TType extends SpanType = SpanType> {
  output?: unknown;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Options for recording an error on a span
 */
export interface ErrorSpanOptions<TType extends SpanType = SpanType> {
  error: Error;
  endSpan?: boolean;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Options for updating a span
 */
export interface UpdateSpanOptions<TType extends SpanType = SpanType> {
  input?: unknown;
  output?: unknown;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Options for creating a child span
 */
export interface ChildSpanOptions<TType extends SpanType = SpanType>
  extends Omit<CreateSpanOptions<TType>, 'parent' | 'traceId' | 'parentSpanId'> {}

/**
 * Options for creating an event span
 */
export interface ChildEventOptions<TType extends SpanType = SpanType>
  extends ChildSpanOptions<TType> {
  output?: unknown;
}

// ============================================================================
// Tracing Options
// ============================================================================

/**
 * Tracing options for customizing trace behavior
 */
export interface TracingOptions {
  traceId?: string;
  parentSpanId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  hideInput?: boolean;
  hideOutput?: boolean;
  requestContextKeys?: string[];
}

/**
 * Internal span flags
 */
export type InternalSpanFlags = number;

export const InternalSpans = {
  NONE: 0,
  WORKFLOW: 1 << 0,
  AGENT: 1 << 1,
  TOOL: 1 << 2,
  MODEL: 1 << 3,
  ALL: (1 << 4) - 1,
} as const;

// ============================================================================
// Sampling Types
// ============================================================================

/**
 * Sampling strategy types
 */
export enum SamplingStrategyType {
  ALWAYS = 'always',
  NEVER = 'never',
  RATIO = 'ratio',
  CUSTOM = 'custom',
}

/**
 * Options for custom sampler
 */
export interface CustomSamplerOptions {
  requestContext?: RequestContext;
  metadata?: Record<string, unknown>;
}

/**
 * Sampling strategy configuration
 */
export type SamplingStrategy =
  | { type: SamplingStrategyType.ALWAYS }
  | { type: SamplingStrategyType.NEVER }
  | { type: SamplingStrategyType.RATIO; probability: number }
  | { type: SamplingStrategyType.CUSTOM; sampler: (options?: CustomSamplerOptions) => boolean };

// ============================================================================
// Request Context
// ============================================================================

/**
 * Request context interface for extracting metadata
 */
export interface RequestContext {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
}

// ============================================================================
// Tracing Event
// ============================================================================

/**
 * Tracing event structure
 */
export interface TracingEvent {
  type: TracingEventType;
  exportedSpan: AnyExportedSpan;
}

// ============================================================================
// Observability Event
// ============================================================================

/**
 * Observability event types
 */
export type ObservabilityEvent = 
  | TracingEvent
  | LogEvent
  | MetricEvent
  | ScoreEvent
  | FeedbackEvent;

export interface LogEvent {
  type: 'LOG';
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  traceId?: string;
  spanId?: string;
  metadata?: Record<string, unknown>;
}

export interface MetricEvent {
  type: 'METRIC';
  name: string;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
  metricType: 'counter' | 'gauge' | 'histogram';
}

export interface ScoreEvent {
  type: 'SCORE';
  traceId: string;
  spanId?: string;
  score: number;
  scorerName: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface FeedbackEvent {
  type: 'FEEDBACK';
  traceId: string;
  spanId?: string;
  score: number;
  comment?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Serialization Options
// ============================================================================

/**
 * Options for controlling serialization of span data
 */
export interface SerializationOptions {
  maxStringLength?: number;
  maxDepth?: number;
  maxArrayLength?: number;
  maxObjectKeys?: number;
}

// ============================================================================
// Context Interfaces
// ============================================================================

/**
 * Logger context for correlated logging
 */
export interface LoggerContext {
  traceId?: string;
  spanId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Metrics context for emitting metrics
 */
export interface MetricsContext {
  labels?: Record<string, string>;
}
