/**
 * Sensitive Data Filter
 *
 * Redacts sensitive information from spans before export
 */

import type { SpanOutputProcessor } from '../core/config.js';
import { redactSensitiveData, DEFAULT_SENSITIVE_PATTERNS } from '../core/serialization.js';

/**
 * Sensitive data filter options
 */
export interface SensitiveDataFilterOptions {
  /** Custom patterns to match sensitive keys */
  patterns?: RegExp[];
  /** Replacement string */
  replacement?: string;
}

/**
 * Sensitive data filter processor
 */
export class SensitiveDataFilter implements SpanOutputProcessor {
  name = "SensitiveDataFilter";
  private patterns: RegExp[];
  private replacement: string;

  constructor(options: SensitiveDataFilterOptions = {}) {
    this.patterns = options.patterns ?? DEFAULT_SENSITIVE_PATTERNS;
    this.replacement = options.replacement ?? "[REDACTED]";
  }

  /**
   * Process span and redact sensitive data
   */
  process(span: any): any {
    // Redact in attributes
    if (span.attributes) {
      span.attributes = redactSensitiveData(
        span.attributes,
        this.patterns,
        this.replacement
      );
    }

    // Redact in metadata
    if (span.metadata) {
      span.metadata = redactSensitiveData(
        span.metadata,
        this.patterns,
        this.replacement
      );
    }

    // Redact in input
    if (span.input) {
      span.input = redactSensitiveData(
        span.input,
        this.patterns,
        this.replacement
      );
    }

    // Redact in output
    if (span.output) {
      span.output = redactSensitiveData(
        span.output,
        this.patterns,
        this.replacement
      );
    }

    return span;
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    // No cleanup needed
  }
}
