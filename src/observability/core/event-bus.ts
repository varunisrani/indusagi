/**
 * Observability Event Bus
 *
 * Routes events to registered exporters and bridges based on event type.
 * Provides synchronous pub/sub with async handler tracking for flush.
 */

import type {
  ObservabilityExporter,
  ObservabilityBridge,
  TracingEvent,
  LogEvent,
  MetricEvent,
  ScoreEvent,
  FeedbackEvent,
  ObservabilityEvent,
} from './types.js';
import { TracingEventType } from './types.js';

/**
 * Simple console logger for the event bus
 */
interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

const defaultLogger: Logger = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

/**
 * Type guard for tracing events
 */
function isTracingEvent(event: ObservabilityEvent): event is TracingEvent {
  return (
    event.type === TracingEventType.SPAN_STARTED ||
    event.type === TracingEventType.SPAN_UPDATED ||
    event.type === TracingEventType.SPAN_ENDED
  );
}

/**
 * Route an event to the appropriate handler method
 */
function routeToHandler(
  handler: ObservabilityExporter | ObservabilityBridge,
  event: ObservabilityEvent,
  logger: Logger
): void | Promise<void> {
  try {
    switch (event.type) {
      case TracingEventType.SPAN_STARTED:
      case TracingEventType.SPAN_UPDATED:
      case TracingEventType.SPAN_ENDED: {
        // Prefer onTracingEvent, fall back to exportTracingEvent
        const fn = handler.onTracingEvent
          ? handler.onTracingEvent.bind(handler)
          : handler.exportTracingEvent
          ? handler.exportTracingEvent.bind(handler)
          : null;
        if (fn) {
          return catchAsyncResult(fn(event as TracingEvent), handler.name, 'tracing', logger);
        }
        break;
      }

      case 'log':
        if (handler.onLogEvent) {
          return catchAsyncResult(handler.onLogEvent(event as LogEvent), handler.name, 'log', logger);
        }
        break;

      case 'metric':
        if (handler.onMetricEvent) {
          return catchAsyncResult(handler.onMetricEvent(event as MetricEvent), handler.name, 'metric', logger);
        }
        break;

      case 'score':
        if (handler.onScoreEvent) {
          return catchAsyncResult(handler.onScoreEvent(event as ScoreEvent), handler.name, 'score', logger);
        }
        break;

      case 'feedback':
        if (handler.onFeedbackEvent) {
          return catchAsyncResult(handler.onFeedbackEvent(event as FeedbackEvent), handler.name, 'feedback', logger);
        }
        break;
    }
  } catch (err) {
    logger.error(`[Observability] Handler error [handler=${handler.name}]:`, err);
  }
}

/**
 * Catch async rejections and log errors
 */
function catchAsyncResult(
  result: void | Promise<void>,
  handlerName: string,
  signal: string,
  logger: Logger
): void | Promise<void> {
  if (result && typeof (result as Promise<void>).then === 'function') {
    return (result as Promise<void>).catch(err => {
      logger.error(`[Observability] ${signal} handler error [handler=${handlerName}]:`, err);
    });
  }
}

/**
 * Max flush iterations to prevent infinite loops
 */
const MAX_FLUSH_ITERATIONS = 3;

/**
 * Observability Event Bus
 *
 * Unified event bus for all observability signals:
 * - Traces (span lifecycle)
 * - Logs
 * - Metrics
 * - Scores
 * - Feedback
 */
export class ObservabilityBus {
  private exporters: ObservabilityExporter[] = [];
  private bridge?: ObservabilityBridge;
  private subscribers: Set<(event: ObservabilityEvent) => void> = new Set();
  private pendingHandlers: Set<Promise<void>> = new Set();
  private pendingSubscribers: Set<Promise<void>> = new Set();
  protected logger: Logger = defaultLogger;

  constructor() {}

  /**
   * Set a custom logger
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Register an exporter to receive events
   */
  registerExporter(exporter: ObservabilityExporter): void {
    if (this.exporters.includes(exporter)) {
      return;
    }
    this.exporters.push(exporter);
  }

