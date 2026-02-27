/**
 * Todo Store - Persistent todo list management
 *
 * @module agent/tools/todo-store
 * @description
 * Manages a todo list with optional persistence callbacks.
 * The coding-agent uses this to integrate with SessionManager for session persistence.
 *
 * ## Architecture
 *
 * The TodoStore supports two modes:
 * 1. **Simple mode** (default): Stores todos in memory only
 * 2. **Persistent mode**: Uses callbacks to persist/load todos
 *
 * ## Usage
 *
 * ### Simple mode
 * ```typescript
 * const store = new TodoStore();
 * store.setTodos([{ content: "Task", status: "pending", priority: "high" }]);
 * ```
 *
 * ### Persistent mode (coding-agent style)
 * ```typescript
 * const store = new TodoStore({
 *   persist: (todos) => sessionManager.appendCustomEntry('todo', { todos }),
 *   load: () => loadFromSession(),
 *   rebuildFromBranch: () => rebuildFromSession(),
 * });
 * ```
 */

import type { TodoItem, TodoStatus, TodoStoreOptions } from "./todo-types.js";

export type { TodoItem, TodoStatus, TodoPriority, TodoStoreOptions, TodoToolDetails } from "./todo-types.js";

const TODO_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;
const TODO_PRIORITIES = ["high", "medium", "low"] as const;

type TodoPriority = (typeof TODO_PRIORITIES)[number];

/**
 * Simple Todo Store for the todo tool.
 * Supports optional persistence callbacks for session integration.
 */
export class TodoStore {
	private todos: TodoItem[] = [];
	private options?: TodoStoreOptions;

	/**
	 * Create a new TodoStore
	 * @param initialTodos - Optional initial todos (takes precedence over load callback)
	 * @param options - Optional persistence callbacks
	 */
	constructor(initialTodos?: TodoItem[], options?: TodoStoreOptions);
	constructor(options?: TodoStoreOptions);
	constructor(initialTodosOrOptions?: TodoItem[] | TodoStoreOptions, options?: TodoStoreOptions) {
		// Handle overloaded constructor
		if (Array.isArray(initialTodosOrOptions)) {
			this.todos = cloneTodos(initialTodosOrOptions);
			this.options = options;
		} else {
			this.options = initialTodosOrOptions;
			// Load from persistence callback if available
			if (this.options?.load) {
				try {
					const loaded = this.options.load();
					if (Array.isArray(loaded)) {
						this.todos = cloneTodos(loaded);
					}
				} catch (error) {
					// Ignore load errors, start with empty
					this.todos = [];
				}
			}
		}

		// Remove expired todos
		this.removeExpired();
	}

	/**
	 * Get all todos (returns a copy)
	 */
	getTodos(): TodoItem[] {
		this.removeExpired();
		return cloneTodos(this.todos);
	}

	/**
	 * Set todos and persist
	 */
	setTodos(todos: TodoItem[]): void {
		this.todos = cloneTodos(todos);
		this.options?.persist?.(this.todos);
		this.options?.onChange?.(this.todos);
	}

	/**
	 * Find todos matching a query
	 */
	find(query: string): TodoItem[] {
		const lowerQuery = query.toLowerCase();
		return this.todos.filter((todo) => todo.content.toLowerCase().includes(lowerQuery));
	}

	/**
	 * Filter todos by status
	 */
	filterByStatus(status: TodoStatus): TodoItem[] {
		return this.todos.filter((todo) => todo.status === status);
	}

	/**
	 * Rebuild todos from session branch
	 * Called when navigating the session tree
	 */
	rebuildFromBranch(): void {
		if (this.options?.rebuildFromBranch) {
			try {
				const rebuilt = this.options.rebuildFromBranch();
				if (Array.isArray(rebuilt)) {
					this.todos = cloneTodos(rebuilt);
					this.options?.onChange?.(this.todos);
				}
			} catch (error) {
				// Ignore rebuild errors
			}
		}
	}

	/**
	 * Remove expired todos
	 */
	private removeExpired(): void {
		const now = Date.now();
		const before = this.todos.length;
		this.todos = this.todos.filter((todo) => {
			if (todo.expiresAt === undefined) return true;
			return todo.expiresAt > now;
		});
		// If any were removed, notify
		if (this.todos.length !== before) {
			this.options?.onChange?.(this.todos);
		}
	}
}

/**
 * Clone todos to prevent external mutation
 */
function cloneTodos(todos: TodoItem[]): TodoItem[] {
	return todos.map((todo) => ({ ...todo }));
}

// Export constants for external use
export { TODO_STATUSES, TODO_PRIORITIES };
