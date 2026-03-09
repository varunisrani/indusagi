/**
 * Console Exporter
 *
 * Prints traces to the console for development
 */

import { BaseExporter } from './base-exporter.js';
import type { TracingEvent } from '../core/types.js';
import { TracingEventType, SpanStatus } from '../core/types.js';

/**
 * Console exporter options
 */
export interface ConsoleExporterOptions {
  /** Show colors in output */
  colors?: boolean;
  /** Max depth for nested objects */
  maxDepth?: number;
  /** Logger to use (defaults to console) */
  logger?: {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
}

/**
 * Console exporter
 */
export class ConsoleExporter extends BaseExporter {
  name = "console";

  private colors: Record<string, string>;
  private maxDepth: number;
  private logFn: (...args: unknown[]) => void;
  private errorFn: (...args: unknown[]) => void;

  constructor(options: ConsoleExporterOptions = {}) {
    super();

    const useColors =
      options.colors ??
      (typeof process !== "undefined" &&
        process.stdout?.isTTY === true);

    this.colors = useColors
      ? {
          reset: "\x1b[0m",
          bright: "\x1b[1m",
          dim: "\x1b[2m",
          cyan: "\x1b[36m",
          green: "\x1b[32m",
          yellow: "\x1b[33m",
          red: "\x1b[31m",
          blue: "\x1b[34m",
          magenta: "\x1b[35m",
        }
      : {
          reset: "",
          bright: "",
          dim: "",
          cyan: "",
          green: "",
          yellow: "",
          red: "",
          blue: "",
          magenta: "",
        };

    this.maxDepth = options.maxDepth ?? 3;
    this.logFn = options.logger?.log ?? console.log.bind(console);
    this.errorFn = options.logger?.error ?? console.error.bind(console);
  }

  /**
   * Export tracing event to console
   */
  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    const span = event.exportedSpan;

    // Determine colors based on event type and status
    let statusColor = this.colors.cyan;
    let icon = "○";

    if (event.type === TracingEventType.SPAN_ENDED) {
      if (span.errorInfo) {
        statusColor = this.colors.red;
        icon = "✗";
      } else {
        statusColor = this.colors.green;
        icon = "✓";
      }
    } else if (event.type === TracingEventType.SPAN_STARTED) {
      statusColor = this.colors.yellow;
      icon = "→";
    }

    // Build duration string
    const duration =
      span.endTime && span.startTime
        ? `${
            new Date(span.endTime).getTime() -
            new Date(span.startTime).getTime()
          }ms`
        : event.type === TracingEventType.SPAN_STARTED
        ? "starting..."
        : "unknown";

    // Indent based on whether it's a root span
    const indent = span.isRootSpan ? "" : "  ";

    // Main line
    const mainLine = `${indent}${icon} ${statusColor}[${span.type}]${this.colors.reset} ${span.name}`;

    this.logFn(mainLine);

    // Duration and timing
    if (event.type === TracingEventType.SPAN_ENDED || duration !== "starting...") {
      this.logFn(
        `${indent}  ${this.colors.dim}duration: ${duration}${this.colors.reset}`
      );
    }

    // Error info
    if (span.errorInfo) {
      this.errorFn(
        `${indent}  ${this.colors.red}Error: ${span.errorInfo.message}${this.colors.reset}`
      );
      if (span.errorInfo.stack) {
        this.errorFn(
          `${indent}  ${this.colors.dim}${span.errorInfo.stack
            .split("\n")
            .slice(0, 3)
            .join(`\n${indent}  `)}${this.colors.reset}`
        );
      }
    }

    // Attributes
    if (Object.keys(span.attributes).length > 0) {
      const attrs = this.formatValue(span.attributes, 1);
      this.logFn(
        `${indent}  ${this.colors.dim}attributes:${this.colors.reset}`,
        attrs
      );
    }

    // Metadata
    if (span.metadata && Object.keys(span.metadata).length > 0) {
      const meta = this.formatValue(span.metadata, 1);
      this.logFn(
        `${indent}  ${this.colors.dim}metadata:${this.colors.reset}`,
        meta
      );
    }

    // Input (truncated)
    if (span.input !== undefined) {
      const input = this.formatValue(span.input, 1);
      this.logFn(
        `${indent}  ${this.colors.dim}input:${this.colors.reset}`,
        input
      );
    }

    // Output (truncated)
    if (span.output !== undefined) {
      const output = this.formatValue(span.output, 1);
      this.logFn(
        `${indent}  ${this.colors.dim}output:${this.colors.reset}`,
        output
      );
    }

    // Empty line after completed spans
    if (event.type === TracingEventType.SPAN_ENDED) {
      this.logFn("");
    }
  }

  /**
   * Format a value for console output
   */
  private formatValue(value: unknown, depth: number): unknown {
    if (depth > this.maxDepth) {
      return "[...]";
    }

    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === "string") {
      if (value.length > 100) {
        return value.slice(0, 100) + "...";
      }
      return value;
    }

    if (typeof value !== "object") {
      return value;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      if (value.length > 5) {
        return [
          ...value.slice(0, 5).map((v) => this.formatValue(v, depth + 1)),
          `... (${value.length - 5} more)`,
        ];
      }
      return value.map((v) => this.formatValue(v, depth + 1));
    }

    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";

    const formatted: Record<string, unknown> = {};
    const maxKeys = 10;

    for (let i = 0; i < Math.min(keys.length, maxKeys); i++) {
      const key = keys[i];
      formatted[key] = this.formatValue(obj[key], depth + 1);
    }

    if (keys.length > maxKeys) {
      formatted["..."] = `${keys.length - maxKeys} more keys`;
    }

    return formatted;
  }
}
