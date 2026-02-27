import { ComponentBase } from "../tui.js";
import { applyBackgroundToLine, visibleWidth } from "../utils.js";
import { textRenderer } from "./text-renderer.js";

/**
 * Text component - displays multi-line text with word wrapping
 */
export class Text extends ComponentBase {
	private text: string;
	private paddingX: number;
	private paddingY: number;
	private customBgFn?: (text: string) => string;
	private cachedText?: string;

	constructor(text: string = "", paddingX: number = 1, paddingY: number = 1, customBgFn?: (text: string) => string) {
		super();
		this.text = text;
		this.paddingX = paddingX;
		this.paddingY = paddingY;
		this.customBgFn = customBgFn;
	}

	setText(text: string): void {
		this.text = text;
		this.cachedText = undefined;
		this.invalidate();
	}

	setCustomBgFn(customBgFn?: (text: string) => string): void {
		this.customBgFn = customBgFn;
		this.cachedText = undefined;
		this.invalidate();
	}

	override invalidate(): void {
		super.invalidate();
		this.cachedText = undefined;
	}

	render(width: number): string[] {
		if (this.cachedText !== this.text) {
			this.invalidate();
			this.cachedText = this.text;
		}

		return this.renderCached(width, () => {
			if (!this.text || this.text.trim() === "") return [];

			const normalizedText = this.text.replace(/\t/g, "   ");
			const contentWidth = Math.max(1, width - this.paddingX * 2);
			const wrappedLines = textRenderer.wrap(normalizedText, contentWidth);
			const leftMargin = " ".repeat(this.paddingX);
			const rightMargin = " ".repeat(this.paddingX);
			const contentLines: string[] = [];

			for (const line of wrappedLines) {
				const lineWithMargins = leftMargin + line + rightMargin;
				if (this.customBgFn) {
					contentLines.push(applyBackgroundToLine(lineWithMargins, width, this.customBgFn));
				} else {
					const visibleLen = visibleWidth(lineWithMargins);
					const paddingNeeded = Math.max(0, width - visibleLen);
					contentLines.push(lineWithMargins + " ".repeat(paddingNeeded));
				}
			}

			const emptyLine = " ".repeat(width);
			const padLine = this.customBgFn ? applyBackgroundToLine(emptyLine, width, this.customBgFn) : emptyLine;
			const topBottom = Array.from({ length: this.paddingY }, () => padLine);

			const result = [...topBottom, ...contentLines, ...topBottom];
			return result.length > 0 ? result : [""];
		});
	}
}
