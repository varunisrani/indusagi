/**
 * Indusagi Observability - Real-World Usage Example
 * 
 * This example demonstrates how to use the observability module
 * in a real AI agent application.
 */

import {
  Observability,
  ConsoleExporter,
  FileExporter,
  SensitiveDataFilter,
  SpanType,
  ObservabilityConfigManager,
} from '../src/observability/index.js';

// ============================================================================
// Configuration
// ============================================================================

const obs = new Observability({
  configs: {
    default: {
      serviceName: 'code-assistant-agent',
      serviceVersion: '1.0.0',
      sampling: { type: 'always' },
      includeInternalSpans: false,
      spanOutputProcessors: [
        new SensitiveDataFilter({
          patterns: [
            /api[_-]?key/i,
            /secret/i,
            /password/i,
            /token/i,
            /bearer/i,
          ],
          replacement: '[REDACTED]',
        }),
      ],
      exporters: [
        // Console output for development
        new ConsoleExporter({
          colors: true,
          maxDepth: 3,
        }),
        // File output for persistence
        new FileExporter({
          outputPath: './traces',
          format: 'ndjson',
          batchSize: 10,
          flushIntervalMs: 5000,
        }),
      ],
    },
  },
});

const instance = obs.getDefaultInstance();

// ============================================================================
// Simulated Components
// ============================================================================

async function simulateLLMCall(prompt: string): Promise<any> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    content: `Generated code for: ${prompt}`,
    usage: {
      prompt_tokens: 150,
      completion_tokens: 200,
      total_tokens: 350,
    },
    model: 'gpt-4',
  };
}

async function simulateToolCall(toolName: string, args: any): Promise<any> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (toolName === 'read_file') {
    return { content: 'File contents here...' };
  }
  if (toolName === 'write_file') {
    return { success: true, bytesWritten: args.content?.length || 0 };
  }
  return { result: 'Tool executed' };
}

async function simulateMemoryOperation(operation: string, query?: string): Promise<any> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (operation === 'retrieve') {
    return { memories: ['Previous context 1', 'Previous context 2'] };
  }
  return { success: true };
}

// ============================================================================
// Agent with Observability
// ============================================================================

class CodeAssistantAgent {
  private instance = instance;

  async run(userRequest: string) {
    // Start main agent run span
    const runSpan = this.instance.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'Code Assistant Run',
      input: { request: userRequest },
      attributes: {
        agentName: 'CodeAssistant',
        agentVersion: '1.0.0',
        maxSteps: '5',
      },
      metadata: {
        sessionId: `sess-${Date.now()}`,
        userId: 'user-123',
      },
    });

    try {
      // Step 1: Retrieve memory
      const memorySpan = runSpan.createChildSpan({
        type: SpanType.MEMORY_RETRIEVE,
        name: 'Retrieve Context',
        attributes: {
          operation: 'semantic_search',
          limit: '5',
        },
      });

      const memories = await simulateMemoryOperation('retrieve', userRequest);
      memorySpan.end({
        output: memories,
        attributes: {
          resultsCount: String(memories.memories.length),
        },
      });

      // Step 2: Generate code
      const generationSpan = runSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'Generate Code',
        input: {
          prompt: userRequest,
          context: memories.memories,
        },
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          temperature: '0.7',
          maxTokens: '2000',
        },
      });

      const response = await simulateLLMCall(userRequest);
      generationSpan.end({
        output: response,
        attributes: {
          promptTokens: String(response.usage.prompt_tokens),
          completionTokens: String(response.usage.completion_tokens),
          totalTokens: String(response.usage.total_tokens),
          model: response.model,
        },
      });

      // Step 3: Execute tool to write file
      const toolSpan = runSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'Write File',
        input: {
          path: './generated_code.ts',
          content: response.content,
        },
        attributes: {
          toolName: 'write_file',
          toolType: 'file_system',
        },
      });

      const toolResult = await simulateToolCall('write_file', {
        path: './generated_code.ts',
        content: response.content,
      });
      toolSpan.end({
        output: toolResult,
        attributes: {
          success: String(toolResult.success),
        },
      });

      // Step 4: Store in memory
      const storeSpan = runSpan.createChildSpan({
        type: SpanType.MEMORY_STORE,
        name: 'Store Result',
        input: {
          content: response.content,
          metadata: { type: 'code_generation', request: userRequest },
        },
      });

      await simulateMemoryOperation('store');
      storeSpan.end({ output: { success: true } });

      // Success - end main span
      runSpan.end({
        output: {
          code: response.content,
          fileWritten: './generated_code.ts',
        },
        attributes: {
          steps: '4',
          success: 'true',
          hasError: 'false',
        },
      });

      return {
        success: true,
        code: response.content,
      };
    } catch (error) {
      // Record error
      runSpan.error({
        error: error instanceof Error ? error : new Error(String(error)),
        endSpan: true,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// ============================================================================
// Error Simulation Example
// ============================================================================

class FailingAgent {
  private instance = instance;

  async runWithError() {
    const span = this.instance.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'Failing Agent Run',
      input: { request: 'This will fail' },
    });

    try {
      const toolSpan = span.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'Failing Tool',
      });

      // Simulate an error
      throw new Error('API rate limit exceeded');
    } catch (error) {
      span.error({
        error: error instanceof Error ? error : new Error(String(error)),
        endSpan: true,
      });

      throw error;
    }
  }
}

// ============================================================================
// Sampling Example
// ============================================================================

function createSampledObservability() {
  return new Observability({
    configs: {
      production: {
        serviceName: 'production-agent',
        // Sample 10% in production
        sampling: { type: 'ratio', probability: 0.1 },
        exporters: [
          new FileExporter({ outputPath: './traces/production' }),
        ],
      },
    },
  });
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('=== Indusagi Observability Demo ===\n');

  // Example 1: Successful agent run
  console.log('--- Example 1: Successful Agent Run ---');
  const agent = new CodeAssistantAgent();
  const result1 = await agent.run('Create a function to calculate fibonacci numbers');
  console.log('\nResult:', result1.success ? '✓ Success' : '✗ Failed', '\n');

  // Example 2: Agent with error
  console.log('--- Example 2: Agent with Error ---');
  const failingAgent = new FailingAgent();
  try {
    await failingAgent.runWithError();
  } catch (error) {
    console.log('\nCaught expected error:', (error as Error).message, '\n');
  }

  // Example 3: Multiple sequential runs
  console.log('--- Example 3: Multiple Runs ---');
  for (let i = 0; i < 3; i++) {
    const span = instance.startSpan({
      type: SpanType.AGENT_STEP,
      name: `Step ${i + 1}`,
      attributes: { stepNumber: String(i + 1) },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    span.end({ output: { step: i + 1 } });
  }
  console.log('\nCompleted 3 steps\n');

  // Flush and shutdown
  console.log('--- Flushing and Shutting Down ---');
  await obs.flush();
  await obs.shutdown();

  console.log('\n✓ Demo complete! Check ./traces/ directory for exported traces.');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { CodeAssistantAgent, FailingAgent, createSampledObservability };
