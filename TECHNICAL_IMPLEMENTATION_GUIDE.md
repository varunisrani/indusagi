# New Indus AGI: Technical Implementation Guide for Mastra Features

## 🎯 Overview

This guide provides detailed technical implementation details for integrating Mastra's key features into New Indus AGI. Each section includes code examples, architecture patterns, and integration points.

---

## 1. MCP (Model Context Protocol) Implementation

### 1.1 MCP Client

**File**: `src/mcp/client.ts`

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '../agent/tools/types.js';

export interface MCPClientConfig {
  servers: Record<string, {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: URL;
    requestInit?: RequestInit;
  }>;
}

export class MCPClient {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, any> = new Map();

  constructor(private config: MCPClientConfig) {}

  async connect(): Promise<void> {
    for (const [name, serverConfig] of Object.entries(this.config.servers)) {
      let transport;
      
      if (serverConfig.command) {
        // Stdio transport
        transport = new StdioClientTransport({
          command: serverConfig.command,
          args: serverConfig.args,
          env: serverConfig.env
        });
      } else if (serverConfig.url) {
        // HTTP/SSE transport
        if (serverConfig.url.protocol === 'http:' || serverConfig.url.protocol === 'https:') {
          transport = new SSEClientTransport(serverConfig.url, {
            requestInit: serverConfig.requestInit
          });
        }
      }

      const client = new Client({ name: 'indusagi-mcp-client', version: '1.0.0' });
      await client.connect(transport);
      
      this.clients.set(name, client);
      this.transports.set(name, transport);
    }
  }

  async listTools(): Promise<Record<string, Tool>> {
    const tools: Record<string, Tool> = {};

    for (const [serverName, client] of this.clients) {
      const response = await client.listTools();
      
      for (const tool of response.tools) {
        const namespacedName = `${serverName}_${tool.name}`;
        tools[namespacedName] = this.convertMCPTool(tool, client);
      }
    }

    return tools;
  }

  private convertMCPTool(mcpTool: any, client: Client): Tool {
    return {
      name: mcpTool.name,
      description: mcpTool.description,
      parameters: mcpTool.inputSchema,
      execute: async (args: any) => {
        const result = await client.callTool({
          name: mcpTool.name,
          arguments: args
        });
        return result.content;
      }
    };
  }

  async disconnect(): Promise<void> {
    for (const [name, client] of this.clients) {
      await client.close();
    }
    this.clients.clear();
    this.transports.clear();
  }
}
```

### 1.2 MCP Server

**File**: `src/mcp/server.ts`

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Tool } from '../agent/tools/types.js';
import type { Agent } from '../agent/agent.js';

export interface MCPServerConfig {
  id: string;
  name: string;
  version: string;
  tools?: Record<string, Tool>;
  agents?: Record<string, Agent>;
}

export class MCPServer {
  private server: Server;

  constructor(private config: MCPServerConfig) {
    this.server = new Server(
      { name: config.name, version: config.version },
      { capabilities: { tools: {}, resources: {} } }
    );
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler('tools/list', async () => {
      const tools = [];
      
      // Add regular tools
      if (this.config.tools) {
        for (const [name, tool] of Object.entries(this.config.tools)) {
          tools.push({
            name,
            description: tool.description,
            inputSchema: tool.parameters
          });
        }
      }
      
      // Add agents as tools
      if (this.config.agents) {
        for (const [name, agent] of Object.entries(this.config.agents)) {
          tools.push({
            name: `ask_${name}`,
            description: `Ask ${name} agent: ${agent.instructions}`,
            inputSchema: {
              type: 'object',
              properties: {
                prompt: { type: 'string' }
              },
              required: ['prompt']
            }
          });
        }
      }
      
      return { tools };
    });

    // Execute tool
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      
      // Check if it's an agent query
      if (name.startsWith('ask_')) {
        const agentName = name.replace('ask_', '');
        const agent = this.config.agents?.[agentName];
        if (agent) {
          const result = await agent.generate(args.prompt);
          return {
            content: [{ type: 'text', text: result }]
          };
        }
      }
      
      // Regular tool execution
      const tool = this.config.tools?.[name];
      if (tool) {
        const result = await tool.execute(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }]
        };
      }
      
      throw new Error(`Tool not found: ${name}`);
    });
  }

  async startStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}
```

