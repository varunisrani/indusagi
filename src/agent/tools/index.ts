// ============================================================================
// CORE TOOLS - Agent Tool Implementation for indusagi Agent Framework
// ============================================================================

import { createBashTool, bashTool } from "./bash.js";
import { createEditTool, editTool } from "./edit.js";
import { createFindTool, findTool } from "./find.js";
import { createGrepTool, grepTool } from "./grep.js";
import { createLsTool, lsTool } from "./ls.js";
import { createReadTool, readTool } from "./read.js";
import { createTaskTool, taskTool } from "./task.js";
import { TodoStore } from "./todo-store.js";
import { createTodoReadTool, createTodoWriteTool, todoReadTool, todoWriteTool } from "./todo.js";
import { createWebFetchTool, webFetchTool } from "./webfetch.js";
import { createWebSearchTool, webSearchTool } from "./websearch.js";
import { createWriteTool, writeTool } from "./write.js";
import { ToolRegistry, type ToolMetadata } from "./registry.js";

// Shared utilities
export {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateHead,
	truncateLine,
	truncateTail,
	type TruncationOptions,
	type TruncationResult,
} from "./truncate.js";
export { expandPath, resolveReadPath, resolveToCwd } from "./path-utils.js";

// Tool factories and types
export {
	createReadTool,
	readTool,
	type ReadOperations,
	type ReadToolOptions,
	type ReadToolDetails,
} from "./read.js";

export {
	createBashTool,
	bashTool,
	type BashOperations,
	type BashToolOptions,
	type BashToolDetails,
} from "./bash.js";

export {
	createEditTool,
	editTool,
	type EditOperations,
	type EditToolOptions,
	type EditToolDetails,
} from "./edit.js";

export {
	createWriteTool,
	writeTool,
	type WriteOperations,
	type WriteToolOptions,
} from "./write.js";

export {
	createGrepTool,
	grepTool,
	type GrepOperations,
	type GrepToolOptions,
	type GrepToolDetails,
} from "./grep.js";

export { createFindTool, findTool, type FindToolOptions, type FindToolDetails } from "./find.js";

export {
	createLsTool,
	lsTool,
	type LsOperations,
	type LsToolOptions,
	type LsToolDetails,
} from "./ls.js";

export {
	createTaskTool,
	taskTool,
	type TaskToolOptions,
	type TaskToolDetails,
} from "./task.js";

// Task tool extension types for custom executors
export type {
	TaskExecutor,
	TaskResult,
	TaskUpdate,
	SubagentDefinition,
	SubagentStore,
} from "./task-types.js";

export {
	createTodoReadTool,
	createTodoWriteTool,
	todoReadTool,
	todoWriteTool,
	type TodoToolDetails,
} from "./todo.js";

export {
	TodoStore,
	TODO_PRIORITIES,
	TODO_STATUSES,
	type TodoItem,
	type TodoPriority,
	type TodoStatus,
	type TodoStoreOptions,
} from "./todo-store.js";

export {
	createWebSearchTool,
	webSearchTool,
	type WebSearchToolOptions,
	type WebSearchToolDetails,
} from "./websearch.js";

export {
	createWebFetchTool,
	webFetchTool,
	type WebFetchToolOptions,
	type WebFetchToolDetails,
} from "./webfetch.js";

// Re-export tool-specific utilities
export { computeEditDiff, generateDiffString } from "./edit-diff.js";
export { ToolFactory, ToolRegistry, type ToolMetadata, type ToolCategory } from "./registry.js";

// ============================================================================
// TOOL REGISTRY + COLLECTIONS
// ============================================================================

export const TOOL_METADATA: Record<string, ToolMetadata> = {
	read: { name: "read", label: readTool.label, category: "filesystem" },
	bash: { name: "bash", label: bashTool.label, category: "core" },
	edit: { name: "edit", label: editTool.label, category: "filesystem" },
	write: { name: "write", label: writeTool.label, category: "filesystem" },
	grep: { name: "grep", label: grepTool.label, category: "search" },
	find: { name: "find", label: findTool.label, category: "search" },
	ls: { name: "ls", label: lsTool.label, category: "filesystem" },
	task: { name: "task", label: taskTool.label, category: "management" },
	todoread: { name: "todoread", label: todoReadTool.label, category: "management" },
	todowrite: { name: "todowrite", label: todoWriteTool.label, category: "management" },
	websearch: { name: "websearch", label: webSearchTool.label, category: "web" },
	webfetch: { name: "webfetch", label: webFetchTool.label, category: "web" },
};

