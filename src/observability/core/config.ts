/**
 * Configuration system for Indusagi Observability
 *
 * Provides configuration types, loading, and validation
 */

import type {
  SamplingStrategy,
  ObservabilityExporter,
  ObservabilityBridge,
  SerializationOptions,
} from './types.js';
import { SamplingStrategyType } from './types.js';

// ============================================================================
// Configuration Interfaces
// ============================================================================

/**
 * Observability instance configuration
 */
export interface ObservabilityInstanceConfig {
  /** Unique identifier for this config */
  name: string;
  /** Service name for tracing */
  serviceName: string;
  /** Sampling strategy (defaults to ALWAYS) */
  sampling?: SamplingStrategy;
  /** Exporters for sending spans to backends */
  exporters?: ObservabilityExporter[];
  /** Bridge for context extraction (e.g., OpenTelemetry) */
  bridge?: ObservabilityBridge;
  /** Span output processors */
  spanOutputProcessors?: SpanOutputProcessor[];
  /** Include internal framework spans */
  includeInternalSpans?: boolean;
  /** Request context keys to extract as metadata */
  requestContextKeys?: string[];
  /** Serialization options */
  serializationOptions?: SerializationOptions;
}

/**
 * Span output processor interface
 */
export interface SpanOutputProcessor {
  name: string;
  process(span: any): any;
  shutdown(): Promise<void>;
}

/**
 * Observability registry configuration
 */
export interface ObservabilityRegistryConfig {
  /** Enable default observability (deprecated) */
  default?: {
    enabled?: boolean;
  };
  /** Map of instance names to configurations */
  configs?: Record<string, Omit<ObservabilityInstanceConfig, 'name'> | ObservabilityInstance>;
  /** Selector function for choosing config */
  configSelector?: ConfigSelector;
}

/**
 * Config selector options
 */
export interface ConfigSelectorOptions {
  entityType?: string;
  entityId?: string;
  entityName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Config selector function type
 */
export type ConfigSelector = (options: ConfigSelectorOptions) => string | undefined;

// ============================================================================
// Environment Configuration Loader
// ============================================================================

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): ObservabilityInstanceConfig {
  const enabled = process.env.INDUSAGI_OBSERVABILITY_ENABLED === 'true';
  const provider = process.env.INDUSAGI_OBSERVABILITY_PROVIDER || 'console';

  return {
    name: 'default',
    serviceName: process.env.OTEL_SERVICE_NAME || 'indusagi',
    sampling: parseSamplingStrategy(process.env.INDUSAGI_SAMPLING_STRATEGY),
    exporters: [],
    includeInternalSpans: process.env.INDUSAGI_INCLUDE_INTERNAL_SPANS === 'true',
    serializationOptions: {
      maxStringLength: parseInt(process.env.INDUSAGI_MAX_STRING_LENGTH || '10000'),
      maxDepth: parseInt(process.env.INDUSAGI_MAX_DEPTH || '10'),
      maxArrayLength: parseInt(process.env.INDUSAGI_MAX_ARRAY_LENGTH || '100'),
      maxObjectKeys: parseInt(process.env.INDUSAGI_MAX_OBJECT_KEYS || '100'),
    },
  };
}

/**
 * Parse sampling strategy from string
 */
function parseSamplingStrategy(value?: string): SamplingStrategy {
  if (!value) {
    return { type: SamplingStrategyType.ALWAYS };
  }

  if (value === 'always') {
    return { type: SamplingStrategyType.ALWAYS };
  }

  if (value === 'never') {
    return { type: SamplingStrategyType.NEVER };
  }

  const probability = parseFloat(value);
  if (!isNaN(probability) && probability >= 0 && probability <= 1) {
    return { type: SamplingStrategyType.RATIO, probability };
  }

  console.warn(`[Indusagi] Invalid sampling strategy "${value}", defaulting to always`);
  return { type: SamplingStrategyType.ALWAYS };
}

// ============================================================================
// Configuration Manager
// ============================================================================

/**
 * Configuration manager class
 */
export class ObservabilityConfigManager {
  private config: ObservabilityInstanceConfig;

  constructor(config?: Partial<ObservabilityInstanceConfig>) {
    this.config = {
      name: 'default',
      serviceName: 'indusagi',
      sampling: { type: SamplingStrategyType.ALWAYS },
      exporters: [],
      spanOutputProcessors: [],
      includeInternalSpans: false,
      requestContextKeys: [],
      ...config,
    };
  }

  /**
   * Create from environment variables
   */
  static fromEnvironment(): ObservabilityConfigManager {
    return new ObservabilityConfigManager(loadConfigFromEnv());
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<ObservabilityInstanceConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ObservabilityInstanceConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Add an exporter
   */
  addExporter(exporter: ObservabilityExporter): void {
    if (!this.config.exporters) {
      this.config.exporters = [];
    }
    if (!this.config.exporters.includes(exporter)) {
      this.config.exporters.push(exporter);
    }
  }

  /**
   * Remove an exporter
   */
  removeExporter(exporter: ObservabilityExporter): boolean {
    if (!this.config.exporters) return false;
    const index = this.config.exporters.indexOf(exporter);
    if (index !== -1) {
      this.config.exporters.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Add a span processor
   */
  addSpanProcessor(processor: SpanOutputProcessor): void {
    if (!this.config.spanOutputProcessors) {
      this.config.spanOutputProcessors = [];
    }
    this.config.spanOutputProcessors.push(processor);
  }

  /**
   * Set the bridge
   */
  setBridge(bridge: ObservabilityBridge): void {
    this.config.bridge = bridge;
  }

  /**
   * Check if sampling is enabled
   */
  shouldSample(): boolean {
    const { sampling } = this.config;

    switch (sampling?.type) {
      case SamplingStrategyType.ALWAYS:
        return true;
      case SamplingStrategyType.NEVER:
        return false;
      case SamplingStrategyType.RATIO:
        return Math.random() < (sampling.probability ?? 0);
      case SamplingStrategyType.CUSTOM:
        return sampling.sampler?.() ?? true;
      default:
        return true;
    }
  }
}

// ============================================================================
// Default Exporters Configuration
// ============================================================================

/**
 * Get exporter options from environment
 */
export function getExporterOptions(provider: string): Record<string, unknown> {
  switch (provider) {
    case 'langfuse':
      return {
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
      };

    case 'langsmith':
      return {
        apiKey: process.env.LANGCHAIN_API_KEY,
        projectName: process.env.LANGCHAIN_PROJECT || 'indusagi-project',
      };

    case 'sentry':
      return {
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACE_SAMPLE_RATE || '1.0'),
      };

    case 'otel':
      return {
        endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
      };

    case 'file':
      return {
        outputPath: process.env.INDUSAGI_TRACES_OUTPUT_PATH || './traces',
        format: (process.env.INDUSAGI_TRACES_FORMAT || 'ndjson') as 'json' | 'ndjson',
      };

    case 'console':
    default:
      return {};
  }
}
