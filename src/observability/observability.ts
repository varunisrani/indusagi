/**
 * Observability Main Class
 *
 * Main entry point for Indusagi observability
 */

import type {
  ObservabilityInstance,
  ConfigSelector,
  ConfigSelectorOptions,
} from './core/types.js';
import type {
  ObservabilityRegistryConfig,
  ObservabilityInstanceConfig,
} from './core/config.js';
import { DefaultObservabilityInstance } from './core/default-instance.js';

/**
 * Logger interface
 */
interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

const defaultLogger: Logger = {
  debug: () => {},
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

/**
 * Type guard to check if object is an instance
 */
function isInstance(
  obj: Omit<ObservabilityInstanceConfig, "name"> | ObservabilityInstance
): obj is ObservabilityInstance {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "startSpan" in obj &&
    typeof (obj as any).startSpan === "function"
  );
}

/**
 * Main Observability class
 */
export class Observability {
  private registry: Map<string, ObservabilityInstance> = new Map();
  private defaultInstance?: string;
  private configSelector?: ConfigSelector;
  private logger: Logger = defaultLogger;

  constructor(config: ObservabilityRegistryConfig = {}) {
    // Handle deprecated default config
    if (config.default?.enabled) {
      this.logger.warn(
        '[Observability] The "default: { enabled: true }" configuration is deprecated. ' +
          "Use explicit configs instead."
      );

      const defaultInstance = new DefaultObservabilityInstance({
        name: "default",
        serviceName: "indusagi",
        sampling: { type: "always" as const },
        exporters: [],
      });

      this.register("default", defaultInstance, true);
    }

    // Process user-provided configs
    if (config.configs) {
      const instances = Object.entries(config.configs);
      instances.forEach(([name, tracingDef], index) => {
        const instance = isInstance(tracingDef)
          ? tracingDef
          : new DefaultObservabilityInstance({ ...tracingDef, name });

        const isDefault = !config.default?.enabled && index === 0;
        this.register(name, instance, isDefault);
      });
    }

    // Set selector function
    if (config.configSelector) {
      this.configSelector = config.configSelector;
    }
  }

  /**
   * Set logger
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
    for (const instance of this.registry.values()) {
      if ("setLogger" in instance && typeof instance.setLogger === "function") {
        instance.setLogger(logger);
      }
    }
  }

  /**
   * Register an instance
   */
  register(
    name: string,
    instance: ObservabilityInstance,
    isDefault = false
  ): void {
    this.registry.set(name, instance);

    if (isDefault) {
      this.defaultInstance = name;
    }

    this.logger.debug(`[Observability] Registered instance: ${name}`);
  }

  /**
   * Get an instance by name
   */
  getInstance(name: string): ObservabilityInstance | undefined {
    return this.registry.get(name);
  }

  /**
   * Get the default instance
   */
  getDefaultInstance(): ObservabilityInstance | undefined {
    if (this.defaultInstance) {
      return this.registry.get(this.defaultInstance);
    }
    // Return first instance if no default set
    const first = this.registry.values().next();
    return first.value;
  }

  /**
   * Get selected instance based on selector
   */
  getSelectedInstance(options: ConfigSelectorOptions): ObservabilityInstance | undefined {
    if (this.configSelector) {
      const name = this.configSelector(options);
      if (name) {
        return this.registry.get(name);
      }
    }
    return this.getDefaultInstance();
  }

  /**
   * List all registered instances
   */
  listInstances(): ReadonlyMap<string, ObservabilityInstance> {
    return new Map(this.registry);
  }

  /**
   * Unregister an instance
   */
  unregister(name: string): boolean {
    const deleted = this.registry.delete(name);
    if (deleted && this.defaultInstance === name) {
      this.defaultInstance = undefined;
    }
    return deleted;
  }

  /**
   * Check if instance exists
   */
  hasInstance(name: string): boolean {
    return this.registry.has(name);
  }

  /**
   * Set config selector
   */
  setConfigSelector(selector: ConfigSelector): void {
    this.configSelector = selector;
  }

  /**
   * Clear all instances
   */
  clear(): void {
    this.registry.clear();
    this.defaultInstance = undefined;
  }

  /**
   * Flush all instances
   */
  async flush(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const instance of this.registry.values()) {
      if (instance.flush) {
        promises.push(instance.flush());
      }
    }
    await Promise.allSettled(promises);
  }

  /**
   * Shutdown all instances
   */
  async shutdown(): Promise<void> {
    this.logger.info("[Observability] Shutting down...");

    const promises: Promise<void>[] = [];
    for (const instance of this.registry.values()) {
      if (instance.shutdown) {
        promises.push(instance.shutdown());
      }
    }

    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === "rejected") {
        this.logger.error("[Observability] Shutdown error:", result.reason);
      }
    }

    this.registry.clear();
    this.logger.info("[Observability] Shutdown complete");
  }
}

/**
 * Create a new observability instance from config
 */
export function createObservability(
  config: ObservabilityRegistryConfig
): Observability {
  return new Observability(config);
}

/**
 * Get or create a default observability instance
 */
let defaultObservability: Observability | undefined;

export function getDefaultObservability(): Observability {
  if (!defaultObservability) {
    defaultObservability = new Observability({
      configs: {
        default: {
          serviceName: "indusagi",
          exporters: [],
        },
      },
    });
  }
  return defaultObservability;
}

/**
 * Set the default observability instance
 */
export function setDefaultObservability(obs: Observability): void {
  defaultObservability = obs;
}
