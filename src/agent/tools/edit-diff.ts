/**
 * Shared diff computation utilities for edit tool.
 * Simplified version for indusagi agent framework.
 */

import { constants } from "fs";
import { access, readFile } from "fs/promises";
import { resolveToCwd } from "./path-utils.js";

export function detectLineEnding(content: string): "\r\n" | "\n" {
	const crlfIdx = content.indexOf("\r\n");
	const lfIdx = content.indexOf("\n");
	if (lfIdx === -1) return "\n";
	if (crlfIdx === -1) return "\n";
	return crlfIdx < lfIdx ? "\r\n" : "\n";
}

export function normalizeToLF(text: string): string {
	return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function restoreLineEndings(text: string, ending: "\r\n" | "\n"): string {
	return ending === "\r\n" ? text.replace(/\n/g, "\r\n") : text;
}

/**
 * Normalize text for fuzzy matching. Applies progressive transformations:
 * - Strip trailing whitespace from each line
 * - Normalize smart quotes to ASCII equivalents
 * - Normalize Unicode dashes/hyphens to ASCII hyphen
 * - Normalize special Unicode spaces to regular space
 */
export function normalizeForFuzzyMatch(text: string): string {
	return (
		text
			// Strip trailing whitespace per line
			.split("\n")
			.map((line) => line.trimEnd())
			.join("\n")
			// Smart single quotes → '
			.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
			// Smart double quotes → "
			.replace(/[\u201C\u201D\u201E\u201F]/g, '"')
			// Various dashes/hyphens → -
			// U+2010 hyphen, U+2011 non-breaking hyphen, U+2012 figure dash,
			// U+2013 en-dash, U+2014 em-dash, U+2015 horizontal bar, U+2212 minus
			.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
			// Special spaces → regular space
			// U+00A0 NBSP, U+2002-U+200A various spaces, U+202F narrow NBSP,
			// U+205F medium math space, U+3000 ideographic space
			.replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, " ")
	);
}

export interface FuzzyMatchResult {
	/** Whether a match was found */
	found: boolean;
	/** The index where match starts (in the content that should be used for replacement) */
	index: number;
	/** Length of matched text */
	matchLength: number;
	/** Whether fuzzy matching was used (false = exact match) */
	usedFuzzyMatch: boolean;
	/**
	 * The content to use for replacement operations.
	 * When exact match: original content. When fuzzy match: normalized content.
	 */
	contentForReplacement: string;
}

/**
 * Find oldText in content, trying exact match first, then fuzzy match.
 * When fuzzy matching is used, the returned contentForReplacement is the
 * fuzzy-normalized version of content (trailing whitespace stripped,
 * Unicode quotes/dashes normalized to ASCII).
 */
export function fuzzyFindText(content: string, oldText: string): FuzzyMatchResult {
	// Try exact match first
	const exactIndex = content.indexOf(oldText);
	if (exactIndex !== -1) {
		return {
			found: true,
			index: exactIndex,
			matchLength: oldText.length,
			usedFuzzyMatch: false,
			contentForReplacement: content,
		};
	}

	// Try fuzzy match - work entirely in normalized space
	const fuzzyContent = normalizeForFuzzyMatch(content);
	const fuzzyOldText = normalizeForFuzzyMatch(oldText);
	const fuzzyIndex = fuzzyContent.indexOf(fuzzyOldText);

	if (fuzzyIndex === -1) {
		return {
			found: false,
			index: -1,
			matchLength: 0,
			usedFuzzyMatch: false,
			contentForReplacement: content,
		};
	}

	// When fuzzy matching, we work in the normalized space for replacement.
	// This means the output will have normalized whitespace/quotes/dashes,
	// which is acceptable since we're fixing minor formatting differences anyway.
	return {
		found: true,
		index: fuzzyIndex,
		matchLength: fuzzyOldText.length,
		usedFuzzyMatch: true,
		contentForReplacement: fuzzyContent,
	};
}

/** Strip UTF-8 BOM if present, return both BOM (if any) and text without it */
export function stripBom(content: string): { bom: string; text: string } {
	return content.startsWith("\uFEFF") ? { bom: "\uFEFF", text: content.slice(1) } : { bom: "", text: content };
}

/**
 * Simple line-by-line diff without using external diff library.
 * Returns both diff string and first changed line number (in the new file).
 */
