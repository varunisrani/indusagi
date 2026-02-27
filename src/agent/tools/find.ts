import type { AgentTool } from "../types.js";
import { Type } from "@sinclair/typebox";
import { existsSync } from "fs";
import path from "path";
import { resolveToCwd } from "./path-utils.js";
import { DEFAULT_MAX_BYTES, formatSize, type TruncationResult, truncateHead } from "./truncate.js";

const findSchema = Type.Object({
	pattern: Type.String({
		description: "Glob pattern to match files, e.g. '*.ts', '**/*.json', or 'src/**/*.spec.ts'",
	}),
	path: Type.Optional(Type.String({ description: "Directory to search in (default: current directory)" })),
	limit: Type.Optional(Type.Number({ description: "Maximum number of results (default: 1000)" })),
});

const DEFAULT_LIMIT = 1000;

export interface FindToolDetails {
	truncation?: TruncationResult;
	resultLimitReached?: number;
}

/**
 * Simple glob matching function
 */
function globMatch(pattern: string, str: string): boolean {
	const regexPattern = pattern
		.replace(/\*/g, ".*")
		.replace(/\?/g, ".")
		.replace(/\./g, "\\.");
	const regex = new RegExp(`^${regexPattern}$`);
	return regex.test(str);
}

/**
 * Find files matching a glob pattern
 */
async function findFiles(dir: string, pattern: string, limit: number): Promise<string[]> {
	const fs = require("fs");
	const results: string[] = [];

	async function search(currentDir: string, depth: number): Promise<void> {
		if (results.length >= limit || depth > 20) return;

		try {
			const entries = fs.readdirSync(currentDir);
			for (const entry of entries) {
				if (results.length >= limit) break;

				const fullPath = path.join(currentDir, entry);
				const stat = fs.statSync(fullPath);

				if (stat.isDirectory()) {
					// Skip hidden directories and common exclusions
					if (!entry.startsWith(".") && entry !== "node_modules" && entry !== ".git") {
						await search(fullPath, depth + 1);
					}
				} else if (globMatch(pattern, entry)) {
					results.push(fullPath);
				}
			}
		} catch {
			// Skip inaccessible directories
		}
	}

	await search(dir, 0);
	return results;
}

export interface FindToolOptions {
	/** Custom operations for find. Default: local filesystem */
	operations?: any;
	exclude?: string[];
	sort?: "asc" | "desc";
}

export function createFindTool(cwd: string, options?: FindToolOptions): AgentTool<typeof findSchema> {
	return {
		name: "find",
		label: "find",
		description: `Search for files by glob pattern. Returns matching file paths relative to the search directory. Output is truncated to ${DEFAULT_LIMIT} results or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first).`,
		parameters: findSchema,
		execute: async (
			_toolCallId: string,
			{ pattern, path: searchDir, limit }: { pattern: string; path?: string; limit?: number },
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
						const effectiveLimit = limit ?? DEFAULT_LIMIT;
						const excludes = new Set(options?.exclude ?? ["node_modules", ".git"]);

						// Check if path exists
						if (!existsSync(searchPath)) {
							reject(new Error(`Path not found: ${searchPath}`));
							return;
						}

						// Find files matching pattern
						let results = await findFiles(searchPath, pattern, effectiveLimit);
						results = results.filter((p) => ![...excludes].some((ex) => p.includes(`/${ex}/`) || p.endsWith(`/${ex}`)));
						results.sort((a, b) => (options?.sort === "desc" ? b.localeCompare(a) : a.localeCompare(b)));

						signal?.removeEventListener("abort", onAbort);

						if (results.length === 0) {
							resolve({
								content: [{ type: "text", text: "No files found matching pattern" }],
								details: undefined,
							});
							return;
						}

						// Relativize paths
						const relativized = results.map((p) => {
							if (p.startsWith(searchPath)) {
								return p.slice(searchPath.length + 1);
							}
							return path.relative(searchPath, p);
						});

						const resultLimitReached = relativized.length >= effectiveLimit;
						const rawOutput = relativized.join("\n");
						const truncation = truncateHead(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER });

						let resultOutput = truncation.content;
						const details: FindToolDetails = {};
						const notices: string[] = [];

						if (resultLimitReached) {
							notices.push(`${effectiveLimit} results limit reached`);
							details.resultLimitReached = effectiveLimit;
						}

						if (truncation.truncated) {
							notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`);
							details.truncation = truncation;
						}

						if (notices.length > 0) {
							resultOutput += `\n\n[${notices.join(". ")}]`;
						}

						resolve({
							content: [{ type: "text", text: resultOutput }],
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

/** Default find tool using process.cwd() - for backwards compatibility */
export const findTool = createFindTool(process.cwd());
