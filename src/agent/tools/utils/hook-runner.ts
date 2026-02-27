/**
 * HookRunner with simple lifecycle, priority ordering, and error isolation.
 */

export type HookHandler<TInput = unknown, TOutput = unknown> = {
	priority: number;
	handler: (input: TInput, output: TOutput) => Promise<TOutput> | TOutput;
};

export class HookRunner {
	private hooks = new Map<string, HookHandler<any, any>[]>();

	hasHandlers(name: string): boolean {
		return (this.hooks.get(name)?.length ?? 0) > 0;
	}

	register<Name extends string, TInput, TOutput>(
		name: Name,
		handler: (input: TInput, output: TOutput) => Promise<TOutput> | TOutput,
		priority = 0,
	): void {
		const list = this.hooks.get(name) ?? [];
		list.push({ priority, handler });
		list.sort((a, b) => b.priority - a.priority);
		this.hooks.set(name, list);
	}

	async trigger<Name extends string, TOutput>(name: Name, input: unknown, output: TOutput): Promise<TOutput> {
		const list = this.hooks.get(name) ?? [];
		let current = output;
		for (const hook of list) {
			try {
				current = await hook.handler(input, current);
			} catch {
				// isolate extension hook failures
			}
		}
		return current;
	}
}
