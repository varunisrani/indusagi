import { describe, expect, it } from "vitest";
import { CombinedAutocompleteProvider } from "../../src/tui/autocomplete.js";

describe("tui/autocomplete", () => {
	it("suggests slash command", () => {
		const provider = new CombinedAutocompleteProvider([{ name: "help", description: "show help" }]);
		const s = provider.getSuggestions(["/he"], 0, 3);
		expect(s?.items[0]?.value).toBe("help");
	});
});
