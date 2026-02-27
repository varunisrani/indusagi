/**
 * Types Test Suite
 *
 * This test file verifies all type guards, validators, and constants
 * defined in the types module.
 */

import { describe, expect, it } from "vitest";
import {
	API_NAMES,
	PROVIDER_NAMES,
	STOP_REASONS,
	isTextContent,
	isThinkingContent,
	isImageContent,
	isToolCall,
	isUserMessage,
	isAssistantMessage,
	isToolResultMessage,
	isMessage,
	validateTool,
	validateMessage,
	validateContext,
} from "./types.js";

describe("ai/types - Constants", () => {
	it("exposes API_NAMES constant", () => {
		expect(API_NAMES).toBeDefined();
		expect(Array.isArray(API_NAMES)).toBe(true);
		expect(API_NAMES.length).toBeGreaterThan(0);
		expect(API_NAMES).toContain("openai-completions");
		expect(API_NAMES).toContain("anthropic-messages");
	});

	it("exposes PROVIDER_NAMES constant", () => {
		expect(PROVIDER_NAMES).toBeDefined();
		expect(Array.isArray(PROVIDER_NAMES)).toBe(true);
		expect(PROVIDER_NAMES.length).toBeGreaterThan(0);
		expect(PROVIDER_NAMES).toContain("openai");
		expect(PROVIDER_NAMES).toContain("anthropic");
	});

	it("exposes STOP_REASONS constant", () => {
		expect(STOP_REASONS).toBeDefined();
		expect(Array.isArray(STOP_REASONS)).toBe(true);
		expect(STOP_REASONS.length).toBe(5);
		expect(STOP_REASONS).toContain("stop");
		expect(STOP_REASONS).toContain("length");
		expect(STOP_REASONS).toContain("toolUse");
		expect(STOP_REASONS).toContain("error");
		expect(STOP_REASONS).toContain("aborted");
	});
});

describe("ai/types - Content Type Guards", () => {
	it("detects TextContent correctly", () => {
		const textContent = { type: "text" as const, text: "Hello, world!" };
		expect(isTextContent(textContent)).toBe(true);
		expect(isTextContent({ type: "text", text: "" })).toBe(true);
		expect(isTextContent({ type: "thinking", thinking: "test" })).toBe(false);
		expect(isTextContent(null)).toBe(false);
		expect(isTextContent(undefined)).toBe(false);
		expect(isTextContent("string")).toBe(false);
	});

	it("detects ThinkingContent correctly", () => {
		const thinkingContent = { type: "thinking" as const, thinking: "Let me think..." };
		expect(isThinkingContent(thinkingContent)).toBe(true);
		expect(isThinkingContent({ type: "thinking", thinking: "" })).toBe(true);
		expect(isThinkingContent({ type: "text", text: "test" })).toBe(false);
		expect(isThinkingContent(null)).toBe(false);
	});

	it("detects ImageContent correctly", () => {
		const imageContent = {
			type: "image" as const,
			data: "base64data",
			mimeType: "image/png",
		};
		expect(isImageContent(imageContent)).toBe(true);
		expect(isImageContent({
			type: "image",
			data: "data",
			mimeType: "image/jpeg",
		})).toBe(true);
		expect(isImageContent({ type: "text", text: "test" })).toBe(false);
		expect(isImageContent(null)).toBe(false);
	});

	it("detects ToolCall correctly", () => {
		const toolCall = {
			type: "toolCall" as const,
			id: "call_123",
			name: "bash",
			arguments: { command: "ls" },
		};
		expect(isToolCall(toolCall)).toBe(true);
		expect(isToolCall({
			type: "toolCall",
			id: "1",
			name: "read",
			arguments: {},
		})).toBe(true);
		// Missing fields should fail
		expect(isToolCall({
			type: "toolCall",
			id: "1",
		} as any)).toBe(false);
		expect(isToolCall(null)).toBe(false);
	});
});

