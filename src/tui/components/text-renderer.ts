import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "../utils.js";

export class TextRenderer {
	padToWidth(line: string, width: number): string {
		const len = visibleWidth(line);
		if (len >= width) return line;
		return line + " ".repeat(width - len);
	}

	clipWithIndicator(line: string, width: number, indicator = "…"): string {
		if (width <= 0) return "";
		if (visibleWidth(line) <= width) return this.padToWidth(line, width);
		const indicatorWidth = visibleWidth(indicator);
		if (indicatorWidth >= width) return truncateToWidth(indicator, width);
		const clipped = truncateToWidth(line, width - indicatorWidth);
		return this.padToWidth(clipped + indicator, width);
	}

	wrap(text: string, width: number): string[] {
		return wrapTextWithAnsi(text, width);
	}
}

export const textRenderer = new TextRenderer();
