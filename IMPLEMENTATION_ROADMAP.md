# New Indus AGI: Mastra Feature Implementation Roadmap

## 🎯 Implementation Strategy

This roadmap provides a phased approach to integrating Mastra's advanced features into New Indus AGI. Each phase builds upon the previous, ensuring incremental value delivery.

---

## Phase 1: Foundation (Weeks 1-4)
**Goal**: Core infrastructure for MCP, Vector Stores, and Enhanced Memory

### Week 1: MCP Client Implementation
**Priority**: 🔴 Critical  
**Impact**: Very High  
**Effort**: Medium

#### Tasks:
- [ ] Create `@indusagi/mcp` package
- [ ] Implement `MCPClient` class
  - Support stdio transport
  - Support HTTP/SSE transport
  - Support Streamable HTTP transport
- [ ] Implement tool discovery and namespacing (`serverName_toolName`)
- [ ] Add MCP registry integration (Composio, Smithery, Klavis)
- [ ] Integration tests with sample MCP servers

#### Code Structure:
```
src/mcp/
├── client/
│   ├── configuration.ts    # MCPClient class
│   ├── transports/
│   │   ├── stdio.ts
│   │   ├── http.ts
│   │   └── streamable.ts
│   └── registry.ts         # Registry connections
├── types.ts
└── index.ts
```

#### Success Criteria:
- Can connect to external MCP servers
- Tools are auto-discovered and namespaced
- Works with Composio and Smithery registries

---

### Week 2: MCP Server Implementation
**Priority**: 🔴 Critical  
**Impact**: High  
**Effort**: Medium

#### Tasks:
- [ ] Implement `MCPServer` class
  - Tool exposure
  - Agent exposure
  - Resource exposure
- [ ] Support multiple transports (stdio, HTTP, SSE)
- [ ] Add serverless mode for edge deployment
- [ ] Create example MCP server

#### Code Structure:
```
src/mcp/
└── server/
    ├── server.ts          # MCPServer class
    ├── transports/
    │   ├── stdio.ts
    │   ├── http.ts
    │   └── sse.ts
    └── types.ts
```

#### Success Criteria:
- Can expose Indus AGI tools as MCP server
- Works with Claude Desktop and Cursor
- Deployable to serverless environments

---

### Week 3: Vector Store Abstraction
**Priority**: 🔴 Critical  
**Impact**: High  
**Effort**: Low

#### Tasks:
- [ ] Create `VectorStore` interface
- [ ] Implement `PineconeVector` adapter
- [ ] Implement `ChromaVector` adapter
- [ ] Implement `InMemoryVector` for testing
- [ ] Add vector operations (upsert, query, delete)

#### Code Structure:
```
src/vector/
├── types.ts
├── interface.ts
└── providers/
    ├── pinecone.ts
    ├── chroma.ts
    └── memory.ts
```

#### Success Criteria:
- Unified interface for all vector stores
- Can switch providers via configuration
- All basic operations supported

---

### Week 4: Enhanced Memory System
**Priority**: 🔴 Critical  
**Impact**: Very High  
**Effort**: Medium

#### Tasks:
- [ ] Implement `Memory` class with thread management
- [ ] Add semantic recall with vector search
- [ ] Add working memory with template support
- [ ] Integrate with existing agent loop
- [ ] Add message embedding support

#### Code Structure:
```
src/memory/
├── index.ts
├── memory.ts           # Main Memory class
├── thread.ts           # Thread management
├── semantic.ts         # Semantic recall
├── working.ts          # Working memory
└── types.ts
```

#### Success Criteria:
- Conversations persist across sessions
- Semantic search retrieves relevant messages
- Working memory tracks user preferences

---

## Phase 2: Core Capabilities (Weeks 5-8)
**Goal**: Multi-agent system, workflow engine, and observability

### Week 5: Agent Network Foundation
**Priority**: 🔴 Critical  
**Impact**: Very High  
**Effort**: High

#### Tasks:
- [ ] Design agent network architecture
- [ ] Implement routing agent pattern
- [ ] Create network loop with delegation
- [ ] Add sub-agent registry
- [ ] Implement primitive selection logic

#### Code Structure:
```
src/agent/network/
├── index.ts
├── network.ts          # Network orchestration
├── router.ts           # Routing agent
├── loop.ts             # Network loop
└── types.ts
```

