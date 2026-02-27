/**
 * Task Tool Types - Interfaces for extensible task execution
 *
 * These interfaces allow the task tool to be extended with custom executors.
 * The coding-agent uses these to inject TaskSessionManager for actual subagent execution.
 */

/**
 * Task update callback - for streaming progress updates
 */
export interface TaskUpdate {
	type: "chunk" | "complete" | "error";
	content?: string;
	details?: Partial<TaskToolDetails>;
}

/**
 * Task execution result
 */
export interface TaskResult {
	output: string;
	details: TaskToolDetails;
}

/**
 * Task tool details - returned after task execution
 */
export interface TaskToolDetails {
	taskId: string;
	subagentType: string;
	description: string;
	result: string;
	toolCalls: number;
	durationMs: number;
	model?: { provider: string; id: string };
}

/**
 * Task executor interface - implement this to provide custom task execution
 *
 * The coding-agent implements this with TaskSessionManager that:
 * - Creates actual subagent sessions
 * - Runs the agent with the given prompt
 * - Streams updates via onUpdate callback
 * - Returns the final result
 */
export interface TaskExecutor {
	/**
	 * Execute a task with the given parameters
	 */
	runTask(params: {
		description: string;
		prompt: string;
		subagentType: string;
		taskId?: string;
		signal?: AbortSignal;
		onUpdate?: (update: TaskUpdate) => void;
	}): Promise<TaskResult>;
}

/**
 * Subagent definition - for describing available subagent types
 */
export interface SubagentDefinition {
	name: string;
	description?: string;
	mode?: string;
	hidden?: boolean;
}

/**
 * Subagent store interface - for getting available subagents
 */
export interface SubagentStore {
	list(): SubagentDefinition[];
}