export function generateDiffString(
	oldContent: string,
	newContent: string,
	contextLines = 4,
): { diff: string; firstChangedLine: number | undefined } {
	const oldLines = oldContent.split("\n");
	const newLines = newContent.split("\n");
	const maxLineNum = Math.max(oldLines.length, newLines.length);
	const lineNumWidth = String(maxLineNum).length;

	const output: string[] = [];
	let i = 0;
	let j = 0;
	let firstChangedLine: number | undefined;
	let oldLineNum = 1;

	// Simple LCS (Longest Common Subsequence) for diff
	const lcs = computeLCS(oldLines, newLines);

	// Output diff
	while (i < oldLines.length || j < newLines.length) {
		if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
			// No change
			if (firstChangedLine !== undefined) {
				const lineNum = String(oldLineNum).padStart(lineNumWidth, " ");
				output.push(` ${lineNum} ${oldLines[i]}`);
			}
			i++;
			j++;
			oldLineNum++;
		} else if (j < newLines.length && (i >= oldLines.length || (lcs.get(i) || []).includes(j))) {
			// Added line
			if (firstChangedLine === undefined) {
				firstChangedLine = j + 1;
			}
			const lineNum = String(j + 1).padStart(lineNumWidth, " ");
			output.push(`+${lineNum} ${newLines[j]}`);
			j++;
		} else {
			// Removed line
			if (firstChangedLine === undefined) {
				firstChangedLine = j + 1;
			}
			const lineNum = String(oldLineNum).padStart(lineNumWidth, " ");
			output.push(`-${lineNum} ${oldLines[i]}`);
			i++;
			oldLineNum++;
		}
	}

	return { diff: output.join("\n"), firstChangedLine };
}

/**
 * Compute Longest Common Subsequence (LCS) for two arrays.
 * Returns a map from old line index to array of matching new line indices.
 */
function computeLCS<T>(a: T[], b: T[]): Map<number, number[]> {
	const m = a.length;
	const n = b.length;
	const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

	// Fill DP table
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (a[i - 1] === b[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}

	// Backtrack to find matches
	const result = new Map<number, number[]>();
	let i = m;
	let j = n;

	while (i > 0 && j > 0) {
		if (a[i - 1] === b[j - 1]) {
			const existing = result.get(i - 1) || [];
			existing.push(j - 1);
			result.set(i - 1, existing);
			i--;
			j--;
		} else if (dp[i - 1][j] >= dp[i][j - 1]) {
			i--;
		} else {
			j--;
		}
	}

	return result;
}

export interface EditDiffResult {
	diff: string;
	firstChangedLine: number | undefined;
}

export interface EditDiffError {
	error: string;
}

/**
 * Compute the diff for an edit operation without applying it.
 * Used for preview rendering in TUI before tool executes.
 */
export async function computeEditDiff(
	path: string,
	oldText: string,
	newText: string,
	cwd: string,
): Promise<EditDiffResult | EditDiffError> {
	const absolutePath = resolveToCwd(path, cwd);

	try {
		// Check if file exists and is readable
		try {
			await access(absolutePath, constants.R_OK);
		} catch {
			return { error: `File not found: ${path}` };
		}

		// Read the file
		const rawContent = await readFile(absolutePath, "utf-8");

		// Strip BOM before matching (LLM won't include invisible BOM in oldText)
		const { text: content } = stripBom(rawContent);

		const normalizedContent = normalizeToLF(content);
		const normalizedOldText = normalizeToLF(oldText);
		const normalizedNewText = normalizeToLF(newText);

		// Find old text using fuzzy matching (tries exact match first, then fuzzy)
		const matchResult = fuzzyFindText(normalizedContent, normalizedOldText);

		if (!matchResult.found) {
			return {
				error: `Could not find the exact text in ${path}. The old text must match exactly including all whitespace and newlines.`,
			};
		}

		// Count occurrences using fuzzy-normalized content for consistency
		const fuzzyContent = normalizeForFuzzyMatch(normalizedContent);
		const fuzzyOldText = normalizeForFuzzyMatch(normalizedOldText);
		const occurrences = fuzzyContent.split(fuzzyOldText).length - 1;

		if (occurrences > 1) {
			return {
				error: `Found ${occurrences} occurrences of the text in ${path}. The text must be unique. Please provide more context to make it unique.`,
			};
		}

		// Compute the new content using the matched position
		// When fuzzy matching was used, contentForReplacement is the normalized version
		const baseContent = matchResult.contentForReplacement;
		const newContent =
			baseContent.substring(0, matchResult.index) +
			normalizedNewText +
			baseContent.substring(matchResult.index + matchResult.matchLength);

		// Check if it would actually change anything
		if (baseContent === newContent) {
			return {
				error: `No changes would be made to ${path}. The replacement produces identical content.`,
			};
		}

		// Generate the diff
		return generateDiffString(baseContent, newContent);
	} catch (err) {
		return { error: err instanceof Error ? err.message : String(err) };
	}
}
