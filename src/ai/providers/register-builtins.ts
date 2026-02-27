import { clearApiProviders, registerApiProvider, type ApiProvider } from "../api-registry.js";
import type { Api, StreamOptions } from "../types.js";
import { streamBedrock, streamSimpleBedrock } from "./amazon-bedrock.js";
import { streamAnthropic, streamSimpleAnthropic } from "./anthropic.js";
import { streamAzureOpenAIResponses, streamSimpleAzureOpenAIResponses } from "./azure-openai-responses.js";
import { streamGoogle, streamSimpleGoogle } from "./google.js";
import { streamGoogleVertex, streamSimpleGoogleVertex } from "./google-vertex.js";
import { streamOpenAICodexResponses, streamSimpleOpenAICodexResponses } from "./openai-codex-responses.js";
import { streamOpenAICompletions, streamSimpleOpenAICompletions } from "./openai-completions.js";
import { streamOpenAIResponses, streamSimpleOpenAIResponses } from "./openai-responses.js";

const BUILTIN_SOURCE_ID = "indusagi:builtins";
const BUILTIN_VERSION = "ai-refactor-v1";

function registerBuiltIn<TApi extends Api>(provider: ApiProvider<TApi, StreamOptions>): void {
	registerApiProvider(provider, {
		sourceId: BUILTIN_SOURCE_ID,
		version: BUILTIN_VERSION,
		enabled: true,
	});
}

export function registerBuiltInApiProviders(): void {
	registerBuiltIn({
		api: "anthropic-messages",
		stream: streamAnthropic,
		streamSimple: streamSimpleAnthropic,
	});

	registerBuiltIn({
		api: "openai-completions",
		stream: streamOpenAICompletions,
		streamSimple: streamSimpleOpenAICompletions,
	});

	registerBuiltIn({
		api: "openai-responses",
		stream: streamOpenAIResponses,
		streamSimple: streamSimpleOpenAIResponses,
	});

	registerBuiltIn({
		api: "azure-openai-responses",
		stream: streamAzureOpenAIResponses,
		streamSimple: streamSimpleAzureOpenAIResponses,
	});

	registerBuiltIn({
		api: "openai-codex-responses",
		stream: streamOpenAICodexResponses,
		streamSimple: streamSimpleOpenAICodexResponses,
	});

	registerBuiltIn({
		api: "google-generative-ai",
		stream: streamGoogle,
		streamSimple: streamSimpleGoogle,
	});

	registerBuiltIn({
		api: "google-vertex",
		stream: streamGoogleVertex,
		streamSimple: streamSimpleGoogleVertex,
	});

	registerBuiltIn({
		api: "bedrock-converse-stream",
		stream: streamBedrock,
		streamSimple: streamSimpleBedrock,
	});

	// Kimi (Moonshot AI) uses the existing openai-completions provider — no custom registration needed
}

export function resetApiProviders(): void {
	clearApiProviders();
	registerBuiltInApiProviders();
}

registerBuiltInApiProviders();
