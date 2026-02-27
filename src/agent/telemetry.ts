export class AgentTelemetry {
	private readonly timings = new Map<string, number>();

	start(key: string): void {
		this.timings.set(key, Date.now());
	}

	end(key: string): number {
		const start = this.timings.get(key);
		const duration = start ? Date.now() - start : 0;
		this.timings.delete(key);
		return duration;
	}

	log(key: string, duration: number): void {
		if (process.env.INDUSAGI_AGENT_TELEMETRY === "1") {
			console.debug(`[agent-telemetry] ${key}: ${duration}ms`);
		}
	}
}
