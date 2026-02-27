import type { AgentTool } from "../types.js";
import { Type } from "@sinclair/typebox";
import { readFileSync, statSync } from "fs";
import path from "path";
import { resolveToCwd } from "./path-utils.js";
import {
	DEFAULT_MAX_BYTES,
	formatSize,
	GREP_MAX_LINE_LENGTH,
	type TruncationResult,
	truncateHead,
	truncateLine,
} from "./truncate.js";

const grepSchema = Type.Object({
	pattern: Type.String({ description: "Search pattern (regex or literal string)" }),
	path: Type.Optional(Type.String({ description: "Directory or file to search (default: current directory)" })),
	ignoreCase: Type.Optional(Type.Boolean({ description: "Case-insensitive search (default: false)" })),
	literal: Type.Optional(
		Type.Boolean({ description: "Treat pattern as literal string instead of regex (default: false)" }),
	),
	context: Type.Optional(
		Type.Number({ description: "Number of lines to show before and after each match (default: 0)" }),
	),
	limit: Type.Optional(Type.Number({ description: "Maximum number of matches to return (default: 100)" })),
});

const DEFAULT_LIMIT = 100;
const regexCache = new Map<string, RegExp>();

export interface GrepToolDetails {
	truncation?: TruncationResult;
	matchLimitReached?: number;
	linesTruncated?: boolean;
}

/**
 * Pluggable operations for the grep tool.
 * Override these to delegate search to remote systems (e.g., SSH).
 */
export interface GrepOperations {
	/** Check if path is a directory. Throws if path doesn't exist. */
	isDirectory: (absolutePath: string) => Promise<boolean> | boolean;
	/** Read file contents for context lines */
	readFile: (absolutePath: string) => Promise<string> | string;
	/** List files in a directory */
	readdir: (absolutePath: string) => Promise<string[]> | string[];
}

const defaultGrepOperations: GrepOperations = {
	isDirectory: (p) => statSync(p).isDirectory(),
	readFile: (p) => readFileSync(p, "utf-8"),
	readdir: (p) => {
		const fs = require("fs");
		return fs.readdirSync(p);
	},
};

export interface GrepToolOptions {
	/** Custom operations for grep. Default: local filesystem */
	operations?: GrepOperations;
}

