/**
 * Base Exporter
 *
 * Abstract base class for all observability exporters
 */

import type {
  TracingEvent,
  ObservabilityExporter,
  LogEvent,
  MetricEvent,
  ScoreEvent,
  FeedbackEvent,
} from '../core/types.js';

/**
 * Logger interface
 */
interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Base configuration for exporters
 */
export interface BaseExporterConfig {
  /** Custom logger */
  logger?: Logger;
  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Custom span formatter */
  customSpanFormatter?: (span: any) => any | Promise<any>;
}

/**
 * Abstract base class for exporters
 */
export abstract class BaseExporter implements ObservabilityExporter {
  /** Exporter name - must be implemented by subclasses */
  abstract name: string;

  /** Logger instance */
  protected logger: Logger;

  /** Base configuration */
  protected readonly baseConfig: BaseExporterConfig;

  /** Disabled state */
  private _isDisabled: boolean = false;

  constructor(config: BaseExporterConfig = {}) {
    this.baseConfig = config;
    this.logger = config.logger ?? console;
  }

  /**
   * Check if exporter is disabled
   */
  get isDisabled(): boolean {
    return this._isDisabled;
  }

  /**
   * Set logger
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Mark exporter as disabled
   */
  protected setDisabled(reason: string): void {
    this._isDisabled = true;
    this.logger.warn(`${this.name} disabled: ${reason}`);
  }

  /**
   * Apply custom span formatter if configured
   */
  protected async applySpanFormatter(span: any): Promise<any> {
    if (this.baseConfig.customSpanFormatter) {
      try {
        return await this.baseConfig.customSpanFormatter(span);
      } catch (error) {
        this.logger.error(
          `${this.name}: Error in customSpanFormatter for span ${span.id}:`,
          error
        );
      }
    }
    return span;
  }

  /**
   * Export a tracing event
   */
  async exportTracingEvent(event: TracingEvent): Promise<void> {
    if (this._isDisabled) return;

    const processedSpan = await this.applySpanFormatter(event.exportedSpan);
    await this._exportTracingEvent({
      ...event,
      exportedSpan: processedSpan,
    });
  }

  /**
   * Handle tracing event (alias for exportTracingEvent for compatibility)
   */
  onTracingEvent(event: TracingEvent): void | Promise<void> {
    return this.exportTracingEvent(event);
  }

  /**
   * Export tracing event - must be implemented by subclasses
   */
  protected abstract _exportTracingEvent(event: TracingEvent): Promise<void>;

  /**
   * Handle log event (optional)
   */
  onLogEvent?(event: LogEvent): void | Promise<void> {
    // Override in subclasses that support log events
  }

  /**
   * Handle metric event (optional)
   */
  onMetricEvent?(event: MetricEvent): void | Promise<void> {
    // Override in subclasses that support metric events
  }

  /**
   * Handle score event (optional)
   */
  onScoreEvent?(event: ScoreEvent): void | Promise<void> {
    // Override in subclasses that support score events
  }

  /**
   * Handle feedback event (optional)
   */
  onFeedbackEvent?(event: FeedbackEvent): void | Promise<void> {
    // Override in subclasses that support feedback events
  }

  /**
   * Flush any buffered data
   */
  async flush(): Promise<void> {
    // Override in subclasses with buffering
  }

  /**
   * Shutdown the exporter
   */
  async shutdown(): Promise<void> {
    this.logger.info(`${this.name} shutdown complete`);
  }

  /**
   * Add score to trace (optional)
   */
  addScoreToTrace?(args: {
    traceId: string;
    spanId?: string;
    score: number;
    scorerName: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    // Override in subclasses that support scoring
    return Promise.resolve();
  }
}