  /**
   * Unregister an exporter
   */
  unregisterExporter(exporter: ObservabilityExporter): boolean {
    const index = this.exporters.indexOf(exporter);
    if (index !== -1) {
      this.exporters.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get registered exporters
   */
  getExporters(): readonly ObservabilityExporter[] {
    return [...this.exporters];
  }

  /**
   * Register a bridge for context extraction
   */
  registerBridge(bridge: ObservabilityBridge): void {
    if (this.bridge) {
      this.logger.warn(`[ObservabilityBus] Replacing existing bridge with new bridge`);
    }
    this.bridge = bridge;
  }

  /**
   * Unregister the bridge
   */
  unregisterBridge(): boolean {
    if (this.bridge) {
      this.bridge = undefined;
      return true;
    }
    return false;
  }

  /**
   * Get the registered bridge
   */
  getBridge(): ObservabilityBridge | undefined {
    return this.bridge;
  }

  /**
   * Subscribe to all events
   */
  subscribe(handler: (event: ObservabilityEvent) => void): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  /**
   * Emit an event to all handlers
   */
  emit(event: ObservabilityEvent): void {
    // Route to exporters
    for (const exporter of this.exporters) {
      this.trackHandlerPromise(routeToHandler(exporter, event, this.logger));
    }

    // Route to bridge
    if (this.bridge) {
      this.trackHandlerPromise(routeToHandler(this.bridge, event, this.logger));
    }

    // Deliver to subscribers
    for (const handler of this.subscribers) {
      try {
        const result = handler(event);
        if (result && typeof (result as Promise<void>).then === 'function') {
          const promise = result as Promise<void>;
          this.pendingSubscribers.add(promise);
          void promise.finally(() => this.pendingSubscribers.delete(promise));
        }
      } catch (err) {
        this.logger.error('[ObservabilityBus] Subscriber error:', err);
      }
    }
  }

  /**
   * Track async handler promises
   */
  private trackHandlerPromise(result: void | Promise<void>): void {
    if (result && typeof (result as Promise<void>).then === 'function') {
      const promise = result as Promise<void>;
      this.pendingHandlers.add(promise);
      void promise.finally(() => this.pendingHandlers.delete(promise));
    }
  }

  /**
   * Flush all pending events
   *
   * Phase 1: Wait for in-flight handler promises
   * Phase 2: Drain exporter/bridge SDK buffers
   */
  async flush(): Promise<void> {
    // Phase 1: Await handler delivery promises
    let iterations = 0;
    while (this.pendingHandlers.size > 0) {
      await Promise.allSettled([...this.pendingHandlers]);
      iterations++;
      if (iterations >= MAX_FLUSH_ITERATIONS) {
        this.logger.error(
          `[ObservabilityBus] flush() exceeded ${MAX_FLUSH_ITERATIONS} drain iterations — ` +
            `${this.pendingHandlers.size} promises still pending.`
        );
        if (this.pendingHandlers.size > 0) {
          await Promise.allSettled([...this.pendingHandlers]);
        }
        break;
      }
    }

    // Await subscriber promises
    iterations = 0;
    while (this.pendingSubscribers.size > 0) {
      await Promise.allSettled([...this.pendingSubscribers]);
      iterations++;
      if (iterations >= MAX_FLUSH_ITERATIONS) {
        this.logger.error(
          `[ObservabilityBus] flush() exceeded ${MAX_FLUSH_ITERATIONS} subscriber drain iterations`
        );
        break;
      }
    }

    // Phase 2: Drain exporter/bridge buffers
    const bufferFlushPromises: Promise<void>[] = [];
    for (const exporter of this.exporters) {
      if (exporter.flush) {
        bufferFlushPromises.push(exporter.flush());
      }
    }
    if (this.bridge?.flush) {
      bufferFlushPromises.push(this.bridge.flush());
    }
    if (bufferFlushPromises.length > 0) {
      await Promise.allSettled(bufferFlushPromises);
    }
  }

  /**
   * Shutdown the bus
   */
  async shutdown(): Promise<void> {
    await this.flush();
    this.subscribers.clear();
    this.exporters = [];
    this.bridge = undefined;
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.subscribers.clear();
    this.exporters = [];
    this.bridge = undefined;
  }
}
