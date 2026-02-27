# Changelog

## [0.12.12]

### Added
- **Session Management Exports**: Added `SessionManager` and session entry types to `indusagi/agent` exports
- **Message Utilities**: Added `convertToLlm` and custom message helpers to `indusagi/agent`
- **Docs Link**: README now links to https://www.indusagi.com

## [0.12.11]

### Fixed
- **Task Tool Streaming**: Fixed `toolCalls` and `durationMs` showing 0 during execution
  - Now accumulates stats from TaskUpdate callbacks
  - Shows real-time tool count and duration while task is running
  - Falls back to accumulated values when not in current update

## [0.12.10]

### Added
- **Task Tool Callback Architecture**: Task tool now supports custom executors
  - New `TaskExecutor` interface for injecting custom execution logic
  - New `TaskResult`, `TaskUpdate`, `SubagentStore`, `SubagentDefinition` types
  - `createTaskTool({ executor })` allows coding-agent to inject TaskSessionManager
  - Streaming updates via `onUpdate` callback

- **Todo Tool Persistence Architecture**: TodoStore now supports persistence callbacks
  - New `TodoStoreOptions` interface with `persist`, `load`, `rebuildFromBranch` callbacks
  - `TodoStore` can now persist to external storage (e.g., session entries)
  - Exported `TODO_PRIORITIES` and `TODO_STATUSES` constants

### Changed
- **Task Tool**: Now accepts `TaskToolOptions.executor` for custom execution
- **Task Tool**: Now accepts `TaskToolOptions.subagentStore` for dynamic subagent types
- **TodoStore**: Constructor now accepts `TodoStoreOptions` for persistence
- **TodoStore**: Added `find()`, `filterByStatus()`, `rebuildFromBranch()` methods

### New Exports
```typescript
// Task tool extension types
export type { TaskExecutor, TaskResult, TaskUpdate, SubagentDefinition, SubagentStore } from "indusagi/agent";

// Todo tool extension types  
export type { TodoStoreOptions } from "indusagi/agent";
export { TODO_PRIORITIES, TODO_STATUSES } from "indusagi/agent";
```

## [0.12.9]

### Changed
- **Web Search Tool**: Now works out of the box without any API key
  - Replaced placeholder implementation with DuckDuckGo Instant Answer API
  - Removed "Exa AI API configuration required" message
  - Free, no authentication needed, works immediately

## [0.12.6]

### Added
- **Claude Sonnet 4.6**: New model for `anthropic` and `opencode` providers
  - Model ID: `claude-sonnet-4-6`
  - 200K context window, 128K max output tokens
  - Pricing: $3/M input, $15/M output

### Changed
- **GPT-5.3 Codex Spark**: Context window increased from 32K to 128K tokens
- **GLM-5 (Z.AI)**: Fixed endpoint to use coding subscription path (`api.z.ai/api/coding/paas/v4`)

### Removed
- **Google Cloud Code Assist (Gemini CLI)**: OAuth provider and all models removed
- **Google Antigravity**: OAuth provider and all models removed
- Providers affected: `google-gemini-cli`, `google-antigravity`

## [0.12.5]

