export interface AgentErrorContext {
	phase: "llm_stream" | "tool_execution" | "steering" | "unknown";
	toolName?: string;
}

export class AgentErrorHandler {
	handle(error: unknown, context: AgentErrorContext): Error {
		const base = error instanceof Error ? error : new Error(String(error));
		const prefix = `[agent:${context.phase}${context.toolName ? `:${context.toolName}` : ""}]`;
		return new Error(`${prefix} ${base.message}`);
	}
}
