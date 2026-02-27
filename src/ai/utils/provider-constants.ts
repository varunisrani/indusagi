/**
 * Shared constants for AI streaming providers.
 */

/** Default timeout for provider HTTP requests (milliseconds). */
export const DEFAULT_PROVIDER_TIMEOUT = 30_000;

/** Default maximum number of retry attempts. */
export const DEFAULT_MAX_RETRIES = 3;

/** Base delay for exponential backoff (milliseconds). */
export const DEFAULT_RETRY_DELAY_MS = 250;

/** Maximum tokens in text content before truncation warnings. */
export const DEFAULT_MAX_TEXT_TOKENS = 50_000;

/** Maximum size of thinking blocks before truncation (bytes). */
export const DEFAULT_MAX_THINKING_BYTES = 100_000;

/** Standard system prompt for tool-use scenarios. */
export const DEFAULT_TOOL_SYSTEM_PROMPT = "You are a helpful assistant with access to tools.";

/** Anthropic-specific defaults. */
export const ANTHROPIC_DEFAULT_MAX_TOKENS = 4096;
export const ANTHROPIC_DEFAULT_THINKING_BUDGET = 10_000;

/** OpenAI-specific defaults. */
export const OPENAI_DEFAULT_MAX_TOKENS = 4_096;
export const OPENAI_DEFAULT_TEMPERATURE = 0.7;

/** Google-specific defaults. */
export const GOOGLE_DEFAULT_MAX_TOKENS = 8_192;
export const GOOGLE_DEFAULT_TEMPERATURE = 0.8;

/** Bedrock-specific defaults. */
export const BEDROCK_DEFAULT_MAX_TOKENS = 4_096;
export const BEDROCK_DEFAULT_TEMPERATURE = 0.7;

/** Tool-related defaults. */
export const DEFAULT_TOOL_CALL_TIMEOUT = 60_000;
export const DEFAULT_MAX_TOOLS_PER_REQUEST = 128;

/** Streaming batch sizes. */
export const STREAMING_BATCH_SIZE_TEXT = 100;
export const STREAMING_BATCH_SIZE_THINKING = 50;
export const STREAMING_BATCH_SIZE_TOOL_CALL = 20;
