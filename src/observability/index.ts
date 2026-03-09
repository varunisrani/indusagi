/**
 * Indusagi Observability Module
 *
 * Provides comprehensive observability for AI agents, including:
 * - Distributed tracing for agent runs, model calls, tool executions
 * - Multiple export backends (console, file, Langfuse, Sentry)
 * - Configurable sampling and data redaction
 * - OpenTelemetry-compatible span IDs
 *
 * @example
 * ```typescript
 * import { Observability, ConsoleExporter, FileExporter } from '@indusagi/observability';
 *
 * const obs = new Observability({
 *   configs: {
 *     default: {
 *       serviceName: 'my-agent',
 *       sampling: { type: 'always' },
 *       exporters: [
 *         new ConsoleExporter(),
 *         new FileExporter({ outputPath: './traces' })
 *       ]
 *     }
 *   }
 * });
 *
 * const instance = obs.getDefaultInstance();
 * const span = instance.startSpan({
 *   type: SpanType.AGENT_RUN,
 *   name: 'Agent execution'
 * });
 *
 * // ... agent logic ...
 *
 * span.end({ output: result });
 * ```
 */

// Core exports
export * from './core.js';

// Exporter exports
export * from './exporters.js';

// Processor exports
export * from './processors.js';

// Main class
export {
  Observability,
  createObservability,
  getDefaultObservability,
  setDefaultObservability,
} from './observability.js';