### Fixed
- **kimi-coding correct API**: per official Kimi Code docs (https://www.kimi.com/code/docs/en/more/third-party-agents.html)
  - api type: `anthropic-messages` ✅ (Kimi Code is Anthropic-compatible)
  - baseUrl: `https://api.kimi.com/coding` ✅ (official endpoint)
  - model: `kimi-for-coding` ✅ (official model ID, 262K context, 32K max output)
- Added `k2p5` as legacy alias for backwards compat

## [0.12.4]

### Fixed
- **kimi-coding garbled responses**: reverted `anthropic-messages` → `openai-completions` (Kimi API is OpenAI-compatible on both endpoints)
- **kimi-coding baseUrl**: corrected to `https://api.moonshot.cn/v1` (verified reachable, returns proper auth errors)
- Both `kimi` and `kimi-coding` now use `openai-completions` + `api.moonshot.cn/v1`

## [0.12.3]

### Fixed
- **kimi-coding empty responses**: fixed API type from `openai-completions` → `anthropic-messages` (Kimi Code is Anthropic-compatible, per openclaw docs)
- **kimi-coding baseUrl**: corrected to `https://api.kimi.com/anthropic`

## [0.12.2]

### Fixed
- **Kimi fetch failed**: replaced broken custom `kimi-openai-compatible` provider with existing `openai-completions` (battle-tested, SSE streaming works)
- **Kimi base URL**: corrected to `https://api.moonshot.ai/v1` (was `api.kimi.moonshot.cn/v1`)
- **Kimi env var**: `kimi` provider now reads `MOONSHOT_API_KEY`; `kimi-coding` reads `KIMI_API_KEY`
- **Kimi models**: default model updated to `kimi-k2.5` (256K context), `kimi-coding` to `k2p5`

## [0.12.1]

### Fixed
- **Kimi OAuth**: Removed fake OAuth endpoints that caused `fetch failed` error when logging in via TUI `/login` dialog
- **Kimi login**: Kimi now correctly appears in the API key section (not OAuth section) of the login selector
- `kimiOAuthProvider` removed from `getOAuthProviders()` registry — Kimi is API key only
- `kimi.ts` OAuth file stripped of non-existent device-code endpoints

## [0.12.0]

### Added
- **Kimi (Moonshot AI) Provider**: Full support for Kimi K2.5 API
  - Added `"kimi"` and `"kimi-coding"` providers
  - OpenAI-compatible streaming with Server-Sent Events
  - API key authentication via `KIMI_API_KEY` or `KIMICODE_API_KEY` environment variables
  - OAuth support with device code flow (`kimiOAuthProvider`)
  - Tool and function calling support
  - 5 new models:
    - `moonshot-v1-128k`: Kimi K2.5 with 128K context window
    - `moonshot-v1-32k`: Kimi K2.5 with 32K context window
    - `moonshot-v1-auto`: Kimi K2.5 auto mode
    - `kimi-code-latest`: Kimi Code API (subscription)
    - `kimi-code-latest-vision`: Kimi Code with vision support
  - Full streaming support with usage tracking and cost calculation
  - Automatic token buffering and error handling

## [0.11.9]

### Fixed
- **Google Antigravity**: Changed assistant identity from "Pi" to "indusagi" in system prompt bridge

## [0.11.8]

### Fixed
- **Google Antigravity**: Fixed `User-Agent` header from `antigravity/1.11.5 darwin/arm64` to `antigravity`
- **Google Antigravity**: Fixed `ideType` in `Client-Metadata` from `IDE_UNSPECIFIED` to `ANTIGRAVITY`
- These two header fixes resolve "This version of Antigravity is no longer supported" error
- All 6 Antigravity models now work: `gemini-3-flash`, `gemini-3-pro-high`, `gemini-3-pro-low`, `gpt-oss-120b-medium`, `claude-sonnet-4-5`, `claude-opus-4-6-thinking`

## [0.11.7]

### Changed
- **Google Antigravity OAuth**: Updated implementation to match openclaw
  - Fixed PKCE flow using proper `base64url` encoding
  - Improved callback server handling with better error messages
  - Added cleaner HTML response page
  - Better manual fallback flow for remote environments
  - Fixed base64 decode to use Node.js `Buffer.from()`
  - Added default model: `google-antigravity/claude-opus-4-6-thinking`
- **Google Gemini 3 models**: Fixed deprecated model IDs
  - Added `normalizeGoogleModelId()` to map `gemini-3-pro-high` → `gemini-3-pro-preview`
  - Map `gemini-3-pro-low` → `gemini-3-pro-preview`
  - Map `gemini-3-flash` → `gemini-3-flash-preview`
  - Updated `getGeminiCliThinkingLevel()` to use normalized model IDs
  - Updated `buildRequest()` to use normalized model IDs in API calls

## [0.11.4] - 2026-02-14

### Added

- Added the `gpt-5.3-codex-spark` model to the OpenAI and OpenAI Codex model lists.

## [0.1.14]

### Changed
- Updated \`indusagi\` dependency to v0.11.7

