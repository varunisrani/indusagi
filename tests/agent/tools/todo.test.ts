import { describe, expect, it } from "vitest";
import { TodoStore } from "../../../src/agent/tools/todo-store.js";

describe("agent/tools/todo", () => {
	it("stores todos", () => {
		const s = new TodoStore();
		s.setTodos([{ content: "x", priority: "high", status: "pending" }]);
		expect(s.getTodos().length).toBe(1);
	});
});
