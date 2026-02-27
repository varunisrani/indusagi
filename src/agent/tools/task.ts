/**
 * Task Tool - Launch subagents for autonomous task execution
 *
 * @module agent/tools/task
 * @description
 * The task tool allows the agent to delegate complex or multi-step work to subagents.
 * Subagents run autonomously and can use the full set of tools available to the main agent.
 *
 * ## Architecture
 *
 * The task tool supports two modes:
 * 1. **Simple mode** (default): Stores task info in memory, returns placeholder result
 * 2. **Executor mode**: Uses injected TaskExecutor for actual subagent execution
 *
 * The coding-agent uses executor mode by providing a TaskExecutor that:
 * - Creates real subagent sessions via TaskSessionManager
 * - Runs the agent with the given prompt
 * - Streams updates via onUpdate callback
 * - Returns detailed results including tool calls, duration, model info
 *
 * ## Usage
 *
 * ### Simple mode (no executor)
 * ```typescript
 * import { createTaskTool } from "indusagi/agent";
 * const taskTool = createTaskTool();
 * ```
 *
 * ### Executor mode (with custom execution)
 * ```typescript
 * import { createTaskTool, type TaskExecutor } from "indusagi/agent";
 *
 * const executor: TaskExecutor = {
 *   async runTask(params) {
 *     // Custom implementation
 *     return { output: "result", details: { ... } };
 *   }
 * };
 *
 * const taskTool = createTaskTool({ executor });
 * ```
 */

import type { AgentTool, AgentToolUpdateCallback } from "../types.js";
import { Type } from "@sinclair/typebox";
import type {
	TaskExecutor,
	TaskResult,
	TaskToolDetails,
	TaskUpdate,
	SubagentStore,
} from "./task-types.js";

export type { TaskExecutor, TaskResult, TaskToolDetails, TaskUpdate, SubagentStore } from "./task-types.js";

const taskSchema = Type.Object({
	description: Type.String({ description: "A short (3-5 words) description of the task" }),
	prompt: Type.String({ description: "The task for the subagent to perform" }),
	subagent_type: Type.String({ description: "The type of specialized subagent to use for this task" }),
	task_id: Type.Optional(
		Type.String({
			description:
				"Only set to resume a previous task. The task will continue the same subagent session as before.",
		}),
	),
	command: Type.Optional(Type.String({ description: "The command that triggered this task (optional)" })),
});

/**
 * Options for creating the task tool
 */
export interface TaskToolOptions {
	/** Working directory for task execution */
	cwd?: string;
	/** Custom task executor (coding-agent provides this for real execution) */
	executor?: TaskExecutor;
	/** Subagent store for dynamic subagent type discovery */
	subagentStore?: SubagentStore;
	/** Build custom description with available subagents */
	buildDescription?: (subagents: SubagentStore | undefined) => string;
}

// Simple in-memory task sessions for basic mode
const taskSessions = new Map<
	string,
	{ description: string; prompt: string; subagentType: string; status: string }
>();

/**
 * Build task description with available subagent types
 */
function buildDefaultDescription(subagentStore?: SubagentStore): string {
	const header = "Launch a subagent to handle complex or multi-step work autonomously.";
	const instructions =
		"\n\nAvailable subagent types:\n- general: General-purpose subagent for multi-step tasks and research.\n- explore: Subagent specialized in codebase exploration and search.\n\nWhen using this tool, provide a clear description, a detailed prompt, and the subagent_type. Use task_id to resume a previous task.";

	if (!subagentStore) {
		return `${header}${instructions}`;
	}

	const subagents = subagentStore
		.list()
		.filter((agent) => agent.mode !== "primary" && agent.hidden !== true)
		.map((agent) => `- ${agent.name}${agent.description ? `: ${agent.description}` : ""}`)
		.join("\n");

	return subagents
		? `${header}\n\nAvailable subagent types:\n${subagents}\n\nWhen using this tool, provide a clear description, a detailed prompt, and the subagent_type. Use task_id to resume a previous task.`
		: `${header}${instructions}`;
}

