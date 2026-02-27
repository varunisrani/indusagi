import { type KeyId, matchesKey, normalizeKeyId } from "./keys.js";

/**
 * Editor actions that can be bound to keys.
 */
export type EditorAction =
	// Cursor movement
	| "cursorUp"
	| "cursorDown"
	| "cursorLeft"
	| "cursorRight"
	| "cursorWordLeft"
	| "cursorWordRight"
	| "cursorLineStart"
	| "cursorLineEnd"
	| "pageUp"
	| "pageDown"
	// Deletion
	| "deleteCharBackward"
	| "deleteCharForward"
	| "deleteWordBackward"
	| "deleteWordForward"
	| "deleteToLineStart"
	| "deleteToLineEnd"
	// Text input
	| "newLine"
	| "submit"
	| "tab"
	// Selection/autocomplete
	| "selectUp"
	| "selectDown"
	| "selectPageUp"
	| "selectPageDown"
	| "selectConfirm"
	| "selectCancel"
	// Clipboard
	| "copy"
	// Kill ring
	| "yank"
	| "yankPop"
	// Undo
	| "undo"
	// Tool output
	| "expandTools"
	// Session
	| "toggleSessionPath"
	| "toggleSessionSort"
	| "renameSession"
	| "deleteSession"
	| "deleteSessionNoninvasive";

// Re-export KeyId from keys.ts
export type { KeyId };

/**
 * Editor keybindings configuration.
 */
export type EditorKeybindingsConfig = {
	[K in EditorAction]?: KeyId | KeyId[];
};

export type KeybindingPreset = "default" | "vim";

export interface KeybindingConflict {
	key: string;
	actions: EditorAction[];
}

/**
 * Default editor keybindings.
 */
export const DEFAULT_EDITOR_KEYBINDINGS: Required<EditorKeybindingsConfig> = {
	// Cursor movement
	cursorUp: "up",
	cursorDown: "down",
	cursorLeft: "left",
	cursorRight: "right",
	cursorWordLeft: ["alt+left", "ctrl+left"],
	cursorWordRight: ["alt+right", "ctrl+right"],
	cursorLineStart: ["home", "ctrl+a"],
	cursorLineEnd: ["end", "ctrl+e"],
	pageUp: "pageUp",
	pageDown: "pageDown",
	// Deletion
	deleteCharBackward: "backspace",
	deleteCharForward: "delete",
	deleteWordBackward: ["ctrl+w", "alt+backspace"],
	deleteWordForward: ["alt+d", "alt+delete"],
	deleteToLineStart: "ctrl+u",
	deleteToLineEnd: "ctrl+k",
	// Text input
	newLine: "shift+enter",
	submit: "enter",
	tab: "tab",
	// Selection/autocomplete
	selectUp: "up",
	selectDown: "down",
	selectPageUp: "pageUp",
	selectPageDown: "pageDown",
	selectConfirm: "enter",
	selectCancel: ["escape", "ctrl+c"],
	// Clipboard
	copy: "ctrl+c",
	// Kill ring
	yank: "ctrl+y",
	yankPop: "alt+y",
	// Undo
	undo: "ctrl+-",
	// Tool output
	expandTools: "ctrl+o",
	// Session
	toggleSessionPath: "ctrl+p",
	toggleSessionSort: "ctrl+s",
	renameSession: "ctrl+r",
	deleteSession: "ctrl+d",
	deleteSessionNoninvasive: "ctrl+backspace",
};

export const VIM_EDITOR_KEYBINDINGS: Partial<Required<EditorKeybindingsConfig>> = {
	cursorUp: ["up", "k"],
	cursorDown: ["down", "j"],
	cursorLeft: ["left", "h"],
	cursorRight: ["right", "l"],
	deleteCharBackward: ["backspace", "x"],
};

/**
 * Manages keybindings for the editor.
 */
export class EditorKeybindingsManager {
	private actionToKeys: Map<EditorAction, KeyId[]>;
	private componentOverrides = new Map<string, EditorKeybindingsConfig>();
	private readonly registeredActions = new Set<EditorAction>();

