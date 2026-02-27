import type { Api, Model, StreamOptions } from "../types.js";
import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";

/**
 * Generic client configuration for provider HTTP clients.
 */
export interface ClientConfig {
	apiKey: string;
	baseUrl?: string;
	defaultHeaders?: Record<string, string>;
	timeout?: number;
}

/**
 * Builder interface for creating provider clients.
 */
export interface ClientBuilder<TClient> {
	build(config: ClientConfig): TClient;
}

/**
 * Anthropic client builder.
 */
export class AnthropicClientBuilder implements ClientBuilder<any> {
	build(config: ClientConfig): any {
		const Anthropic = require("@anthropic-ai/sdk").default;
		return new Anthropic({
			apiKey: config.apiKey,
			baseURL: config.baseUrl,
			defaultHeaders: config.defaultHeaders,
			timeout: config.timeout,
		});
	}
}

/**
 * OpenAI client builder.
 */
export class OpenAIClientBuilder implements ClientBuilder<any> {
	build(config: ClientConfig): any {
		const OpenAI = require("openai").default;
		return new OpenAI({
			apiKey: config.apiKey,
			baseURL: config.baseUrl,
			defaultHeaders: config.defaultHeaders,
			timeout: config.timeout,
		});
	}
}

/**
 * Shared client factory that resolves builders by API.
 */
export class ProviderClientFactory {
	private static builders = new Map<string, ClientBuilder<any>>();

	static register<TClient>(api: Api, builder: ClientBuilder<TClient>): void {
		this.builders.set(api, builder);
	}

	static create<TClient>(api: Api, config: ClientConfig): TClient {
		const builder = this.builders.get(api);
		if (!builder) {
			throw new Error(`No client builder registered for API: ${api}`);
		}
		return builder.build(config) as TClient;
	}
}

/**
 * Register default client builders for known APIs.
 */
ProviderClientFactory.register("anthropic-messages", new AnthropicClientBuilder());
ProviderClientFactory.register("openai-completions", new OpenAIClientBuilder());
