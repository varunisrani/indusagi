import type {
	Api,
	AssistantMessageEventStream,
	Context,
	Model,
	SimpleStreamOptions,
	StreamFunction,
	StreamOptions,
} from "./types.js";

export type ApiStreamFunction = (
	model: Model<Api>,
	context: Context,
	options?: StreamOptions,
) => AssistantMessageEventStream;

export type ApiStreamSimpleFunction = (
	model: Model<Api>,
	context: Context,
	options?: SimpleStreamOptions,
) => AssistantMessageEventStream;

export interface ApiProvider<TApi extends Api = Api, TOptions extends StreamOptions = StreamOptions> {
	api: TApi;
	stream: StreamFunction<TApi, TOptions>;
	streamSimple: StreamFunction<TApi, SimpleStreamOptions>;
}

export interface ApiProviderMetadata {
	sourceId?: string;
	version?: string;
	enabled: boolean;
	registeredAt: number;
	updatedAt: number;
}

export interface RegisteredApiProvider {
	provider: ApiProviderInternal;
	metadata: ApiProviderMetadata;
}

export interface ApiProviderInternal {
	api: Api;
	stream: ApiStreamFunction;
	streamSimple: ApiStreamSimpleFunction;
}

export interface RegisterApiProviderOptions {
	sourceId?: string;
	version?: string;
	enabled?: boolean;
}

function wrapStream<TApi extends Api, TOptions extends StreamOptions>(
	api: TApi,
	stream: StreamFunction<TApi, TOptions>,
): ApiStreamFunction {
	return (model, context, options) => {
		if (model.api !== api) {
			throw new Error(`Mismatched api: ${model.api} expected ${api}`);
		}
		return stream(model as Model<TApi>, context, options as TOptions);
	};
}

function wrapStreamSimple<TApi extends Api>(
	api: TApi,
	streamSimple: StreamFunction<TApi, SimpleStreamOptions>,
): ApiStreamSimpleFunction {
	return (model, context, options) => {
		if (model.api !== api) {
			throw new Error(`Mismatched api: ${model.api} expected ${api}`);
		}
		return streamSimple(model as Model<TApi>, context, options);
	};
}

function validateProvider<TApi extends Api, TOptions extends StreamOptions>(provider: ApiProvider<TApi, TOptions>): void {
	if (!provider || typeof provider !== "object") {
		throw new Error("Invalid API provider: provider object is required");
	}
	if (!provider.api || typeof provider.api !== "string") {
		throw new Error("Invalid API provider: api must be a non-empty string");
	}
	if (typeof provider.stream !== "function") {
		throw new Error(`Invalid API provider (${provider.api}): stream must be a function`);
	}
	if (typeof provider.streamSimple !== "function") {
		throw new Error(`Invalid API provider (${provider.api}): streamSimple must be a function`);
	}
}

export class ProviderRegistry {
	private readonly registry = new Map<Api, RegisteredApiProvider>();

	register<TApi extends Api, TOptions extends StreamOptions>(
		provider: ApiProvider<TApi, TOptions>,
		options: RegisterApiProviderOptions = {},
	): void {
		validateProvider(provider);
		const now = Date.now();
		const existing = this.registry.get(provider.api);
		const metadata: ApiProviderMetadata = {
			sourceId: options.sourceId,
			version: options.version,
			enabled: options.enabled ?? true,
			registeredAt: existing?.metadata.registeredAt ?? now,
			updatedAt: now,
		};

		this.registry.set(provider.api, {
			provider: {
				api: provider.api,
				stream: wrapStream(provider.api, provider.stream),
				streamSimple: wrapStreamSimple(provider.api, provider.streamSimple),
			},
			metadata,
		});
	}

	get(api: Api): ApiProviderInternal | undefined {
		const entry = this.registry.get(api);
		if (!entry || !entry.metadata.enabled) return undefined;
		return entry.provider;
	}

	getWithMetadata(api: Api): RegisteredApiProvider | undefined {
		return this.registry.get(api);
	}

	list(includeDisabled = false): ApiProviderInternal[] {
		const values = Array.from(this.registry.values());
		return values
			.filter((entry) => includeDisabled || entry.metadata.enabled)
			.map((entry) => entry.provider);
	}

	enable(api: Api): boolean {
		const entry = this.registry.get(api);
		if (!entry) return false;
		entry.metadata.enabled = true;
		entry.metadata.updatedAt = Date.now();
		return true;
	}

	disable(api: Api): boolean {
		const entry = this.registry.get(api);
		if (!entry) return false;
		entry.metadata.enabled = false;
		entry.metadata.updatedAt = Date.now();
		return true;
	}

	unregisterBySource(sourceId: string): void {
		for (const [api, entry] of this.registry.entries()) {
			if (entry.metadata.sourceId === sourceId) this.registry.delete(api);
		}
	}

	clear(): void {
		this.registry.clear();
	}
}

export const providerRegistry = new ProviderRegistry();

export function registerApiProvider<TApi extends Api, TOptions extends StreamOptions>(
	provider: ApiProvider<TApi, TOptions>,
	sourceIdOrOptions?: string | RegisterApiProviderOptions,
): void {
	const options = typeof sourceIdOrOptions === "string" ? { sourceId: sourceIdOrOptions } : sourceIdOrOptions;
	providerRegistry.register(provider, options);
}

export function getApiProvider(api: Api): ApiProviderInternal | undefined {
	return providerRegistry.get(api);
}

export function getApiProviderWithMetadata(api: Api): RegisteredApiProvider | undefined {
	return providerRegistry.getWithMetadata(api);
}

export function getApiProviders(includeDisabled = false): ApiProviderInternal[] {
	return providerRegistry.list(includeDisabled);
}

export function enableApiProvider(api: Api): boolean {
	return providerRegistry.enable(api);
}

export function disableApiProvider(api: Api): boolean {
	return providerRegistry.disable(api);
}

export function unregisterApiProviders(sourceId: string): void {
	providerRegistry.unregisterBySource(sourceId);
}

export function clearApiProviders(): void {
	providerRegistry.clear();
}
