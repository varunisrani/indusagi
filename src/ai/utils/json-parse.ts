import { parse as partialParse } from "partial-json";

export interface StreamingJsonParseOptions {
	fallbackValue?: unknown;
	allowPartial?: boolean;
	trimInput?: boolean;
}

export interface StreamingJsonParseResult<T> {
	value: T;
	parsed: boolean;
	usedPartialParser: boolean;
	error?: string;
}

export function parseStreamingJsonWithDiagnostics<T = any>(
	partialJson: string | undefined,
	options: StreamingJsonParseOptions = {},
): StreamingJsonParseResult<T> {
	const fallbackValue = (options.fallbackValue ?? {}) as T;
	const input = options.trimInput === false ? partialJson : partialJson?.trim();
	if (!input) {
		return { value: fallbackValue, parsed: false, usedPartialParser: false };
	}

	try {
		return { value: JSON.parse(input) as T, parsed: true, usedPartialParser: false };
	} catch (jsonError) {
		if (options.allowPartial === false) {
			return {
				value: fallbackValue,
				parsed: false,
				usedPartialParser: false,
				error: jsonError instanceof Error ? jsonError.message : String(jsonError),
			};
		}
		try {
			const result = partialParse(input);
			return { value: (result ?? fallbackValue) as T, parsed: true, usedPartialParser: true };
		} catch (partialError) {
			return {
				value: fallbackValue,
				parsed: false,
				usedPartialParser: true,
				error: partialError instanceof Error ? partialError.message : String(partialError),
			};
		}
	}
}

/**
 * Attempts to parse potentially incomplete JSON during streaming.
 * Always returns a valid object, even if the JSON is incomplete.
 */
export function parseStreamingJson<T = any>(partialJson: string | undefined, options?: StreamingJsonParseOptions): T {
	return parseStreamingJsonWithDiagnostics<T>(partialJson, options).value;
}
