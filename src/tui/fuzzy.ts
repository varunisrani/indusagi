/**
 * Fuzzy matching utilities.
 * Matches if all query characters appear in order (not necessarily consecutive).
 * Lower score = better match.
 */

export interface FuzzyMatch {
	matches: boolean;
	score: number;
}

export interface FuzzyScoringConfig {
	gapPenalty: number;
	consecutiveReward: number;
	wordBoundaryReward: number;
	lateMatchPenalty: number;
	swappedTokenPenalty: number;
}

export interface FuzzyMatcherStrategy {
	match(query: string, text: string, config: FuzzyScoringConfig): FuzzyMatch;
}

const DEFAULT_FUZZY_CONFIG: FuzzyScoringConfig = {
	gapPenalty: 2,
	consecutiveReward: 5,
	wordBoundaryReward: 10,
	lateMatchPenalty: 0.1,
	swappedTokenPenalty: 5,
};

class SequentialFuzzyStrategy implements FuzzyMatcherStrategy {
	match(query: string, text: string, config: FuzzyScoringConfig): FuzzyMatch {
		const queryLower = query.toLowerCase();
		const textLower = text.toLowerCase();

		if (queryLower.length === 0) {
			return { matches: true, score: 0 };
		}
		if (queryLower.length > textLower.length) {
			return { matches: false, score: 0 };
		}

		let queryIndex = 0;
		let score = 0;
		let lastMatchIndex = -1;
		let consecutiveMatches = 0;

		for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
			if (textLower[i] !== queryLower[queryIndex]) continue;

			const isWordBoundary = i === 0 || /[\s\-_./:]/.test(textLower[i - 1]!);
			if (lastMatchIndex === i - 1) {
				consecutiveMatches++;
				score -= consecutiveMatches * config.consecutiveReward;
			} else {
				consecutiveMatches = 0;
				if (lastMatchIndex >= 0) {
					score += (i - lastMatchIndex - 1) * config.gapPenalty;
				}
			}
			if (isWordBoundary) score -= config.wordBoundaryReward;
			score += i * config.lateMatchPenalty;
			lastMatchIndex = i;
			queryIndex++;
		}

		if (queryIndex < queryLower.length) return { matches: false, score: 0 };
		return { matches: true, score };
	}
}

class CachedFuzzyMatcher {
	private cache = new Map<string, FuzzyMatch>();
	constructor(
		private readonly strategy: FuzzyMatcherStrategy,
		private readonly config: FuzzyScoringConfig,
		private readonly maxSize = 2000,
	) {}

	match(query: string, text: string): FuzzyMatch {
		const key = `${query}\u0000${text}`;
		const cached = this.cache.get(key);
		if (cached) return cached;
		const result = this.strategy.match(query, text, this.config);
		if (this.cache.size >= this.maxSize) {
			const oldest = this.cache.keys().next().value;
			if (oldest) this.cache.delete(oldest);
		}
		this.cache.set(key, result);
		return result;
	}

	clear(): void {
		this.cache.clear();
	}
}

const defaultMatcher = new CachedFuzzyMatcher(new SequentialFuzzyStrategy(), DEFAULT_FUZZY_CONFIG);

export function fuzzyMatch(query: string, text: string): FuzzyMatch {
	const primaryMatch = defaultMatcher.match(query, text);
	if (primaryMatch.matches) return primaryMatch;

	const q = query.toLowerCase();
	const alphaNumericMatch = q.match(/^(?<letters>[a-z]+)(?<digits>[0-9]+)$/);
	const numericAlphaMatch = q.match(/^(?<digits>[0-9]+)(?<letters>[a-z]+)$/);
	const swappedQuery = alphaNumericMatch
		? `${alphaNumericMatch.groups?.digits ?? ""}${alphaNumericMatch.groups?.letters ?? ""}`
		: numericAlphaMatch
			? `${numericAlphaMatch.groups?.letters ?? ""}${numericAlphaMatch.groups?.digits ?? ""}`
			: "";

	if (!swappedQuery) return primaryMatch;
	const swappedMatch = defaultMatcher.match(swappedQuery, text);
	if (!swappedMatch.matches) return primaryMatch;
	return { matches: true, score: swappedMatch.score + DEFAULT_FUZZY_CONFIG.swappedTokenPenalty };
}

/**
 * Filter and sort items by fuzzy match quality (best matches first).
 * Supports space-separated tokens: all tokens must match.
 */
export function fuzzyFilter<T>(items: T[], query: string, getText: (item: T) => string): T[] {
	if (!query.trim()) return items;
	const tokens = query.trim().split(/\s+/).filter((t) => t.length > 0);
	if (tokens.length === 0) return items;

	const results: { item: T; totalScore: number }[] = [];
	for (const item of items) {
		const text = getText(item);
		let totalScore = 0;
		let allMatch = true;
		for (const token of tokens) {
			const match = fuzzyMatch(token, text);
			if (!match.matches) {
				allMatch = false;
				break;
			}
			totalScore += match.score;
		}
		if (allMatch) results.push({ item, totalScore });
	}

	results.sort((a, b) => a.totalScore - b.totalScore);
	return results.map((r) => r.item);
}
