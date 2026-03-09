/**
 * Working Memory Processor
 * Based on Mastra WorkingMemory processor
 */

import type { MemoryProcessor, ProcessorContext } from "./base.js";
import type { CoreMessage, WorkingMemoryTemplate } from "../types.js";
import type { MemoryStorage } from "../storage/base.js";

/**
 * Working memory processor configuration
 */
export interface WorkingMemoryProcessorConfig {
  storage: MemoryStorage;
  template?: WorkingMemoryTemplate;
  scope?: "thread" | "resource";
  useVNext?: boolean;
  templateProvider?: {
    getWorkingMemoryTemplate(args: { memoryConfig?: import("../types.js").MemoryConfig }): Promise<WorkingMemoryTemplate | null>;
  };
}

/**
 * Default working memory template
 */
const DEFAULT_TEMPLATE: WorkingMemoryTemplate = {
  format: "markdown",
  content: `
# User Information
- **First Name**: 
- **Last Name**: 
- **Location**: 
- **Occupation**: 
- **Interests**: 
- **Goals**: 
- **Events**: 
- **Facts**: 
- **Projects**: 
`,
};

/**
 * Working Memory Processor
 * 
 * Injects structured context (user profile, preferences) into the conversation.
 */
export class WorkingMemory implements MemoryProcessor {
  readonly id = "working-memory";
  readonly name = "Working Memory Processor";

  private storage: MemoryStorage;
  private template?: WorkingMemoryTemplate;
  private scope: "thread" | "resource";
  private useVNext: boolean;
  private templateProvider?: WorkingMemoryProcessorConfig["templateProvider"];

  constructor(config: WorkingMemoryProcessorConfig) {
    this.storage = config.storage;
    this.template = config.template;
    this.scope = config.scope ?? "resource";
    this.useVNext = config.useVNext ?? false;
    this.templateProvider = config.templateProvider;
  }

  async processInputStep(args: {
    messages: CoreMessage[];
    context: ProcessorContext;
  }): Promise<CoreMessage[]> {
    const { messages, context } = args;
    const { threadId, resourceId, memoryConfig } = context;

    // Determine scope from config
    const scope = memoryConfig?.workingMemory && 
      typeof memoryConfig.workingMemory === "object" && 
      "scope" in memoryConfig.workingMemory
        ? memoryConfig.workingMemory.scope
        : this.scope;

    let workingMemory: string | null | undefined;

    // Get working memory from storage
    if (scope === "thread") {
      const thread = await this.storage.getThreadById({ threadId });
      workingMemory = thread?.metadata?.workingMemory as string | undefined;
    } else {
      const resource = await this.storage.getResourceById({ resourceId });
      workingMemory = resource?.workingMemory;
    }

    // If no working memory exists, use template
    if (!workingMemory) {
      // Try to get template from provider or use local template
      let template = this.template;
      
      if (this.templateProvider && memoryConfig) {
        const providerTemplate = await this.templateProvider.getWorkingMemoryTemplate({ memoryConfig });
        if (providerTemplate) {
          template = providerTemplate;
        }
      }

      if (!template) {
        template = DEFAULT_TEMPLATE;
      }

      workingMemory = template.content;
    }

    // Inject as system message at the start
    const workingMemoryMessage: CoreMessage = {
      id: `working-memory-${Date.now()}`,
      role: "system",
      content: `<working_memory>\n${workingMemory}\n</working_memory>`,
      createdAt: new Date(),
    };

    return [workingMemoryMessage, ...messages];
  }
}
