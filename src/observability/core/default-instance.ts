/**
 * Default Observability Instance
 *
 * Standard implementation using DefaultSpan
 */

import type { SpanType, Span, CreateSpanOptions } from './types.js';
import type { ObservabilityInstanceConfig } from './config.js';
import { BaseObservabilityInstance } from './instance.js';
import { DefaultSpan } from './default-span.js';

/**
 * Default observability instance
 */
export class DefaultObservabilityInstance extends BaseObservabilityInstance {
  constructor(config: ObservabilityInstanceConfig) {
    super(config);
  }

  /**
   * Create a span using DefaultSpan
   */
  protected createSpan<TType extends SpanType>(
    options: CreateSpanOptions<TType>
  ): Span<TType> {
    return new DefaultSpan<TType>(options, this);
  }
}
