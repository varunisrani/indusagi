# Indusagi Observability

A comprehensive observability module for AI agents based on Mastra patterns and OpenTelemetry standards.

## Features

- **Distributed Tracing**: Track agent runs, model calls, tool executions
- **Multiple Export Backends**: Console, File, Langfuse, Sentry, and more
- **Configurable Sampling**: Control trace volume and costs
- **Data Redaction**: Automatically filter sensitive information
- **OpenTelemetry Compatible**: Standard span ID format
- **Type Safe**: Full TypeScript support

## Quick Start

```typescript
import { Observability, ConsoleExporter, SpanType } from '@indusagi/observability';

// Create observability instance
const obs = new Observability({
  configs: {
    default: {
      serviceName: 'my-agent',
      sampling: { type: 'always' },
      exporters: [
        new ConsoleExporter({ colors: true })
      ]
    }
  }
});

// Get the observability instance
const instance = obs.getDefaultInstance();

// Start a span
const span = instance.startSpan({
  type: SpanType.AGENT_RUN,
  name: 'Agent Execution',
  input: { prompt: 'Hello world' },
  attributes: { agentId: 'agent-1' }
});

// ... do work ...

// End the span
span.end({
  output: { result: 'Hello! How can I help you?' },
  status: 'success'
});
```

## Span Types

```typescript
enum SpanType {
  // Agent lifecycle
  AGENT_RUN = 'agent_run',
  AGENT_STEP = 'agent_step',
  AGENT_DECISION = 'agent_decision',
  
  // AI/Model operations
  MODEL_GENERATION = 'model_generation',
  MODEL_STEP = 'model_step',
  MODEL_CHUNK = 'model_chunk',
  
  // Tool operations
  TOOL_CALL = 'tool_call',
  MCP_TOOL_CALL = 'mcp_tool_call',
  
  // Memory operations
  MEMORY_OPERATION = 'memory_operation',
  MEMORY_RETRIEVE = 'memory_retrieve',
  MEMORY_STORE = 'memory_store',
  
  // Workflow operations
  WORKFLOW_RUN = 'workflow_run',
  WORKFLOW_STEP = 'workflow_step',
  
  // Custom operations
  GENERIC = 'generic'
}
```

## Exporters

### Console Exporter
```typescript
import { ConsoleExporter } from '@indusagi/observability';

new ConsoleExporter({
  colors: true,      // Enable ANSI colors
  maxDepth: 3        // Max object nesting depth
});
```

### File Exporter
```typescript
import { FileExporter } from '@indusagi/observability';

new FileExporter({
  outputPath: './traces',
  format: 'ndjson',   // 'json' or 'ndjson'
  batchSize: 100,     // Flush after N spans
  flushIntervalMs: 5000  // Flush every 5 seconds
});
```

### Multiple Exporters
```typescript
const obs = new Observability({
  configs: {
    default: {
      serviceName: 'my-agent',
      exporters: [
        new ConsoleExporter(),  // Development
        new FileExporter({      // Persistent storage
          outputPath: './traces'
        })
      ]
    }
  }
});
```

## Sampling

```typescript
// Always sample
sampling: { type: 'always' }

// Never sample
sampling: { type: 'never' }

// Sample 10% of traces
sampling: { type: 'ratio', probability: 0.1 }

// Custom sampler
sampling: {
  type: 'custom',
  sampler: (options) => {
    // Always sample errors
    if (options?.metadata?.isError) return true;
    // Sample 5% otherwise
    return Math.random() < 0.05;
  }
}
```

## Data Redaction

```typescript
import { SensitiveDataFilter } from '@indusagi/observability';

const obs = new Observability({
  configs: {
    default: {
      serviceName: 'my-agent',
      spanOutputProcessors: [
        new SensitiveDataFilter({
          patterns: [
            /api[_-]?key/i,
            /secret/i,
            /password/i,
            /token/i
          ],
          replacement: '[REDACTED]'
        })
      ],
      exporters: [new ConsoleExporter()]
    }
  }
});
```

## Child Spans

```typescript
const parentSpan = instance.startSpan({
  type: SpanType.AGENT_RUN,
  name: 'Main Agent'
});

// Create child span
const childSpan = parentSpan.createChildSpan({
  type: SpanType.MODEL_GENERATION,
  name: 'LLM Call',
  attributes: { model: 'gpt-4' }
});

// End child first
childSpan.end({ output: result });

// Then end parent
parentSpan.end();
```

## Error Handling

```typescript
const span = instance.startSpan({
  type: SpanType.TOOL_CALL,
  name: 'API Call'
});

try {
  const result = await callApi();
  span.end({ output: result });
} catch (error) {
  span.error({
    error: error instanceof Error ? error : new Error(String(error)),
    endSpan: true  // Also ends the span
  });
}
```

## Environment Configuration

```bash
# Enable observability
INDUSAGI_OBSERVABILITY_ENABLED=true

# Sampling strategy
INDUSAGI_SAMPLING_STRATEGY=0.1

# Service name
OTEL_SERVICE_NAME=my-agent

# File export path
INDUSAGI_TRACES_OUTPUT_PATH=./traces

# Include internal framework spans
INDUSAGI_INCLUDE_INTERNAL_SPANS=true
```

## Complete Example

```typescript
import {
  Observability,
  ConsoleExporter,
  FileExporter,
  SensitiveDataFilter,
  SpanType,
  ObservabilityConfigManager
} from '@indusagi/observability';

// Load from environment
const config = ObservabilityConfigManager.fromEnvironment();

const obs = new Observability({
  configs: {
    development: {
      serviceName: 'my-agent',
      sampling: { type: 'always' },
      spanOutputProcessors: [new SensitiveDataFilter()],
      exporters: [
        new ConsoleExporter({ colors: true }),
        new FileExporter({ outputPath: './traces' })
      ]
    }
  }
});

const instance = obs.getDefaultInstance();

// Agent execution with tracing
async function runAgent(prompt: string) {
  const span = instance.startSpan({
    type: SpanType.AGENT_RUN,
    name: 'Agent Execution',
    input: { prompt },
    attributes: { agentId: 'agent-1', version: '1.0.0' },
    metadata: { userId: 'user-123', sessionId: 'sess-456' }
  });

  try {
    // Model call
    const modelSpan = span.createChildSpan({
      type: SpanType.MODEL_GENERATION,
      name: 'LLM Generation',
      attributes: { model: 'gpt-4', provider: 'openai' }
    });

    const response = await callLLM(prompt);
    
    modelSpan.end({
      output: response,
      attributes: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens
      }
    });

    // Success
    span.end({
      output: response.content,
      attributes: { success: true }
    });

    return response.content;
  } catch (error) {
    span.error({
      error: error instanceof Error ? error : new Error(String(error)),
      endSpan: true
    });
    throw error;
  } finally {
    await obs.flush();
  }
}

// Cleanup on shutdown
process.on('SIGINT', async () => {
  await obs.shutdown();
  process.exit(0);
});
```

## Architecture

The observability module is built on a layered architecture:

1. **Core Layer**: Spans, types, and lifecycle management
2. **Event Bus**: Routes events to exporters
3. **Exporters**: Send data to various backends
4. **Processors**: Transform spans before export
5. **Configuration**: Environment-based setup

## License

MIT
