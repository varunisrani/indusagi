/**
 * Web Search Tool
 *
 * Performs real-time web searches using DuckDuckGo API.
 * Provides up-to-date information for current events and recent data.
 */

import type { AgentTool } from "../types.js";
import type { TextContent } from "../../ai/index.js";
import { Type } from "@sinclair/typebox";

const webSearchSchema = Type.Object({
	query: Type.String({ description: "Web search query" }),
	numResults: Type.Optional(
		Type.Number({ description: "Number of search results to return (default: 8, max: 10)" }),
	),
});

export interface WebSearchToolDetails {
	query: string;
	numResults?: number;
}

export interface WebSearchToolOptions {
	/** Custom API base URL (for testing or alternative endpoints) */
	baseUrl?: string;
	/** API key for Exa AI (if required) */
	apiKey?: string;
	/** Max requests per process window */
	rateLimitPerMinute?: number;
	/** Optional result filtering hook */
	filterResult?: (raw: string) => string;
	/** Optional fallback implementation */
	fallbackSearch?: (query: string, numResults?: number, signal?: AbortSignal) => Promise<string>;
}

let windowStart = Date.now();
let requestCount = 0;

/**
 * Default web search implementation using DuckDuckGo
 */
async function defaultWebSearch(
	query: string,
	numResults?: number,
	signal?: AbortSignal,
): Promise<string> {
	const count = Math.min(numResults ?? 8, 10);
	
	try {
		// Use DuckDuckGo Instant Answer API for web search
		const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
		
		const response = await fetch(searchUrl, { 
			signal,
			headers: {
				'Accept': 'application/json',
			}
		});
		
		if (!response.ok) {
			throw new Error(`Search request failed: ${response.status}`);
		}
		
		const data = await response.json() as any;
		
		// Build results from DuckDuckGo response
		const results: string[] = [];
		
		if (data.AbstractText) {
			results.push(`**Summary:** ${data.AbstractText}`);
			if (data.AbstractURL) {
				results.push(`Source: ${data.AbstractURL}`);
			}
		}
		
		if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
			const topics = data.RelatedTopics
				.filter((t: any) => t.Text && t.FirstURL)
				.slice(0, count);
			
			if (topics.length > 0) {
				results.push(`\n**Related Results:**`);
				for (const topic of topics) {
					results.push(`- ${topic.Text}`);
					results.push(`  URL: ${topic.FirstURL}`);
				}
			}
		}
		
		if (results.length === 0) {
			return `No results found for: "${query}". Try a different search query.`;
		}
		
		return `Web search results for: "${query}"\n\n${results.join('\n')}`;
		
	} catch (error: any) {
		if (error.name === 'AbortError') {
			throw new Error('Web search request timed out or was aborted');
		}
		// Fallback to basic search suggestion
		return `Search query: "${query}"\n\nUnable to perform live search. Please try again or use a different query.`;
	}
}

export function createWebSearchTool(options?: WebSearchToolOptions): AgentTool<typeof webSearchSchema> {
	const rateLimit = options?.rateLimitPerMinute ?? 60;

	return {
		name: "websearch",
		label: "websearch",
		description:
			"Search the web - performs real-time web searches and can scrape content from specific URLs. Provides up-to-date information for current events and recent data. Use this tool for accessing information beyond knowledge cutoff. The current year is 2026. You MUST use this year when searching for recent information or current events (e.g., search for 'AI news 2026', NOT 'AI news 2025').",
		parameters: webSearchSchema,
		execute: async (
			_toolCallId: string,
			{ query, numResults }: { query: string; numResults?: number },
			signal?: AbortSignal,
		) => {
			// Check if already aborted
			if (signal?.aborted) {
				throw new Error("Web search aborted");
			}

			const now = Date.now();
			if (now - windowStart >= 60_000) {
				windowStart = now;
				requestCount = 0;
			}
			requestCount += 1;
			if (requestCount > rateLimit) {
				throw new Error(`Websearch rate limit exceeded (${rateLimit}/min)`);
			}

			let resultText: string;
			try {
				resultText = await defaultWebSearch(query, numResults, signal);
			} catch (error: any) {
				if (options?.fallbackSearch) {
					resultText = await options.fallbackSearch(query, numResults, signal);
				} else if (error.name === "AbortError") {
					throw new Error("Web search request timed out or was aborted");
				} else {
					throw error;
				}
			}
			if (options?.filterResult) {
				resultText = options.filterResult(resultText);
			}

			// Build output
			let content: TextContent[];
			if (!resultText || resultText.trim() === "") {
				content = [
					{
						type: "text",
						text: "No search results found. Please try a different query.",
					},
				];
			} else {
				content = [
					{
						type: "text",
						text: resultText,
					},
				];
			}

			const details: WebSearchToolDetails = {
				query,
				numResults,
			};

			return { content, details };
		},
	};
}

/** Default web search tool */
export const webSearchTool = createWebSearchTool();