---

## 2. Vector Store Implementation

### 2.1 Interface

**File**: `src/vector/types.ts`

```typescript
export interface VectorStore {
  upsert(params: {
    indexName: string;
    vectors: number[][];
    metadata?: Record<string, any>[];
    ids?: string[];
  }): Promise<void>;

  query(params: {
    indexName: string;
    queryVector: number[];
    topK?: number;
    filter?: Record<string, any>;
  }): Promise<Array<{
    id: string;
    score: number;
    metadata: Record<string, any>;
  }>>;

  delete(params: {
    indexName: string;
    ids: string[];
  }): Promise<void>;
}

export interface VectorStoreConfig {
  provider: 'pinecone' | 'chroma' | 'memory';
  apiKey?: string;
  url?: string;
}
```

### 2.2 Pinecone Implementation

**File**: `src/vector/providers/pinecone.ts`

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
import type { VectorStore } from '../types.js';

export class PineconeVector implements VectorStore {
  private client: Pinecone;

  constructor(config: { apiKey: string }) {
    this.client = new Pinecone({ apiKey: config.apiKey });
  }

  async upsert({
    indexName,
    vectors,
    metadata,
    ids
  }: {
    indexName: string;
    vectors: number[][];
    metadata?: Record<string, any>[];
    ids?: string[];
  }): Promise<void> {
    const index = this.client.index(indexName);
    
    const records = vectors.map((vector, i) => ({
      id: ids?.[i] || `vec_${i}`,
      values: vector,
      metadata: metadata?.[i] || {}
    }));

    await index.upsert(records);
  }

  async query({
    indexName,
    queryVector,
    topK = 5,
    filter
  }: {
    indexName: string;
    queryVector: number[];
    topK?: number;
    filter?: Record<string, any>;
  }): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>> {
    const index = this.client.index(indexName);
    
    const result = await index.query({
      vector: queryVector,
      topK,
      filter,
      includeMetadata: true
    });

    return result.matches?.map(match => ({
      id: match.id,
      score: match.score || 0,
      metadata: match.metadata || {}
    })) || [];
  }

  async delete({ indexName, ids }: { indexName: string; ids: string[] }): Promise<void> {
    const index = this.client.index(indexName);
    await index.deleteMany(ids);
  }
}
```

### 2.3 In-Memory Implementation (for testing)

**File**: `src/vector/providers/memory.ts`

```typescript
import type { VectorStore } from '../types.js';

interface VectorRecord {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
}

export class InMemoryVector implements VectorStore {
  private indexes: Map<string, Map<string, VectorRecord>> = new Map();

  async upsert({
    indexName,
    vectors,
    metadata,
    ids
  }: {
    indexName: string;
    vectors: number[][];
    metadata?: Record<string, any>[];
    ids?: string[];
  }): Promise<void> {
    if (!this.indexes.has(indexName)) {
      this.indexes.set(indexName, new Map());
    }
    const index = this.indexes.get(indexName)!;

    vectors.forEach((vector, i) => {
      const id = ids?.[i] || `vec_${Date.now()}_${i}`;
      index.set(id, {
        id,
        vector,
        metadata: metadata?.[i] || {}
      });
    });
  }

  async query({
    indexName,
    queryVector,
    topK = 5
  }: {
    indexName: string;
    queryVector: number[];
    topK?: number;
  }): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>> {
    const index = this.indexes.get(indexName);
    if (!index) return [];

    const records = Array.from(index.values());
    const scored = records.map(record => ({
      ...record,
      score: this.cosineSimilarity(queryVector, record.vector)
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ id, score, metadata }) => ({ id, score, metadata }));
  }