#### Success Criteria:
- Supervisor can delegate to sub-agents
- Routing decisions are logged
- Context isolation between agents

---

### Week 6: Multi-Agent Execution
**Priority**: 🔴 Critical  
**Impact**: Very High  
**Effort**: High

#### Tasks:
- [ ] Implement parallel agent execution
- [ ] Add completion criteria with scorers
- [ ] Add iteration hooks
- [ ] Support human-in-the-loop checkpoints
- [ ] Add result aggregation

#### Success Criteria:
- Agents can run in parallel
- Completion criteria stop execution
- Human can intervene at checkpoints

---

### Week 7: Workflow Engine
**Priority**: 🟡 Important  
**Impact**: High  
**Effort**: High

#### Tasks:
- [ ] Design workflow DSL
- [ ] Implement step execution
- [ ] Add conditional branching
- [ ] Add parallel execution paths
- [ ] Implement workflow persistence

#### Code Structure:
```
src/workflow/
├── index.ts
├── workflow.ts         # Workflow class
├── step.ts             # Step definitions
├── engine.ts           # Execution engine
├── persistence.ts      # State persistence
└── types.ts
```

#### Success Criteria:
- Can define workflows with steps
- Conditions control execution flow
- State persists across restarts

---

### Week 8: Workflow Features
**Priority**: 🟡 Important  
**Impact**: High  
**Effort**: Medium

#### Tasks:
- [ ] Add human-in-the-loop suspension
- [ ] Implement retry logic
- [ ] Add error handling and compensation
- [ ] Create workflow visualizer
- [ ] Add workflow templates

#### Success Criteria:
- Workflows can pause for human input
- Failed steps can retry
- Errors are handled gracefully

---

## Phase 3: Advanced Features (Weeks 9-12)
**Goal**: RAG, Voice, Evaluations, and Storage

### Week 9: RAG Pipeline
**Priority**: 🟡 Important  
**Impact**: Medium  
**Effort**: Medium

#### Tasks:
- [ ] Create `Document` class
- [ ] Implement chunking strategies (fixed, semantic, recursive)
- [ ] Add embedding generation
- [ ] Implement retrieval pipeline
- [ ] Add re-ranking support

#### Code Structure:
```
src/rag/
├── index.ts
├── document.ts
├── chunking/
│   ├── fixed.ts
│   ├── semantic.ts
│   └── recursive.ts
├── embedding.ts
├── retrieval.ts
└── rerank.ts
```

---

### Week 10: Voice Integration
**Priority**: 🟡 Important  
**Impact**: Medium  
**Effort**: Low

#### Tasks:
- [ ] Create `Voice` interface
- [ ] Implement OpenAI TTS/STT
- [ ] Implement ElevenLabs voice
- [ ] Add real-time speech-to-speech
- [ ] Create voice agent helper

#### Code Structure:
```
src/voice/
├── index.ts
├── interface.ts
└── providers/
    ├── openai.ts
    ├── elevenlabs.ts
    └── google.ts
```

---

### Week 11: Evaluation Framework
**Priority**: 🟡 Important  
**Impact**: Medium  
**Effort**: Medium

#### Tasks:
- [ ] Create `Scorer` interface
- [ ] Implement LLM-based scorers (faithfulness, toxicity)
- [ ] Implement code scorers (similarity, keywords)
- [ ] Add evaluation runner
- [ ] Create evaluation reports

#### Code Structure:
```
src/evals/
├── index.ts
├── scorer.ts
├── scorers/
│   ├── llm/
│   │   ├── faithfulness.ts
│   │   └── toxicity.ts
│   └── code/
│       ├── similarity.ts
│       └── keywords.ts
└── runner.ts
```

---

### Week 12: Storage Integrations
**Priority**: 🟡 Important  
**Impact**: Medium  
**Effort**: Medium

#### Tasks:
- [ ] Create `Storage` interface
- [ ] Implement PostgreSQL adapter
- [ ] Implement LibSQL adapter
- [ ] Implement MongoDB adapter
- [ ] Add migration system

#### Code Structure:
```
src/storage/
├── index.ts
├── interface.ts
└── providers/
    ├── postgres.ts
    ├── libsql.ts
    └── mongodb.ts
```

