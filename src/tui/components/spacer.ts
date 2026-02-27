import { ComponentBase } from "../tui.js";

/**
 * Spacer component that renders empty lines
 */
export class Spacer extends ComponentBase {
	private lines: number;

	constructor(lines: number = 1) {
		super();
		this.lines = lines;
	}

	setLines(lines: number): void {
		this.lines = lines;
		this.invalidate();
	}

	override invalidate(): void {
		super.invalidate();
	}

	render(width: number): string[] {
		return this.renderCached(width, () => {
			const result: string[] = [];
			for (let i = 0; i < this.lines; i++) {
				result.push("");
			}
			return result;
		});
	}
}
