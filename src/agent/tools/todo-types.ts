/**
 * Todo Tool Types - Interfaces for extensible todo storage
 *
 * These interfaces allow the todo tool to be extended with custom persistence.
 * The coding-agent uses these to integrate with SessionManager for session persistence.
 */

/**
 * Todo item status
 */
export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

/**
 * Todo item priority
 */
export type TodoPriority = "high" | "medium" | "low";

/**
 * Todo item structure
 */
export interface TodoItem {
	content: string;
	status: TodoStatus;
	priority: TodoPriority;
	expiresAt?: number;
}

/**
 * Todo tool details - returned after todo operations
 */
export interface TodoToolDetails {
	todos: TodoItem[];
	incompleteCount: number;
}

/**
 * Options for TodoStore - allows custom persistence
 *
 * The coding-agent implements these to:
 * - persist: Save todos to session entries
 * - load: Load todos from session on startup
 * - rebuildFromBranch: Restore todos when navigating session tree
 */
export interface TodoStoreOptions {
	/**
	 * Persist todos to storage
	 * Called whenever todos are updated
	 */
	persist?: (todos: TodoItem[]) => void;

	/**
	 * Load todos from storage
	 * Called on TodoStore construction
	 */
	load?: () => TodoItem[];

	/**
	 * Rebuild todos from session branch
	 * Called when navigating the session tree
	 */
	rebuildFromBranch?: () => TodoItem[];

	/**
	 * Callback when todos change
	 * Useful for triggering UI updates
	 */
	onChange?: (todos: TodoItem[]) => void;
}

/**
 * Session manager interface for type safety
 * The coding-agent's SessionManager implements this
 */
export interface TodoSessionManager {
	appendCustomEntry(type: string, data: unknown): void;
	getBranch(): Array<{ type?: string; customType?: string; data?: unknown }>;
}
