import { describe, expect, it } from "vitest";
import { resizeImage } from "../../../../src/agent/tools/utils/image-resize.js";

describe("agent/tools/utils/image-resize", () => {
	it("validates jpeg quality", async () => {
		await expect(resizeImage({ type: "image", data: "", mimeType: "image/png" }, { jpegQuality: 0 })).rejects.toBeTruthy();
	});
});
