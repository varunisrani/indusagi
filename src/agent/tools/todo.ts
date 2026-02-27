/**
 * Todo Tools - Read and write todo lists
 *
 * @module agent/tools/todo
 * @description
 * Provides tools for managing todo lists. The todos are stored in a TodoStore
 * which can optionally persist to external storage (e.g., session entries).
 *
 * ## Architecture
 *
 * Two tools are provided:
 * - `todoread`: Read the current todo list
 * - `todowrite`: Update the todo list
 *
 * Both tools share the same TodoStore instance for consistency.
 *
 * ## Usage
 *
 * ### Simple mode
 * ```typescript
 * import { todoReadTool, todoWriteTool } from "indusagi/agent";
 * // Uses default in-memory store
 * ```
 *
 * ### With custom store (persistent mode)
 * ```typescript
 * import { createTodoReadTool, createTodoWriteTool, TodoStore } from "indusagi/agent";
 *
 * const store = new TodoStore({
 *   persist: (todos) => sessionManager.appendCustomEntry('todo', { todos }),
 *   load: () => loadFromSession(),
 * });
 *
 * const todoReadTool = createTodoReadTool(store);
 * const todoWriteTool = createTodoWriteTool(store);
 * ```
 */

import type { AgentTool } from "../types.js";
import { StringEnum } from "../../ai/index.js";
import { Type } from "@sinclair/typebox";
import { TodoStore, TODO_PRIORITIES, TODO_STATUSES } from "./todo-store.js";
import type { TodoItem, TodoStatus, TodoToolDetails } from "./todo-types.js";

// Re-export types
export type { TodoItem, TodoStatus, TodoPriority, TodoStoreOptions, TodoToolDetails } from "./todo-types.js";
export { TodoStore, TODO_PRIORITIES, TODO_STATUSES } from "./todo-store.js";

const TodoItemSchema = Type.Object({
	content: Type.String({ description: "Brief description of the task" }),
	status: StringEnum(["pending", "in_progress", "completed", "cancelled"] as const),
	priority: StringEnum(["high", "medium", "low"] as const),
});

const TodoReadSchema = Type.Object({});
const TodoWriteSchema = Type.Object({
	todos: Type.Array(TodoItemSchema, { description: "The updated todo list" }),
	search: Type.Optional(Type.String({ description: "Optional query to filter todos after update" })),
	status: Type.Optional(
		StringEnum(["pending", "in_progress", "completed", "cancelled"] as const, {
			description: "Filter by status after update",
		}),
	),
});

/**
 * Format todos as JSON string
 */
function formatTodos(todos: TodoItem[]): string {
	return JSON.stringify(todos, null, 2);
}

/**
 * Count incomplete (non-completed) todos
 */
function countIncomplete(todos: TodoItem[]): number {
	return todos.filter((todo) => todo.status !== "completed").length;
}

/**
 * Create a todo read tool
 * @param store - The TodoStore to read from
 * @returns The todoread tool
 */
export function createTodoReadTool(
	store: TodoStore,
): AgentTool<typeof TodoReadSchema, TodoToolDetails> {
	return {
		name: "todoread",
		label: "todoread",
		description: "Read the current todo list. Returns items with content, status, and priority.",
		parameters: TodoReadSchema,
		execute: async () => {
			const todos = store.getTodos();
			return {
				content: [{ type: "text", text: formatTodos(todos) }],
				details: { todos, incompleteCount: countIncomplete(todos) },
			};
		},
	};
}

/**
 * Create a todo write tool
 * @param store - The TodoStore to write to
 * @returns The todowrite tool
 */
export function createTodoWriteTool(
	store: TodoStore,
): AgentTool<typeof TodoWriteSchema, TodoToolDetails> {
	return {
		name: "todowrite",
		label: "todowrite",
		description:
			"Update the todo list. Provide the full list each time with content, status, and priority fields.",
		parameters: TodoWriteSchema,
		execute: async (_toolCallId, { todos, search, status }) => {
			const typedTodos = todos as TodoItem[];
			store.setTodos(typedTodos);

			// Get todos and apply filters
			let selected = store.getTodos();
			if (typeof search === "string" && search.trim()) {
				selected = store.find(search.trim());
			}
			if (status) {
				selected = selected.filter((t) => t.status === status);
			}

			return {
				content: [{ type: "text", text: formatTodos(selected) }],
				details: { todos: selected, incompleteCount: countIncomplete(selected) },
			};
		},
	};
}

// Default store for simple mode
const defaultStore = new TodoStore();

/** Default todo read tool using in-memory store */
export const todoReadTool = createTodoReadTool(defaultStore);

/** Default todo write tool using in-memory store */
export const todoWriteTool = createTodoWriteTool(defaultStore);
