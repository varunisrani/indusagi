/**
 * Web Fetch Tool
 *
 * Fetches content from a specified URL.
 * Supports text, markdown, and HTML format options.
 */

import type { AgentTool } from "../types.js";
import type { ImageContent, TextContent } from "../../ai/index.js";
import { Type } from "@sinclair/typebox";

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_TIMEOUT = 30 * 1000; // 30 seconds

const webFetchSchema = Type.Object({
	url: Type.String({ description: "The URL to fetch content from (must start with http:// or https://)" }),
	format: Type.Optional(
		Type.Union([Type.Literal("text"), Type.Literal("markdown"), Type.Literal("html")], {
			description: "The format to return the content in (text, markdown, or html). Defaults to markdown.",
		}),
	),
	timeout: Type.Optional(Type.Number({ description: "Optional timeout in seconds (max 120). Default: 30" })),
});

export interface WebFetchToolDetails {
	url: string;
	format?: "text" | "markdown" | "html";
	timeout?: number;
	contentType?: string;
	fetchedBytes?: number;
}

export interface WebFetchToolOptions {
	/** Maximum response size in bytes (default: 5MB) */
	maxResponseSize?: number;
	/** Default timeout in milliseconds (default: 30000) */
	defaultTimeout?: number;
	/** Optional proxy base URL that forwards target URL via ?url= */
	proxyUrl?: string;
}

/**
 * Simple HTML to text converter - strips HTML tags
 */
async function htmlToTextSimple(html: string): Promise<string> {
	// Remove script and style elements
	let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
	text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
	text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "");

	// Decode HTML entities
	text = text.replace(/&amp;/g, "&");
	text = text.replace(/&lt;/g, "<");
	text = text.replace(/&gt;/g, ">");
	text = text.replace(/&quot;/g, '"');
	text = text.replace(/&#39;/g, "'");
	text = text.replace(/&nbsp;/g, " ");

	// Remove all remaining HTML tags
	text = text.replace(/<[^>]+>/g, " ");

	// Normalize whitespace
	text = text.replace(/\s+/g, " ");
	text = text.trim();

	return text;
}

/**
 * Simple HTML to markdown converter - basic conversion only
 */