---

## Phase 4: Developer Experience (Weeks 13-16)
**Goal**: Deployment, observability, and tooling

### Week 13: Observability Integration
**Priority**: 🟡 Important  
**Impact**: High  
**Effort**: Low

#### Tasks:
- [ ] Implement OpenTelemetry integration
- [ ] Add Langfuse provider
- [ ] Create tracing wrapper
- [ ] Add metrics collection
- [ ] Implement cost tracking

#### Code Structure:
```
src/observability/
├── index.ts
├── interface.ts
├── tracing.ts
├── metrics.ts
└── providers/
    ├── opentelemetry.ts
    └── langfuse.ts
```

---

### Week 14: Server and Deployment
**Priority**: 🟡 Important  
**Impact**: Medium  
**Effort**: Medium

#### Tasks:
- [ ] Create HTTP server with Hono
- [ ] Generate OpenAPI spec
- [ ] Add REST endpoints for agents/workflows
- [ ] Implement server adapters (Express, Fastify)
- [ ] Add deployment configs

#### Code Structure:
```
src/server/
├── index.ts
├── server.ts
├── routes/
│   ├── agents.ts
│   ├── workflows.ts
│   └── tools.ts
├── adapters/
│   ├── express.ts
│   └── fastify.ts
└── openapi.ts
```

---

### Week 15: CLI Enhancement
**Priority**: 🟢 Nice to have  
**Impact**: Medium  
**Effort**: Medium

#### Tasks:
- [ ] Create `create-indusagi` scaffolding tool
- [ ] Add `indusagi dev` command
- [ ] Add `indusagi build` command
- [ ] Add `indusagi deploy` command
- [ ] Create project templates

#### Code Structure:
```
src/cli/
├── index.ts
├── commands/
│   ├── dev.ts
│   ├── build.ts
│   └── deploy.ts
└── templates/
    ├── basic/
    └── advanced/
```

---

### Week 16: Playground UI
**Priority**: 🟢 Nice to have  
**Impact**: Medium  
**Effort**: High

#### Tasks:
- [ ] Create React-based playground
- [ ] Add agent testing interface
- [ ] Add workflow visualizer
- [ ] Add memory inspector
- [ ] Add log viewer

#### Code Structure:
```
packages/playground/
├── src/
│   ├── components/
│   │   ├── AgentTester.tsx
│   │   ├── WorkflowGraph.tsx
│   │   └── MemoryInspector.tsx
│   └── App.tsx
└── package.json
```

---

## 📋 Detailed Task Checklist

### Phase 1: Foundation
- [ ] Week 1: MCP Client
  - [ ] MCPClient class
  - [ ] Stdio transport
  - [ ] HTTP/SSE transport
  - [ ] Streamable HTTP transport
  - [ ] Tool discovery
  - [ ] Registry integration
  - [ ] Tests

- [ ] Week 2: MCP Server
  - [ ] MCPServer class
  - [ ] Tool exposure
  - [ ] Agent exposure
  - [ ] Transports (stdio, HTTP, SSE)
  - [ ] Serverless mode
  - [ ] Tests

- [ ] Week 3: Vector Stores
  - [ ] VectorStore interface
  - [ ] Pinecone adapter
  - [ ] Chroma adapter
  - [ ] InMemory adapter
  - [ ] Tests

- [ ] Week 4: Memory System
  - [ ] Memory class
  - [ ] Thread management
  - [ ] Semantic recall
  - [ ] Working memory
  - [ ] Agent integration
  - [ ] Tests

### Phase 2: Core Capabilities
- [ ] Week 5: Agent Network
  - [ ] Network architecture
  - [ ] Routing agent
  - [ ] Network loop
  - [ ] Sub-agent registry

- [ ] Week 6: Multi-Agent Execution
  - [ ] Parallel execution
  - [ ] Completion criteria
  - [ ] Iteration hooks
  - [ ] Human-in-the-loop

- [ ] Week 7: Workflow Engine
  - [ ] Workflow DSL
  - [ ] Step execution
  - [ ] Branching
  - [ ] Persistence

- [ ] Week 8: Workflow Features
  - [ ] Suspension/resumption
  - [ ] Retry logic
  - [ ] Error handling
  - [ ] Visualizer

