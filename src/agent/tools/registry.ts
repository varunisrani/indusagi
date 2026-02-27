import type { AgentTool } from "../types.js";

export type ToolCategory = "core" | "search" | "management" | "web" | "filesystem";

export interface ToolMetadata {
	name: string;
	label: string;
	category: ToolCategory;
	description?: string;
}

export abstract class ToolFactory<TTool extends AgentTool<any> = AgentTool<any>> {
	abstract readonly metadata: ToolMetadata;
	abstract create(): TTool;
}

export class ToolRegistry {
	private readonly metadata = new Map<string, ToolMetadata>();
	private readonly factories = new Map<string, () => AgentTool<any>>();

	register<TTool extends AgentTool<any>>(meta: ToolMetadata, create: () => TTool): void {
		this.metadata.set(meta.name, meta);
		this.factories.set(meta.name, create);
	}

	create(name: string): AgentTool<any> {
		const factory = this.factories.get(name);
		if (!factory) throw new Error(`Tool not registered: ${name}`);
		return factory();
	}

	createMany(names: string[]): AgentTool<any>[] {
		return names.map((name) => this.create(name));
	}

	listMetadata(): ToolMetadata[] {
		return [...this.metadata.values()];
	}
}