export function createToolRegistry(cwd: string, options?: ToolsOptions): ToolRegistry {
	const todoStore = new TodoStore();
	const registry = new ToolRegistry();
	const taskOptions = options?.task ? { ...options.task, cwd } : undefined;
	registry.register(TOOL_METADATA.read, () => createReadTool(cwd, options?.read));
	registry.register(TOOL_METADATA.bash, () => createBashTool(cwd, { ...options?.bash }));
	registry.register(TOOL_METADATA.edit, () => createEditTool(cwd));
	registry.register(TOOL_METADATA.write, () => createWriteTool(cwd));
	registry.register(TOOL_METADATA.grep, () => createGrepTool(cwd, options?.grep));
	registry.register(TOOL_METADATA.find, () => createFindTool(cwd, options?.find));
	registry.register(TOOL_METADATA.ls, () => createLsTool(cwd, options?.ls));
	registry.register(TOOL_METADATA.task, () => createTaskTool(taskOptions));
	registry.register(TOOL_METADATA.todoread, () => createTodoReadTool(todoStore));
	registry.register(TOOL_METADATA.todowrite, () => createTodoWriteTool(todoStore));
	registry.register(TOOL_METADATA.websearch, () => createWebSearchTool(options?.websearch));
	registry.register(TOOL_METADATA.webfetch, () => createWebFetchTool(options?.webfetch));
	return registry;
}

// Default tools for full access mode (using process.cwd())
export const codingTools = [
	readTool,
	bashTool,
	editTool,
	writeTool,
	taskTool,
	todoReadTool,
	todoWriteTool,
	webSearchTool,
	webFetchTool,
];

// Read-only tools for exploration without modification (using process.cwd())
export const readOnlyTools = [
	readTool,
	grepTool,
	findTool,
	lsTool,
	todoReadTool,
	webSearchTool,
	webFetchTool,
];

// All available tools (using process.cwd())
export const allTools = {
	read: readTool,
	bash: bashTool,
	edit: editTool,
	write: writeTool,
	grep: grepTool,
	find: findTool,
	ls: lsTool,
	task: taskTool,
	todoread: todoReadTool,
	todowrite: todoWriteTool,
	websearch: webSearchTool,
	webfetch: webFetchTool,
} as const;

export type ToolName = keyof typeof allTools;

// ============================================================================
// FACTORY FUNCTIONS - Create all tools for a given working directory
// ============================================================================

export interface ToolsOptions {
	/** Options for the read tool */
	read?: import("./read.js").ReadToolOptions;
	/** Options for the bash tool */
	bash?: import("./bash.js").BashToolOptions;
	/** Task tool options */
	task?: import("./task.js").TaskToolOptions;
	/** Options for the grep tool */
	grep?: import("./grep.js").GrepToolOptions;
	/** Options for the find tool */
	find?: import("./find.js").FindToolOptions;
	/** Options for the ls tool */
	ls?: import("./ls.js").LsToolOptions;
	/** Options for the websearch tool */
	websearch?: import("./websearch.js").WebSearchToolOptions;
	/** Options for the webfetch tool */
	webfetch?: import("./webfetch.js").WebFetchToolOptions;
}

/**
 * Create coding tools configured for a specific working directory.
 */
export function createCodingTools(cwd: string, options?: ToolsOptions): typeof codingTools {
	const registry = createToolRegistry(cwd, options);
	return registry.createMany(["read", "bash", "edit", "write", "task", "todoread", "todowrite", "websearch", "webfetch"]) as typeof codingTools;
}

/**
 * Create read-only tools configured for a specific working directory.
 */
export function createReadOnlyTools(cwd: string, options?: ToolsOptions): typeof readOnlyTools {
	const registry = createToolRegistry(cwd, options);
	return registry.createMany(["read", "grep", "find", "ls", "todoread", "websearch", "webfetch"]) as typeof readOnlyTools;
}

/**
 * Create all tools configured for a specific working directory.
 */
export function createAllTools(
	cwd: string,
	options?: ToolsOptions,
): typeof allTools {
	const registry = createToolRegistry(cwd, options);
	return {
		read: registry.create("read") as typeof allTools.read,
		bash: registry.create("bash") as typeof allTools.bash,
		edit: registry.create("edit") as typeof allTools.edit,
		write: registry.create("write") as typeof allTools.write,
		grep: registry.create("grep") as typeof allTools.grep,
		find: registry.create("find") as typeof allTools.find,
		ls: registry.create("ls") as typeof allTools.ls,
		task: registry.create("task") as typeof allTools.task,
		todoread: registry.create("todoread") as typeof allTools.todoread,
		todowrite: registry.create("todowrite") as typeof allTools.todowrite,
		websearch: registry.create("websearch") as typeof allTools.websearch,
		webfetch: registry.create("webfetch") as typeof allTools.webfetch,
	};
}