### Phase 3: Advanced Features
- [ ] Week 9: RAG Pipeline
- [ ] Week 10: Voice Integration
- [ ] Week 11: Evaluation Framework
- [ ] Week 12: Storage Integrations

### Phase 4: Developer Experience
- [ ] Week 13: Observability
- [ ] Week 14: Server and Deployment
- [ ] Week 15: CLI Enhancement
- [ ] Week 16: Playground UI

---

## 🎯 Milestones and Deliverables

### Milestone 1 (End of Phase 1)
**Deliverables:**
- ✅ MCP client and server working
- ✅ 3 vector store providers
- ✅ Enhanced memory with semantic recall
- ✅ Integration with existing agent loop

**Demo:**
- Connect to external MCP server
- Use semantic memory in conversation
- Switch between vector stores

---

### Milestone 2 (End of Phase 2)
**Deliverables:**
- ✅ Multi-agent network working
- ✅ Workflow engine with persistence
- ✅ Human-in-the-loop support
- ✅ Completion criteria

**Demo:**
- Supervisor delegates to specialized agents
- Complex workflow with branches
- Pause for human approval

---

### Milestone 3 (End of Phase 3)
**Deliverables:**
- ✅ RAG pipeline
- ✅ Voice capabilities
- ✅ Evaluation framework
- ✅ Storage adapters

**Demo:**
- Document Q&A with RAG
- Voice-enabled agent
- Run evaluation suite

---

### Milestone 4 (End of Phase 4)
**Deliverables:**
- ✅ Observability dashboard
- ✅ REST API
- ✅ CLI tools
- ✅ Playground UI

**Demo:**
- Deploy agent as service
- Monitor with observability
- Use playground for testing

---

## ⚠️ Risk Mitigation

| Risk | Mitigation |
|------|------------|
| MCP SDK changes | Pin version, abstract interface |
| Vector store API changes | Unified interface allows swapping |
| Performance issues | Benchmark early, optimize |
| Breaking changes | Semantic versioning, migration guides |
| Resource constraints | Prioritize P1 features first |

---

## 📊 Resource Requirements

### Development Team
- 2-3 TypeScript developers
- 1 DevOps engineer (Phase 4)
- 1 UI developer (Phase 4)

### Infrastructure
- CI/CD pipeline
- Test environment
- Documentation hosting
- NPM registry access

### External Services (for testing)
- OpenAI API key
- Pinecone/Chroma instance
- PostgreSQL database
- Langfuse account

---

## 🎓 Learning Resources

### MCP Protocol
- Model Context Protocol spec: https://modelcontextprotocol.io
- Mastra MCP docs: `/Users/varunisrani/indusagi-ts/mastra/docs/src/content/en/docs/mcp/`

### Mastra Architecture
- Core packages: `/Users/varunisrani/indusagi-ts/mastra/packages/core/src/`
- Memory system: `/Users/varunisrani/indusagi-ts/mastra/packages/memory/`
- Workflow engine: `/Users/varunisrani/indusagi-ts/mastra/workflows/`

### Vector Stores
- Pinecone docs: https://docs.pinecone.io
- Chroma docs: https://docs.trychroma.com

---

## 🚀 Quick Start for Implementation

### Day 1: Setup
```bash
# Create feature branch
git checkout -b feature/mastra-integration

# Install MCP SDK
npm install @modelcontextprotocol/sdk

# Create directory structure
mkdir -p src/{mcp,memory,vector,workflow,evals,voice,storage,server}
```

### Day 2-3: MCP Client
- Study Mastra's implementation
- Port core functionality
- Write tests

### Day 4-5: MCP Server
- Implement server class
- Add transport layers
- Test with Claude Desktop

---

## 📈 Success Metrics

### Technical Metrics
- Test coverage > 80%
- Bundle size impact < 50%
- Performance overhead < 20%
- API compatibility maintained

### Adoption Metrics
- MCP servers connected: 5+
- Vector stores supported: 3+
- Storage providers: 3+
- Voice providers: 3+

### Quality Metrics
- Zero critical bugs
- < 5 major bugs
- Documentation complete
- Examples working

---

*Roadmap created: March 3, 2026*  
*Target completion: 16 weeks*  
*Review cycle: Weekly*
