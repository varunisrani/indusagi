import "./providers/register-builtins.js";

import { getApiProvider } from "./api-registry.js";
import type {
	Api,
	AssistantMessage,
	AssistantMessageEventStream,
	Context,
	Model,
	ProviderStreamOptions,
	SimpleStreamOptions,
	StreamOptions,
} from "./types.js";
import { validateContext } from "./types.js";

export { getEnvApiKey } from "./env-api-keys.js";

export interface StreamLogger {
	debug?: (message: string, details?: unknown) => void;
}

export class StreamOptionsBuilder {
	private options: ProviderStreamOptions = {};

	withTemperature(temperature: number): this {
		this.options.temperature = temperature;
		return this;
	}

	withMaxTokens(maxTokens: number): this {
		this.options.maxTokens = maxTokens;
		return this;
	}

	withApiKey(apiKey: string): this {
		this.options.apiKey = apiKey;
		return this;
	}

	withHeader(name: string, value: string): this {
		this.options.headers = { ...(this.options.headers ?? {}), [name]: value };
		return this;
	}

	withSignal(signal: AbortSignal): this {
		this.options.signal = signal;
		return this;
	}

	build(): ProviderStreamOptions {
		return { ...this.options };
	}
}

// Set up http proxy according to env variables for `fetch` based SDKs in Node.js.
// Bun has builtin support for this.
if (typeof process !== "undefined" && process.versions?.node) {
	import("undici").then((m) => {
		const { EnvHttpProxyAgent, setGlobalDispatcher } = m;
		setGlobalDispatcher(new EnvHttpProxyAgent());
	});
}

function validateModel(model: Model<Api>): void {
	if (!model || typeof model !== "object") throw new Error("Invalid model: expected object");
	if (!model.api || typeof model.api !== "string") throw new Error("Invalid model: api is required");
	if (!model.id || typeof model.id !== "string") throw new Error("Invalid model: id is required");
	if (!model.provider || typeof model.provider !== "string") {
		throw new Error("Invalid model: provider is required");
	}
}

function resolveApiProvider(api: Api) {
	const provider = getApiProvider(api);
	if (!provider) {
		throw new Error(`No API provider registered for api: ${api}`);
	}
	return provider;
}

function log(logger: StreamLogger | undefined, message: string, details?: unknown): void {
	logger?.debug?.(message, details);
}

export function stream<TApi extends Api>(
	model: Model<TApi>,
	context: Context,
	options?: ProviderStreamOptions,
	logger?: StreamLogger,
): AssistantMessageEventStream;
export function stream<TApi extends Api>(
	model: Model<TApi>,
	context: Context,
	options?: ProviderStreamOptions,
): AssistantMessageEventStream;
export function stream<TApi extends Api>(
	model: Model<TApi>,
	context: Context,
	options?: ProviderStreamOptions,
	logger?: StreamLogger,
): AssistantMessageEventStream {
	validateModel(model as Model<Api>);
	validateContext(context);
	const provider = resolveApiProvider(model.api);
	log(logger, "ai.stream.start", { api: model.api, model: model.id, hasTools: !!context.tools?.length });
	return provider.stream(model, context, options as StreamOptions);
}

export async function complete<TApi extends Api>(
	model: Model<TApi>,
	context: Context,
	options?: ProviderStreamOptions,
	logger?: StreamLogger,
): Promise<AssistantMessage> {
	const s = stream(model, context, options, logger);
	return s.result();
}

export function streamSimple<TApi extends Api>(
	model: Model<TApi>,
	context: Context,
	options?: SimpleStreamOptions,
	logger?: StreamLogger,
): AssistantMessageEventStream {
	validateModel(model as Model<Api>);
	validateContext(context);
	const provider = resolveApiProvider(model.api);
	log(logger, "ai.stream.simple.start", { api: model.api, model: model.id });
	return provider.streamSimple(model, context, options);
}

export async function completeSimple<TApi extends Api>(
	model: Model<TApi>,
	context: Context,
	options?: SimpleStreamOptions,
	logger?: StreamLogger,
): Promise<AssistantMessage> {
	const s = streamSimple(model, context, options, logger);
	return s.result();
}

export function streamByApi<TApi extends Api>(
	api: TApi,
	model: Model<TApi>,
	context: Context,
	options?: ProviderStreamOptions,
	logger?: StreamLogger,
): AssistantMessageEventStream {
	if (model.api !== api) {
		throw new Error(`Mismatched api: model=${model.api} expected=${api}`);
	}
	return stream(model, context, options, logger);
}
