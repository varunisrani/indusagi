import { MODELS } from "./models.generated.js";
import type { Api, KnownProvider, Model, Usage } from "./types.js";

export interface ModelSearchFilters {
	provider?: KnownProvider;
	api?: Api;
	reasoning?: boolean;
	supportsImageInput?: boolean;
	nameIncludes?: string;
}

export interface CostEstimateInput {
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens?: number;
	cacheWriteTokens?: number;
}

type ModelApi<
	TProvider extends KnownProvider,
	TModelId extends keyof (typeof MODELS)[TProvider],
> = (typeof MODELS)[TProvider][TModelId] extends { api: infer TApi } ? (TApi extends Api ? TApi : never) : never;

export class ModelRegistry {
	private readonly registry: Map<string, Map<string, Model<Api>>>;

	constructor(seedModels: typeof MODELS = MODELS) {
		this.registry = new Map();
		for (const [provider, models] of Object.entries(seedModels)) {
			const providerModels = new Map<string, Model<Api>>();
			for (const [id, model] of Object.entries(models)) {
				providerModels.set(id, model as Model<Api>);
			}
			this.registry.set(provider, providerModels);
		}
	}

	registerCustomModel<TApi extends Api>(model: Model<TApi>): void {
		const provider = model.provider;
		if (!this.registry.has(provider)) {
			this.registry.set(provider, new Map());
		}
		this.registry.get(provider)!.set(model.id, model as Model<Api>);
	}

	loadCustomModels<TApi extends Api>(models: Model<TApi>[]): void {
		for (const model of models) this.registerCustomModel(model);
	}

	getModel<TProvider extends KnownProvider, TModelId extends keyof (typeof MODELS)[TProvider]>(
		provider: TProvider,
		modelId: TModelId,
	): Model<ModelApi<TProvider, TModelId>> {
		const providerModels = this.registry.get(provider);
		return providerModels?.get(modelId as string) as Model<ModelApi<TProvider, TModelId>>;
	}

	getProviders(): KnownProvider[] {
		return Array.from(this.registry.keys()) as KnownProvider[];
	}

	getModels<TProvider extends KnownProvider>(
		provider: TProvider,
	): Model<ModelApi<TProvider, keyof (typeof MODELS)[TProvider]>>[] {
		const models = this.registry.get(provider);
		return models ? (Array.from(models.values()) as Model<ModelApi<TProvider, keyof (typeof MODELS)[TProvider]>>[]) : [];
	}

	findModels(filters: ModelSearchFilters = {}): Model<Api>[] {
		const results: Model<Api>[] = [];
		for (const [provider, models] of this.registry.entries()) {
			if (filters.provider && provider !== filters.provider) continue;
			for (const model of models.values()) {
				if (filters.api && model.api !== filters.api) continue;
				if (filters.reasoning !== undefined && model.reasoning !== filters.reasoning) continue;
				if (filters.supportsImageInput && !model.input.includes("image")) continue;
				if (filters.nameIncludes && !model.name.toLowerCase().includes(filters.nameIncludes.toLowerCase())) {
					continue;
				}
				results.push(model);
			}
		}
		return results;
	}

	estimateCost<TApi extends Api>(model: Model<TApi>, estimate: CostEstimateInput): Usage["cost"] {
		return {
			input: (model.cost.input / 1_000_000) * estimate.inputTokens,
			output: (model.cost.output / 1_000_000) * estimate.outputTokens,
			cacheRead: (model.cost.cacheRead / 1_000_000) * (estimate.cacheReadTokens ?? 0),
			cacheWrite: (model.cost.cacheWrite / 1_000_000) * (estimate.cacheWriteTokens ?? 0),
			total:
				(model.cost.input / 1_000_000) * estimate.inputTokens +
				(model.cost.output / 1_000_000) * estimate.outputTokens +
				(model.cost.cacheRead / 1_000_000) * (estimate.cacheReadTokens ?? 0) +
				(model.cost.cacheWrite / 1_000_000) * (estimate.cacheWriteTokens ?? 0),
		};
	}

	calculateCost<TApi extends Api>(model: Model<TApi>, usage: Usage): Usage["cost"] {
		usage.cost = this.estimateCost(model, {
			inputTokens: usage.input,
			outputTokens: usage.output,
			cacheReadTokens: usage.cacheRead,
			cacheWriteTokens: usage.cacheWrite,
		});
		return usage.cost;
	}
}

export const modelRegistry = new ModelRegistry();

export function getModel<TProvider extends KnownProvider, TModelId extends keyof (typeof MODELS)[TProvider]>(
	provider: TProvider,
	modelId: TModelId,
): Model<ModelApi<TProvider, TModelId>> {
	return modelRegistry.getModel(provider, modelId);
}

export function getProviders(): KnownProvider[] {
	return modelRegistry.getProviders();
}

export function getModels<TProvider extends KnownProvider>(
	provider: TProvider,
): Model<ModelApi<TProvider, keyof (typeof MODELS)[TProvider]>>[] {
	return modelRegistry.getModels(provider);
}

export function findModels(filters: ModelSearchFilters = {}): Model<Api>[] {
	return modelRegistry.findModels(filters);
}

export function estimateCost<TApi extends Api>(model: Model<TApi>, estimate: CostEstimateInput): Usage["cost"] {
	return modelRegistry.estimateCost(model, estimate);
}

export function registerCustomModel<TApi extends Api>(model: Model<TApi>): void {
	modelRegistry.registerCustomModel(model);
}

export function loadCustomModels<TApi extends Api>(models: Model<TApi>[]): void {
	modelRegistry.loadCustomModels(models);
}

export function calculateCost<TApi extends Api>(model: Model<TApi>, usage: Usage): Usage["cost"] {
	return modelRegistry.calculateCost(model, usage);
}

/** Models that support xhigh thinking level */
const XHIGH_MODELS = new Set(["gpt-5.1-codex-max", "gpt-5.2", "gpt-5.2-codex"]);

/**
 * Check if a model supports xhigh thinking level.
 * Currently only certain OpenAI Codex models support this.
 */
export function supportsXhigh<TApi extends Api>(model: Model<TApi>): boolean {
	return XHIGH_MODELS.has(model.id);
}

/**
 * Check if two models are equal by comparing both their id and provider.
 * Returns false if either model is null or undefined.
 */
export function modelsAreEqual<TApi extends Api>(
	a: Model<TApi> | null | undefined,
	b: Model<TApi> | null | undefined,
): boolean {
	if (!a || !b) return false;
	return a.id === b.id && a.provider === b.provider;
}