describe("ai/types - Message Type Guards", () => {
	it("detects UserMessage correctly", () => {
		const userMessage = {
			role: "user" as const,
			content: "Hello!",
			timestamp: Date.now(),
		};
		expect(isUserMessage(userMessage)).toBe(true);
		expect(isUserMessage({
			role: "user",
			content: [{ type: "text", text: "Hi" }],
			timestamp: Date.now(),
		})).toBe(true);
		expect(isUserMessage({ role: "assistant", content: [], api: "x", provider: "y", model: "z", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: "stop", timestamp: Date.now() })).toBe(false);
		expect(isUserMessage(null)).toBe(false);
	});

	it("detects AssistantMessage correctly", () => {
		const assistantMessage = {
			role: "assistant" as const,
			content: [],
			api: "anthropic-messages" as const,
			provider: "anthropic",
			model: "claude-sonnet-4-20250514",
			usage: { input: 10, output: 20, cacheRead: 0, cacheWrite: 0, totalTokens: 30, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			stopReason: "stop" as const,
			timestamp: Date.now(),
		};
		expect(isAssistantMessage(assistantMessage)).toBe(true);
		expect(isUserMessage(assistantMessage)).toBe(false);
		expect(isAssistantMessage(null)).toBe(false);
	});

	it("detects ToolResultMessage correctly", () => {
		const toolResult = {
			role: "toolResult" as const,
			toolCallId: "call_123",
			toolName: "bash",
			content: [{ type: "text", text: "output" }],
			isError: false,
			timestamp: Date.now(),
		};
		expect(isToolResultMessage(toolResult)).toBe(true);
		expect(isToolResultMessage(null)).toBe(false);
	});

	it("isMessage detects all message types correctly", () => {
		const userMessage = {
			role: "user" as const,
			content: "Hello!",
			timestamp: Date.now(),
		};
		const assistantMessage = {
			role: "assistant" as const,
			content: [],
			api: "openai-completions" as const,
			provider: "openai",
			model: "gpt-4",
			usage: { input: 10, output: 20, cacheRead: 0, cacheWrite: 0, totalTokens: 30, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			stopReason: "stop" as const,
			timestamp: Date.now(),
		};
		const toolResult = {
			role: "toolResult" as const,
			toolCallId: "call_123",
			toolName: "bash",
			content: [],
			isError: false,
			timestamp: Date.now(),
		};

		expect(isMessage(userMessage)).toBe(true);
		expect(isMessage(assistantMessage)).toBe(true);
		expect(isMessage(toolResult)).toBe(true);
		expect(isMessage({ role: "invalid" as any })).toBe(false);
		expect(isMessage(null)).toBe(false);
	});
});

describe("ai/types - Validators", () => {
	describe("validateTool", () => {
		it("accepts valid tool definitions", () => {
			const validTool = {
				name: "bash",
				description: "Run bash commands",
				parameters: { type: "object", properties: {} },
			};
			expect(() => validateTool(validTool)).not.toThrow();
		});

		it("throws on null or undefined", () => {
			expect(() => validateTool(null)).toThrow("Invalid tool");
			expect(() => validateTool(undefined)).toThrow("Invalid tool");
		});

		it("throws on non-object", () => {
			expect(() => validateTool("string" as any)).toThrow("Invalid tool");
			expect(() => validateTool(123 as any)).toThrow("Invalid tool");
		});

		it("throws when name is missing or invalid", () => {
			expect(() => validateTool({
				description: "test",
				parameters: {},
			} as any)).toThrow("name is required");
			expect(() => validateTool({
				name: "",
				description: "test",
				parameters: {},
			})).toThrow("name is required");
		});

		it("throws when description is missing or invalid", () => {
			expect(() => validateTool({
				name: "tool",
				parameters: {},
			} as any)).toThrow("description is required");
			expect(() => validateTool({
				name: "tool",
				description: "",
				parameters: {},
			})).toThrow("description is required");
		});

		it("throws when parameters are missing", () => {
			expect(() => validateTool({
				name: "tool",
				description: "test",
			} as any)).toThrow("parameters schema is required");
		});
	});

	describe("validateMessage", () => {
		it("accepts valid user messages", () => {
			expect(() => validateMessage({
				role: "user",
				content: "Hello",
				timestamp: Date.now(),
			})).not.toThrow();
		});

		it("accepts valid assistant messages", () => {
			expect(() => validateMessage({
				role: "assistant",
				content: [],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-sonnet-4-20250514",
				usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
				stopReason: "stop",
				timestamp: Date.now(),
			})).not.toThrow();
		});

		it("accepts valid tool result messages", () => {
			expect(() => validateMessage({
				role: "toolResult",
				toolCallId: "call_123",
				toolName: "bash",
				content: [],
				isError: false,
				timestamp: Date.now(),
			})).not.toThrow();
		});

		it("throws on invalid messages", () => {
			expect(() => validateMessage({ role: "invalid" as any })).toThrow("Invalid message");
			expect(() => validateMessage(null)).toThrow("Invalid message");
		});
	});

	describe("validateContext", () => {
		it("accepts valid context with messages only", () => {
			expect(() => validateContext({
				messages: [{
					role: "user",
					content: "Hello",
					timestamp: Date.now(),
				}],
			})).not.toThrow();
		});

		it("accepts valid context with tools", () => {
			expect(() => validateContext({
				messages: [{
					role: "user",
					content: "Hello",
					timestamp: Date.now(),
				}],
				tools: [{
					name: "bash",
					description: "Run bash",
					parameters: { type: "object" },
				}],
			})).not.toThrow();
		});

		it("accepts valid context with system prompt", () => {
			expect(() => validateContext({
				systemPrompt: "You are a helpful assistant",
				messages: [{
					role: "user",
					content: "Hello",
					timestamp: Date.now(),
				}],
			})).not.toThrow();
		});

		it("throws on null or undefined", () => {
			expect(() => validateContext(null)).toThrow("Invalid context");
			expect(() => validateContext(undefined)).toThrow("Invalid context");
		});

		it("throws when messages is not an array", () => {
			expect(() => validateContext({
				messages: "not an array" as any,
			})).toThrow("messages must be an array");
		});

		it("throws when tools is not an array", () => {
			expect(() => validateContext({
				messages: [],
				tools: "not an array" as any,
			})).toThrow("tools must be an array");
		});

		it("throws when message in context is invalid", () => {
			expect(() => validateContext({
				messages: [{ role: "invalid" as any }],
			})).toThrow("Invalid message");
		});

		it("throws when tool in context is invalid", () => {
			expect(() => validateContext({
				messages: [],
				tools: [{ name: "invalid" as any }],
			})).toThrow("Invalid tool");
		});
	});
});

describe("ai/types - Integration Tests", () => {
	it("can validate complete workflow context", () => {
		const validContext = {
			systemPrompt: "You are Claude",
			messages: [
				{ role: "user" as const, content: "Hello!", timestamp: Date.now() },
				{
					role: "assistant" as const,
					content: [{ type: "text", text: "Hi there!" }],
					api: "anthropic-messages" as const,
					provider: "anthropic",
					model: "claude-sonnet-4-20250514",
					usage: { input: 5, output: 3, cacheRead: 0, cacheWrite: 0, totalTokens: 8, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
					stopReason: "stop",
					timestamp: Date.now(),
				},
			],
			tools: [
				{
					name: "bash",
					description: "Run commands",
					parameters: { type: "object", properties: {} },
				},
			],
		};

		expect(() => validateContext(validContext)).not.toThrow();
		expect(isMessage(validContext.messages[0])).toBe(true);
		expect(isMessage(validContext.messages[1])).toBe(true);
	});
});

describe("ai/types - Edge Cases", () => {
	it("handles empty content arrays", () => {
		const assistantMsg = {
			role: "assistant" as const,
			content: [],
			api: "openai-completions" as const,
			provider: "openai",
			model: "gpt-4",
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			stopReason: "stop",
			timestamp: Date.now(),
		};
		expect(isAssistantMessage(assistantMsg)).toBe(true);
	});

	it("handles complex content arrays", () => {
		const assistantMsg = {
			role: "assistant" as const,
			content: [
				{ type: "thinking" as const, thinking: "Let me think..." },
				{ type: "text" as const, text: "Here's the answer" },
				{
					type: "toolCall" as const,
					id: "call_123",
					name: "bash",
					arguments: { command: "ls" },
				},
			],
			api: "anthropic-messages" as const,
			provider: "anthropic",
			model: "claude-sonnet-4-20250514",
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			stopReason: "toolUse",
			timestamp: Date.now(),
		};
		expect(isAssistantMessage(assistantMsg)).toBe(true);
		expect(isThinkingContent(assistantMsg.content[0])).toBe(true);
		expect(isTextContent(assistantMsg.content[1])).toBe(true);
		expect(isToolCall(assistantMsg.content[2])).toBe(true);
	});

	it("handles all stop reason values", () => {
		const stopReasons: Array<"stop" | "length" | "toolUse" | "error" | "aborted"> = [
			"stop",
			"length",
			"toolUse",
			"error",
			"aborted",
		];
		stopReasons.forEach((reason) => {
			expect(STOP_REASONS).toContain(reason);
		});
	});
});
