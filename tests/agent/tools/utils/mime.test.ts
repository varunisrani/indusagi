import { describe, expect, it } from "vitest";
import { detectSupportedImageMimeTypeFromFile } from "../../../../src/agent/tools/utils/mime.js";

describe("agent/tools/utils/mime", () => {
	it("returns null for missing file", async () => {
		await expect(detectSupportedImageMimeTypeFromFile("/definitely/missing.png")).rejects.toBeTruthy();
	});
});