  async delete({ indexName, ids }: { indexName: string; ids: string[] }): Promise<void> {
    const index = this.indexes.get(indexName);
    if (index) {
      ids.forEach(id => index.delete(id));
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
```

---

## 3. Enhanced Memory System

### 3.1 Core Memory Class

**File**: `src/memory/memory.ts`

```typescript
import type { VectorStore } from '../vector/types.js';
import type { Message } from '../ai/types.js';

export interface MemoryConfig {
  vectorStore?: VectorStore;
  embeddingProvider?: (text: string) => Promise<number[]>;
  semanticRecall?: {
    topK: number;
    threshold: number;
  };
  workingMemory?: {
    enabled: boolean;
    template: string;
  };
}

export class Memory {
  private threads: Map<string, Message[]> = new Map();
  
  constructor(private config: MemoryConfig) {}

  async createThread(threadId: string): Promise<void> {
    this.threads.set(threadId, []);
  }

  async saveMessages(threadId: string, messages: Message[]): Promise<void> {
    const existing = this.threads.get(threadId) || [];
    this.threads.set(threadId, [...existing, ...messages]);

    // Store in vector store for semantic search
    if (this.config.vectorStore) {
      const embeddings = await Promise.all(
        messages.map(m => this.config.embeddingProvider!(m.content))
      );
      
      await this.config.vectorStore.upsert({
        indexName: `thread_${threadId}`,
        vectors: embeddings,
        metadata: messages.map(m => ({ role: m.role, content: m.content })),
        ids: messages.map((_, i) => `msg_${Date.now()}_${i}`)
      });
    }
  }

  async recall(threadId: string, query: string): Promise<Message[]> {
    const recent = this.threads.get(threadId) || [];
    
    // If no vector store, return recent messages only
    if (!this.config.vectorStore || !this.config.embeddingProvider) {
      return recent.slice(-10);
    }

    // Semantic search
    const queryEmbedding = await this.config.embeddingProvider(query);
    const results = await this.config.vectorStore.query({
      indexName: `thread_${threadId}`,
      queryVector: queryEmbedding,
      topK: this.config.semanticRecall?.topK || 5
    });

    // Filter by threshold and convert to messages
    const threshold = this.config.semanticRecall?.threshold || 0.7;
    return results
      .filter(r => r.score >= threshold)
      .map(r => ({
        role: r.metadata.role,
        content: r.metadata.content,
        timestamp: Date.now()
      }));
  }

  async getWorkingMemory(threadId: string): Promise<Record<string, any>> {
    // Implementation for working memory with template
    // This would parse and extract structured data
    return {};
  }

  async updateWorkingMemory(threadId: string, data: Record<string, any>): Promise<void> {
    // Update working memory with new data
  }
}
```

### 3.2 Integration with Agent

**File**: `src/agent/agent-with-memory.ts`

```typescript
import { Agent } from './agent.js';
import type { Memory } from '../memory/memory.js';
import type { Message } from '../ai/types.js';

export interface AgentWithMemoryConfig {
  agent: Agent;
  memory: Memory;
  threadId: string;
}

export class AgentWithMemory {
  constructor(private config: AgentWithMemoryConfig) {}

  async generate(prompt: string): Promise<string> {
    // Recall relevant context
    const relevantContext = await this.config.memory.recall(
      this.config.threadId,
      prompt
    );

    // Build context-enhanced prompt
    const contextMessages: Message[] = [
      ...relevantContext,
      { role: 'user', content: prompt, timestamp: Date.now() }
    ];

    // Generate response
    const response = await this.config.agent.generate(prompt, {
      context: contextMessages
    });

    // Save to memory
    await this.config.memory.saveMessages(this.config.threadId, [
      { role: 'user', content: prompt, timestamp: Date.now() },
      { role: 'assistant', content: response, timestamp: Date.now() }
    ]);

    return response;
  }
}
```

---

## 4. Multi-Agent Network

### 4.1 Network Architecture

**File**: `src/agent/network/network.ts`

```typescript
import type { Agent } from '../agent.js';
import type { Tool } from '../tools/types.js';

export interface AgentNetworkConfig {
  supervisor: Agent;
  agents: Record<string, Agent>;
  tools?: Record<string, Tool>;
  maxSteps?: number;
}

export interface NetworkStep {
  iteration: number;
  agent: string;
  input: string;
  output: string;
}

export class AgentNetwork {
  private history: NetworkStep[] = [];

  constructor(private config: AgentNetworkConfig) {}

  async execute(task: string): Promise<string> {
    let currentTask = task;
    const maxSteps = this.config.maxSteps || 20;

    for (let i = 0; i < maxSteps; i++) {
      // Supervisor decides which agent/tool to use
      const routing = await this.route(currentTask, i);

      if (routing.type === 'complete') {
        return routing.result;
      }

      // Execute the selected primitive
      let result: string;
      if (routing.type === 'agent') {
        const agent = this.config.agents[routing.id];
        result = await agent.generate(routing.prompt);
      } else if (routing.type === 'tool') {
        const tool = this.config.tools![routing.id];
        const output = await tool.execute(routing.args);
        result = JSON.stringify(output);
      } else {
        result = 'Unknown routing type';
      }

      this.history.push({
        iteration: i,
        agent: routing.id,
        input: routing.prompt,
        output: result
      });

      currentTask = `Previous result from ${routing.id}: ${result}\n\nComplete the original task: ${task}`;
    }

    return `Max steps reached. Final result: ${currentTask}`;
  }

  private async route(task: string, iteration: number): Promise<{
    type: 'agent' | 'tool' | 'complete';
    id?: string;
    prompt?: string;
    args?: any;
    result?: string;
  }> {
    // Build routing prompt
    const agentList = Object.entries(this.config.agents)
      .map(([id, agent]) => `- ${id}: ${agent.instructions}`)
      .join('\n');

    const toolList = this.config.tools
      ? Object.entries(this.config.tools)
          .map(([id, tool]) => `- ${id}: ${tool.description}`)
          .join('\n')
      : '';

    const history = this.history
      .map(h => `Step ${h.iteration}: ${h.agent} => ${h.output.substring(0, 200)}`)
      .join('\n');

    const routingPrompt = `
You are a task router. Given the current task and available resources, decide the next step.

Available Agents:
${agentList}

Available Tools:
${toolList}

Execution History:
${history}

Current Task: ${task}

Respond with JSON:
{
  "type": "agent" | "tool" | "complete",
  "id": "name of agent or tool (if applicable)",
  "prompt": "full prompt for agent (if type is agent)",
  "args": { /* arguments for tool (if type is tool) */ },
  "result": "final result (if type is complete)"
}
`;

    const response = await this.config.supervisor.generate(routingPrompt);
    
    try {
      return JSON.parse(response);
    } catch {
      return { type: 'complete', result: response };
    }
  }
}
```

---

## 5. Workflow Engine

### 5.1 Workflow Definition

**File**: `src/workflow/workflow.ts`

```typescript
import { z } from 'zod';

export interface StepConfig<TInput = any, TOutput = any> {
  id: string;
  execute: (context: {
    input: TInput;
    prev: Record<string, any>;
    suspend: <T>(config: { prompt: string; schema: z.ZodSchema<T> }) => Promise<T>;
  }) => Promise<TOutput>;
  condition?: (context: { prev: Record<string, any> }) => boolean;
}

export interface WorkflowConfig {
  id: string;
  name: string;
  steps: StepConfig[];
}

export class Workflow {
  private steps: Map<string, StepConfig> = new Map();

  constructor(private config: WorkflowConfig) {
    for (const step of config.steps) {
      this.steps.set(step.id, step);
    }
  }

  async execute<TInput>(input: TInput): Promise<{
    results: Record<string, any>;
    status: 'completed' | 'suspended' | 'failed';
  }> {
    const results: Record<string, any> = {};
    const stepIds = Array.from(this.steps.keys());

    for (const stepId of stepIds) {
      const step = this.steps.get(stepId)!;

      // Check condition
      if (step.condition && !step.condition({ prev: results })) {
        continue;
      }

      try {
        const result = await step.execute({
          input,
          prev: results,
          suspend: async (config) => {
            // Suspend workflow for human input
            throw new WorkflowSuspendedError({
              stepId,
              prompt: config.prompt,
              schema: config.schema
            });
          }
        });
        results[stepId] = result;
      } catch (error) {
        if (error instanceof WorkflowSuspendedError) {
          return { results, status: 'suspended' };
        }
        return { results, status: 'failed' };
      }
    }

    return { results, status: 'completed' };
  }
}

export class WorkflowSuspendedError extends Error {
  constructor(public context: {
    stepId: string;
    prompt: string;
    schema: z.ZodSchema<any>;
  }) {
    super(`Workflow suspended at step: ${context.stepId}`);
  }
}
```

### 5.2 Usage Example

```typescript
const contentWorkflow = new Workflow({
  id: 'content-pipeline',
  name: 'Content Creation',
  steps: [
    {
      id: 'research',
      execute: async ({ input }) => {
        // Research topic
        return { data: 'research results' };
      }
    },
    {
      id: 'write',
      execute: async ({ prev }) => {
        // Write based on research
        return { article: 'written article' };
      }
    },
    {
      id: 'review',
      execute: async ({ prev, suspend }) => {
        // Get human approval
        const approval = await suspend({
          prompt: 'Please review: ' + prev.write.article,
          schema: z.object({ approved: z.boolean() })
        });
        return approval;
      }
    },
    {
      id: 'publish',
      condition: ({ prev }) => prev.review?.approved,
      execute: async ({ prev }) => {
        // Publish if approved
        return { published: true };
      }
    }
  ]
});

// Execute
const result = await contentWorkflow.execute({ topic: 'AI in Healthcare' });
```

---

## 6. Observability Integration

### 6.1 OpenTelemetry Setup

**File**: `src/observability/opentelemetry.ts`

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export function setupOpenTelemetry(config: {
  serviceName: string;
  endpoint?: string;
}) {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: config.endpoint
    })
  });

  sdk.start();
  return sdk;
}
```

### 6.2 Tracing Wrapper

**File**: `src/observability/tracing.ts`

```typescript
import { trace, Span } from '@opentelemetry/api';

const tracer = trace.getTracer('indusagi');

export function withTracing<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }

    try {
      const result = await fn(span);
      span.setStatus({ code: 1 }); // OK
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  });
}
```

---

## 7. Integration Points

### 7.1 Existing Agent Loop Integration

To integrate these features with the existing New Indus AGI agent loop:

```typescript
// src/agent/enhanced-agent.ts
import { Agent } from './agent.js';
import { Memory } from '../memory/memory.js';
import { MCPClient } from '../mcp/client.js';

export async function createEnhancedAgent(config: {
  agent: Agent;
  memory?: Memory;
  mcpClient?: MCPClient;
}) {
  const { agent, memory, mcpClient } = config;

  // Connect MCP and get additional tools
  let tools = {};
  if (mcpClient) {
    await mcpClient.connect();
    const mcpTools = await mcpClient.listTools();
    tools = { ...tools, ...mcpTools };
  }

  // Return enhanced agent
  return {
    async generate(prompt: string) {
      // Recall relevant memory
      let context = prompt;
      if (memory) {
        const relevant = await memory.recall('default', prompt);
        context = `Relevant context:\n${relevant.map(m => m.content).join('\n')}\n\nCurrent task: ${prompt}`;
      }

      // Generate with tools
      const response = await agent.generate(context, { tools });

      // Save to memory
      if (memory) {
        await memory.saveMessages('default', [
          { role: 'user', content: prompt, timestamp: Date.now() },
          { role: 'assistant', content: response, timestamp: Date.now() }
        ]);
      }

      return response;
    }
  };
}
```

---

## 📚 References

- **Mastra Core**: `/Users/varunisrani/indusagi-ts/mastra/packages/core/src/`
- **MCP SDK**: https://github.com/modelcontextprotocol/typescript-sdk
- **OpenTelemetry**: https://opentelemetry.io/docs/instrumentation/js/
- **Pinecone**: https://docs.pinecone.io/
- **Chroma**: https://docs.trychroma.com/

---

*Implementation guide created: March 3, 2026*