/**
 * Default simple executor for basic mode
 */
const defaultExecutor: TaskExecutor = {
	async runTask({ description, prompt, subagentType, taskId }) {
		const id = taskId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const existing = taskSessions.get(id);
		const session = {
			description: description || existing?.description || "",
			prompt: prompt || existing?.prompt || "",
			subagentType: subagentType || existing?.subagentType || "general",
			status: "completed",
		};
		taskSessions.set(id, session);

		const output = `Task(${id}): ${session.description}\n${session.prompt}\nStatus: ${session.status}`;
		return {
			output,
			details: {
				taskId: id,
				subagentType: session.subagentType,
				description: session.description,
				result: session.status,
				toolCalls: 0,
				durationMs: 0,
			},
		};
	},
};

/**
 * Create a task tool with optional custom executor
 *
 * @param options - Task tool options
 * @param options.cwd - Working directory
 * @param options.executor - Custom task executor for real execution
 * @param options.subagentStore - Subagent store for dynamic type discovery
 * @returns The task tool
 */
export function createTaskTool(
	options?: TaskToolOptions,
): AgentTool<typeof taskSchema, TaskToolDetails> {
	const executor = options?.executor ?? defaultExecutor;
	const subagentStore = options?.subagentStore;
	const descriptionBuilder = options?.buildDescription ?? buildDefaultDescription;

	return {
		name: "task",
		label: "task",
		description: descriptionBuilder(subagentStore),
		parameters: taskSchema,
		execute: async (
			_toolCallId: string,
			{ description, prompt, subagent_type, task_id }: {
				description: string;
				prompt: string;
				subagent_type: string;
				task_id?: string;
			},
			signal?: AbortSignal,
			onUpdate?: AgentToolUpdateCallback<TaskToolDetails>,
		) => {
			// Check if already aborted
			if (signal?.aborted) {
				throw new Error("Task aborted before execution");
			}

			// Track accumulated stats for streaming updates
			let accumulatedToolCalls = 0;
			let accumulatedDurationMs = 0;

			// Convert onUpdate callback to TaskUpdate callback
			const taskUpdateCallback = onUpdate
				? (update: TaskUpdate): void => {
						// Update accumulated stats if provided
						if (update.details) {
							accumulatedToolCalls = update.details.toolCalls ?? accumulatedToolCalls;
							accumulatedDurationMs = update.details.durationMs ?? accumulatedDurationMs;
						}

						if (update.type === "chunk" && update.content) {
							onUpdate({ 
								content: [{ type: "text", text: update.content }],
								details: {
									taskId: update.details?.taskId ?? task_id ?? "",
									subagentType: update.details?.subagentType ?? subagent_type,
									description: update.details?.description ?? description,
									result: update.details?.result ?? "",
									toolCalls: accumulatedToolCalls,
									durationMs: accumulatedDurationMs,
									model: update.details?.model,
								}
							});
						} else if (update.type === "complete" && update.details && update.details.taskId) {
							// Only call complete when we have all required fields
							onUpdate({ 
								content: [{ type: "text", text: "" }],
								details: {
									taskId: update.details.taskId,
									subagentType: update.details.subagentType ?? subagent_type,
									description: update.details.description ?? description,
									result: update.details.result ?? "",
									toolCalls: update.details.toolCalls ?? accumulatedToolCalls,
									durationMs: update.details.durationMs ?? accumulatedDurationMs,
									model: update.details.model,
								}
							});
						}
					}
				: undefined;

			// Execute the task
			const result = await executor.runTask({
				description,
				prompt,
				subagentType: subagent_type,
				taskId: task_id,
				signal,
				onUpdate: taskUpdateCallback,
			});

			return {
				content: [{ type: "text", text: result.output }],
				details: result.details,
			};
		},
	};
}

/** Default task tool without executor (simple mode) */
export const taskTool = createTaskTool();
