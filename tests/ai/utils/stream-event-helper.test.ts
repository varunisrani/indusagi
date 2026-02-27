import { describe, expect, it } from "vitest";
import type { AssistantMessage } from "../../../src/ai/types.js";
import { AssistantMessageEventStream } from "../../../src/ai/utils/event-stream.js";
import { StreamEventHelper } from "../../../src/ai/utils/stream-event-helper.js";

function createOutput(): AssistantMessage {
	return {
		role: "assistant",
		content: [],
		api: "openai-completions",
		provider: "openai",
		model: "test-model",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

describe("StreamEventHelper", () => {
	it("pushes start event", async () => {
		const stream = new AssistantMessageEventStream();
		const output = createOutput();
		const helper = new StreamEventHelper(stream, output);

		helper.start();
		stream.pushDone("stop", output);

		const events: string[] = [];
		for await (const event of stream) {
			events.push(event.type);
		}

		expect(events).toEqual(["start", "done"]);
	});
});
