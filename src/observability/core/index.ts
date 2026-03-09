/**
 * Observability Core
 *
 * Core observability types and implementations
 */

// Export types
export * from './types.js';

// Export implementations
export { BaseSpan } from './base-span.js';
export { DefaultSpan } from './default-span.js';
export { NoOpSpan } from './noop-span.js';
export { BaseObservabilityInstance } from './instance.js';
export { DefaultObservabilityInstance } from './default-instance.js';
export { ObservabilityBus } from './event-bus.js';

// Export config
export {
  ObservabilityConfigManager,
  loadConfigFromEnv,
  getExporterOptions,
} from './config.js';

// Export serialization
export {
  deepClean,
  mergeSerializationOptions,
  redactSensitiveData,
  DEFAULT_SENSITIVE_PATTERNS,
} from './serialization.js';

// Export types from config
export type {
  ObservabilityInstanceConfig,
  ObservabilityRegistryConfig,
  SpanOutputProcessor,
  ConfigSelector,
  ConfigSelectorOptions,
} from './config.js';
