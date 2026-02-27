import type { ApiProvider } from "../../../src/ai/api-registry.js";
import type { Api, AssistantMessageEvent, Context, Model, SimpleStreamOptions, StreamOptions } from "../../../src/ai/types.js";
import { AssistantMessageEventStream } from "../../../src/ai/utils/event-stream.js";

export function createMockProvider<TApi extends Api>(api: TApi): ApiProvider<TApi, StreamOptions> {
  const run = (model: Model<TApi>, _context: Context, _options?: StreamOptions | SimpleStreamOptions) => {
    const stream = new AssistantMessageEventStream();
    queueMicrotask(() => {
      const partial = {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "mock-response" }],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "stop" as const,
        timestamp: Date.now(),
      };

      stream.push({ type: "start", partial } as AssistantMessageEvent);
      stream.push({ type: "done", reason: "stop", message: partial } as AssistantMessageEvent);
      stream.end(partial);
    });
    return stream;
  };

  return {
    api,
    stream: run,
    streamSimple: run,
  };
}
