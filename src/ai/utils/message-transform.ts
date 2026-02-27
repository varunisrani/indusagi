import type { Message, TextContent, ImageContent } from "../types.js";

/**
 * Centralized message transformation utilities.
 */

/**
 * Convert message content to string (concatenates text blocks).
 */
export function messageContentToString(
	content: string | (TextContent | ImageContent)[],
): string {
	if (typeof content === "string") {
		return content;
	}
	return content
		.filter((c) => c.type === "text")
		.map((c) => c.text)
		.join("\n");
}

/**
 * Check if message contains images.
 */
export function messageHasImages(
	content: string | (TextContent | ImageContent)[],
): boolean {
	if (typeof content === "string") {
		return false;
	}
	return content.some((c) => c.type === "image");
}

/**
 * Extract text blocks from mixed content.
 */
export function extractTextBlocks(
	content: string | (TextContent | ImageContent)[],
): TextContent[] {
	if (typeof content === "string") {
		return [{ type: "text", text: content }];
	}
	return content.filter((c) => c.type === "text") as TextContent[];
}

/**
 * Extract image blocks from mixed content.
 */
export function extractImageBlocks(
	content: string | (TextContent | ImageContent)[],
): ImageContent[] {
	if (typeof content === "string") {
		return [];
	}
	return content.filter((c) => c.type === "image") as ImageContent[];
}

/**
 * Sanitize content string for safe transport.
 */
export function sanitizeContentString(text: string): string {
	return text.replace(/\x00/g, "").replace(/[\x01-\x1F\x7F]/g, "");
}

/**
 * Normalize line endings to \n.
 */
export function normalizeLineEndings(text: string): string {
	return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