	constructor(config: EditorKeybindingsConfig = {}, preset: KeybindingPreset = "default") {
		this.actionToKeys = new Map();
		this.buildMaps(config, preset);
	}

	private buildMaps(config: EditorKeybindingsConfig, preset: KeybindingPreset = "default"): void {
		this.actionToKeys.clear();
		this.registeredActions.clear();

		for (const [action, keys] of Object.entries(DEFAULT_EDITOR_KEYBINDINGS)) {
			const typedAction = action as EditorAction;
			const keyArray = Array.isArray(keys) ? keys : [keys];
			this.actionToKeys.set(typedAction, keyArray.map((k) => normalizeKeyId(k) as KeyId));
			this.registeredActions.add(typedAction);
		}

		if (preset === "vim") {
			for (const [action, keys] of Object.entries(VIM_EDITOR_KEYBINDINGS)) {
				if (!keys) continue;
				const typedAction = action as EditorAction;
				const keyArray = Array.isArray(keys) ? keys : [keys];
				this.actionToKeys.set(typedAction, keyArray.map((k) => normalizeKeyId(k) as KeyId));
				this.registeredActions.add(typedAction);
			}
		}

		for (const [action, keys] of Object.entries(config)) {
			if (keys === undefined) continue;
			const typedAction = action as EditorAction;
			const keyArray = Array.isArray(keys) ? keys : [keys];
			this.actionToKeys.set(typedAction, keyArray.map((k) => normalizeKeyId(k) as KeyId));
			this.registeredActions.add(typedAction);
		}
	}

	/**
	 * Check if input matches a specific action.
	 */
	matches(data: string, action: EditorAction, componentId?: string): boolean {
		const override = componentId ? this.componentOverrides.get(componentId)?.[action] : undefined;
		const keys = override
			? (Array.isArray(override) ? override : [override]).map((k) => normalizeKeyId(k) as KeyId)
			: this.actionToKeys.get(action);
		if (!keys) return false;
		for (const key of keys) {
			if (matchesKey(data, key)) return true;
		}
		return false;
	}

	/**
	 * Get keys bound to an action.
	 */
	getKeys(action: EditorAction): KeyId[] {
		return this.actionToKeys.get(action) ?? [];
	}

	registerAction(action: EditorAction, keys: KeyId | KeyId[]): void {
		const keyArray = (Array.isArray(keys) ? keys : [keys]).map((k) => normalizeKeyId(k) as KeyId);
		this.actionToKeys.set(action, keyArray);
		this.registeredActions.add(action);
	}

	getRegisteredActions(): EditorAction[] {
		return [...this.registeredActions];
	}

	/**
	 * Update configuration.
	 */
	setConfig(config: EditorKeybindingsConfig, preset: KeybindingPreset = "default"): void {
		this.buildMaps(config, preset);
	}

	setComponentOverride(componentId: string, config: EditorKeybindingsConfig): void {
		this.componentOverrides.set(componentId, config);
	}

	clearComponentOverride(componentId: string): void {
		this.componentOverrides.delete(componentId);
	}

	detectConflicts(): KeybindingConflict[] {
		const keyToActions = new Map<string, Set<EditorAction>>();
		for (const [action, keys] of this.actionToKeys.entries()) {
			for (const key of keys) {
				const normalized = normalizeKeyId(key);
				if (!keyToActions.has(normalized)) keyToActions.set(normalized, new Set());
				keyToActions.get(normalized)!.add(action);
			}
		}
		const conflicts: KeybindingConflict[] = [];
		for (const [key, actions] of keyToActions.entries()) {
			if (actions.size > 1) conflicts.push({ key, actions: [...actions] });
		}
		return conflicts;
	}
}

// Global instance
let globalEditorKeybindings: EditorKeybindingsManager | null = null;

export function getEditorKeybindings(): EditorKeybindingsManager {
	if (!globalEditorKeybindings) {
		globalEditorKeybindings = new EditorKeybindingsManager();
	}
	return globalEditorKeybindings;
}

export function setEditorKeybindings(manager: EditorKeybindingsManager): void {
	globalEditorKeybindings = manager;
}