export function createGrepTool(cwd: string, options?: GrepToolOptions): AgentTool<typeof grepSchema> {
	const customOps = options?.operations;

	return {
		name: "grep",
		label: "grep",
		description: `Search file contents for a pattern. Returns matching lines with file paths and line numbers. Output is truncated to ${DEFAULT_LIMIT} matches or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). Long lines are truncated to ${GREP_MAX_LINE_LENGTH} chars.`,
		parameters: grepSchema,
		execute: async (
			_toolCallId: string,
			{
				pattern,
				path: searchDir,
				ignoreCase,
				literal,
				context,
				limit,
			}: {
				pattern: string;
				path?: string;
				ignoreCase?: boolean;
				literal?: boolean;
				context?: number;
				limit?: number;
			},
			signal?: AbortSignal,
		) => {
			return new Promise((resolve, reject) => {
				if (signal?.aborted) {
					reject(new Error("Operation aborted"));
					return;
				}

				const onAbort = () => reject(new Error("Operation aborted"));
				signal?.addEventListener("abort", onAbort, { once: true });

				(async () => {
					try {
						const searchPath = resolveToCwd(searchDir || ".", cwd);
						const ops = customOps ?? defaultGrepOperations;
						const effectiveLimit = limit ?? DEFAULT_LIMIT;
						const contextValue = context && context > 0 ? context : 0;

						// Check if path exists and get files to search
						const filesToSearch: string[] = [];

						const isDir = await ops.isDirectory(searchPath);
						if (isDir) {
							// Recursively find all files
							const entries = await ops.readdir(searchPath);
							for (const entry of entries) {
								const fullPath = path.join(searchPath, entry);
								try {
									if ((await ops.isDirectory(fullPath)) && !entry.startsWith(".")) {
										// Recursively search subdirectory
										const subEntries = await ops.readdir(fullPath);
										for (const subEntry of subEntries) {
											filesToSearch.push(path.join(fullPath, subEntry));
										}
									} else if (!await ops.isDirectory(fullPath)) {
										filesToSearch.push(fullPath);
									}
								} catch {
									// Skip inaccessible files
								}
							}
						} else {
							filesToSearch.push(searchPath);
						}

						if (filesToSearch.length === 0) {
							signal?.removeEventListener("abort", onAbort);
							resolve({ content: [{ type: "text", text: "No files to search" }], details: undefined });
							return;
						}

						// Build regex from pattern with cache
						let regex: RegExp;
						try {
							const flags = ignoreCase ? "i" : "";
							const source = literal ? pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : pattern;
							const cacheKey = `${flags}:${source}`;
							const cached = regexCache.get(cacheKey);
							if (cached) {
								regex = cached;
							} else {
								regex = new RegExp(source, flags);
								if (regexCache.size > 256) {
									const first = regexCache.keys().next().value;
									if (first) regexCache.delete(first);
								}
								regexCache.set(cacheKey, regex);
							}
						} catch (e: any) {
							signal?.removeEventListener("abort", onAbort);
							reject(new Error(`Invalid regex pattern: ${e.message}`));
							return;
						}

						// Search files
						const matches: Array<{ file: string; line: number; text: string }> = [];
						let linesTruncated = false;

						for (const filePath of filesToSearch) {
							if (matches.length >= effectiveLimit) break;

							try {
								const content = await ops.readFile(filePath);
								const lines = content.split("\n");

								for (let i = 0; i < lines.length; i++) {
									if (matches.length >= effectiveLimit) break;

									const line = lines[i];
									if (regex.test(line)) {
										// Get relative path
										const relativePath = path.relative(searchPath, filePath);

										// Truncate long lines
										const { text: truncatedText, wasTruncated } = truncateLine(line, GREP_MAX_LINE_LENGTH);
										if (wasTruncated) linesTruncated = true;

										// Add context lines
										const output: string[] = [];
										const start = Math.max(0, i - contextValue);
										const end = Math.min(lines.length - 1, i + contextValue);

										for (let j = start; j <= end; j++) {
											const isMatch = j === i;
											const prefix = isMatch ? ":" : "-";
											const contextLine = lines[j];
											const { text: ctxText } = truncateLine(contextLine, GREP_MAX_LINE_LENGTH);
											output.push(`${relativePath}${prefix}${j + 1} ${ctxText}`);
										}

										matches.push({ file: relativePath, line: i + 1, text: output.join("\n") });
									}
								}
							} catch {
								// Skip files we can't read
							}
						}

						signal?.removeEventListener("abort", onAbort);

						if (matches.length === 0) {
							resolve({ content: [{ type: "text", text: "No matches found" }], details: undefined });
							return;
						}

						// Format output
						const outputLines: string[] = [];
						for (const match of matches) {
							outputLines.push(match.text);
						}

						// Apply truncation
						const rawOutput = outputLines.join("\n");
						const truncation = truncateHead(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER });

						let output = truncation.content;
						const details: GrepToolDetails = {};
						const notices: string[] = [];

						if (matches.length >= effectiveLimit) {
							notices.push(
								`${effectiveLimit} matches limit reached. Use limit=${effectiveLimit * 2} for more, or refine pattern`,
							);
							details.matchLimitReached = effectiveLimit;
						}

						if (truncation.truncated) {
							notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`);
							details.truncation = truncation;
						}

						if (linesTruncated) {
							notices.push(
								`Some lines truncated to ${GREP_MAX_LINE_LENGTH} chars. Use read tool to see full lines`,
							);
							details.linesTruncated = true;
						}

						if (notices.length > 0) {
							output += `\n\n[${notices.join(". ")}]`;
						}

						resolve({
							content: [{ type: "text", text: output }],
							details: Object.keys(details).length > 0 ? details : undefined,
						});
					} catch (e: any) {
						signal?.removeEventListener("abort", onAbort);
						reject(e);
					}
				})();
			});
		},
	};
}

/** Default grep tool using process.cwd() - for backwards compatibility */
export const grepTool = createGrepTool(process.cwd());