function htmlToMarkdownSimple(html: string): string {
	let markdown = html;

	// Remove script, style, noscript, meta, link elements
	markdown = markdown.replace(/<(script|style|noscript|meta|link)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, "");

	// Headers
	markdown = markdown.replace(/<h1\b[^>]*>(.*?)<\/h1>/gi, "# $1\n");
	markdown = markdown.replace(/<h2\b[^>]*>(.*?)<\/h2>/gi, "## $1\n");
	markdown = markdown.replace(/<h3\b[^>]*>(.*?)<\/h3>/gi, "### $1\n");
	markdown = markdown.replace(/<h4\b[^>]*>(.*?)<\/h4>/gi, "#### $1\n");
	markdown = markdown.replace(/<h5\b[^>]*>(.*?)<\/h5>/gi, "##### $1\n");
	markdown = markdown.replace(/<h6\b[^>]*>(.*?)<\/h6>/gi, "###### $1\n");

	// Bold and italic
	markdown = markdown.replace(/<strong\b[^>]*>(.*?)<\/strong>/gi, "**$1**");
	markdown = markdown.replace(/<b\b[^>]*>(.*?)<\/b>/gi, "**$1**");
	markdown = markdown.replace(/<em\b[^>]*>(.*?)<\/em>/gi, "*$1*");
	markdown = markdown.replace(/<i\b[^>]*>(.*?)<\/i>/gi, "*$1*");

	// Links
	markdown = markdown.replace(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

	// Images
	markdown = markdown.replace(/<img\b[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, "![$2]($1)");
	markdown = markdown.replace(/<img\b[^>]*src="([^"]*)"[^>]*>/gi, "![]($1)");

	// Code blocks
	markdown = markdown.replace(/<pre\b[^>]*><code\b[^>]*>(.*?)<\/code><\/pre>/gis, "```\n$1\n```");
	markdown = markdown.replace(/<code\b[^>]*>(.*?)<\/code>/gi, "`$1`");

	// Lists (basic)
	markdown = markdown.replace(/<ul\b[^>]*>/gi, "");
	markdown = markdown.replace(/<\/ul>/gi, "");
	markdown = markdown.replace(/<ol\b[^>]*>/gi, "");
	markdown = markdown.replace(/<\/ol>/gi, "");
	markdown = markdown.replace(/<li\b[^>]*>/gi, "- ");
	markdown = markdown.replace(/<\/li>/gi, "\n");

	// Blockquotes
	markdown = markdown.replace(/<blockquote\b[^>]*>(.*?)<\/blockquote>/gis, (match, content) => {
		return content.split("\n").map((line: string) => `> ${line}`).join("\n");
	});

	// Horizontal rule
	markdown = markdown.replace(/<hr\b[^>]*>/gi, "\n---\n");

	// Paragraphs
	markdown = markdown.replace(/<p\b[^>]*>/gi, "");
	markdown = markdown.replace(/<\/p>/gi, "\n\n");

	// Line breaks
	markdown = markdown.replace(/<br\b[^>]*>/gi, "\n");

	// Remove all remaining tags
	markdown = markdown.replace(/<[^>]+>/g, "");

	// Normalize whitespace
	markdown = markdown.replace(/\n{3,}/g, "\n\n");
	markdown = markdown.replace(/[ \t]+/g, " ");
	markdown = markdown.trim();

	return markdown;
}

/**
 * Default fetch with timeout support
 */
async function fetchWithTimeout(
	url: string,
	options: RequestInit & { timeout?: number } = {},
	signal?: AbortSignal,
): Promise<Response> {
	const timeout = options.timeout || DEFAULT_TIMEOUT;

	// Create an abort controller for timeout
	const timeoutController = new AbortController();
	const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

	// If an external signal is provided, abort timeout controller when it aborts
	if (signal) {
		if (signal.aborted) {
			clearTimeout(timeoutId);
			throw new Error("Request aborted by user");
		}
		signal.addEventListener("abort", () => {
			clearTimeout(timeoutId);
		}, { once: true });
	}

	try {
		const response = await fetch(url, {
			...options,
			signal: timeoutController.signal,
		});
		clearTimeout(timeoutId);
		return response;
	} catch (error: any) {
		clearTimeout(timeoutId);
		if (error.name === "AbortError") {
			if (signal?.aborted) {
				throw new Error("Request aborted by user");
			}
			throw new Error(`Request timed out after ${timeout / 1000} seconds`);
		}
		throw error;
	}
}

export function createWebFetchTool(options?: WebFetchToolOptions): AgentTool<typeof webFetchSchema> {
	const maxResponseSize = options?.maxResponseSize || MAX_RESPONSE_SIZE;
	const defaultTimeout = options?.defaultTimeout || DEFAULT_TIMEOUT;

	return {
		name: "webfetch",
		label: "webfetch",
		description:
			"Fetches content from a specified URL. Takes a URL and optional format as input. Fetches URL content, converts to requested format (markdown by default). Returns content in the specified format. Use this tool when you need to retrieve and analyze web content. The URL must be a fully-formed valid URL starting with http:// or https://. Format options: 'markdown' (default), 'text', or 'html'. This tool is read-only and does not modify any files.",
		parameters: webFetchSchema,
		execute: async (
			_toolCallId: string,
			params: {
				url: string;
				format?: "text" | "markdown" | "html";
				timeout?: number;
			},
			signal?: AbortSignal,
		) => {
			// Check if already aborted
			if (signal?.aborted) {
				throw new Error("Web fetch aborted");
			}

			// Validate URL
			if (!params.url.startsWith("http://") && !params.url.startsWith("https://")) {
				throw new Error("URL must start with http:// or https://");
			}

			// Calculate timeout
			const timeout = Math.min((params.timeout ?? defaultTimeout / 1000) * 1000, 120000);

			// Build Accept header based on requested format
			let acceptHeader = "*/*";
			switch (params.format) {
				case "markdown":
					acceptHeader =
						"text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1";
					break;
				case "text":
					acceptHeader = "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1";
					break;
				case "html":
					acceptHeader =
						"text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1";
					break;
				default:
					acceptHeader =
						"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
			}

			const headers = {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
				Accept: acceptHeader,
				"Accept-Language": "en-US,en;q=0.9",
			};

			const requestUrl = options?.proxyUrl
				? `${options.proxyUrl}${options.proxyUrl.includes("?") ? "&" : "?"}url=${encodeURIComponent(params.url)}`
				: params.url;

			// Fetch URL
			const response = await fetchWithTimeout(requestUrl, { headers, timeout }, signal);

			if (!response.ok) {
				throw new Error(`Request failed with status code: ${response.status}`);
			}

			// Check content length
			const contentLength = response.headers.get("content-length");
			if (contentLength && parseInt(contentLength) > maxResponseSize) {
				throw new Error(
					`Response too large (exceeds ${(maxResponseSize / 1024 / 1024).toFixed(0)}MB limit)`,
				);
			}

			const arrayBuffer = await response.arrayBuffer();
			const fetchedBytes = arrayBuffer.byteLength;

			// Get content type
			const contentType = response.headers.get("content-type") || "";
			const mime = contentType.split(";")[0]?.trim().toLowerCase() || "";

			// Check if response is an image
			const isImage =
				mime.startsWith("image/") &&
				mime !== "image/svg+xml" &&
				mime !== "image/vnd.fastbidsheet";

			// Build details
			const details: WebFetchToolDetails = {
				url: params.url,
				format: params.format,
				timeout: params.timeout,
				contentType: mime,
				fetchedBytes,
			};

			// Return content based on type
			if (isImage) {
				const base64Content = Buffer.from(arrayBuffer).toString("base64");
				return {
					content: [
						{ type: "text", text: "Image fetched successfully" },
						{ type: "image", data: base64Content, mimeType: mime },
					],
					details,
				};
			}

			const content = Buffer.from(arrayBuffer).toString("utf-8");
			let output: (TextContent | ImageContent)[];

			// Handle content based on requested format and actual content type
			const format = params.format || "markdown";

			switch (format) {
				case "markdown":
					if (contentType.includes("text/html")) {
						const markdown = htmlToMarkdownSimple(content);
						output = [{ type: "text", text: markdown }];
					} else {
						output = [{ type: "text", text: content }];
					}
					break;

				case "text":
					if (contentType.includes("text/html")) {
						const text = await htmlToTextSimple(content);
						output = [{ type: "text", text: text }];
					} else {
						output = [{ type: "text", text: content }];
					}
					break;

				case "html":
					output = [{ type: "text", text: content }];
					break;

				default:
					output = [{ type: "text", text: content }];
			}

			return { content: output, details };
		},
	};
}

/** Default web fetch tool */
export const webFetchTool = createWebFetchTool();
