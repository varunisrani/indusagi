/**
 * Shell utilities for bash tool.
 * Simplified version for indusagi agent framework.
 */

import { existsSync } from "node:fs";
import { delimiter } from "node:path";
import { spawn, spawnSync } from "child_process";

let cachedShellConfig: { shell: string; args: string[] } | null = null;

export function resetShellConfigCache(): void {
	cachedShellConfig = null;
}

export function validateShellConfig(config: { shell: string; args: string[] }): void {
	if (!config.shell || config.shell.trim().length === 0) {
		throw new Error("Invalid shell config: shell path cannot be empty");
	}
}

/**
 * Find bash executable on PATH (Windows)
 */
function findBashOnPath(): string | null {
	try {
		const result = spawnSync("where", ["bash.exe"], { encoding: "utf-8", timeout: 5000 });
		if (result.status === 0 && result.stdout) {
			const firstMatch = result.stdout.trim().split(/\r?\n/)[0];
			if (firstMatch && existsSync(firstMatch)) {
				return firstMatch;
			}
		}
	} catch {
		// Ignore errors
	}
	return null;
}

/**
 * Get shell configuration based on platform.
 * Resolution order:
 * 1. On Windows: Git Bash in known locations, then bash on PATH
 * 2. On Unix: /bin/bash
 * 3. Fallback: sh
 */
export function getShellConfig(): { shell: string; args: string[] } {
	if (cachedShellConfig) {
		validateShellConfig(cachedShellConfig);
		return cachedShellConfig;
	}

	if (process.platform === "win32") {
		// Try Git Bash in known locations
		const paths: string[] = [];
		const programFiles = process.env.ProgramFiles;
		if (programFiles) {
			paths.push(`${programFiles}\\Git\\bin\\bash.exe`);
		}
		const programFilesX86 = process.env["ProgramFiles(x86)"];
		if (programFilesX86) {
			paths.push(`${programFilesX86}\\Git\\bin\\bash.exe`);
		}

		for (const path of paths) {
			if (existsSync(path)) {
				cachedShellConfig = { shell: path, args: ["-c"] };
				return cachedShellConfig;
			}
		}

		// Fallback: search bash.exe on PATH (Cygwin, MSYS2, WSL, etc.)
		const bashOnPath = findBashOnPath();
		if (bashOnPath) {
			cachedShellConfig = { shell: bashOnPath, args: ["-c"] };
			return cachedShellConfig;
		}

		throw new Error(
			`No bash shell found on Windows. Options:\n` +
				`  1. Install Git for Windows: https://git-scm.com/download/win\n` +
				`  2. Add your bash to PATH (Cygwin, MSYS2, etc.)\n\n` +
				`Searched Git Bash in:\n${paths.map((p) => `  ${p}`).join("\n")}`,
		);
	}

	// Unix: prefer bash over sh
	if (existsSync("/bin/bash")) {
		cachedShellConfig = { shell: "/bin/bash", args: ["-c"] };
		return cachedShellConfig;
	}

	cachedShellConfig = { shell: "sh", args: ["-c"] };
	return cachedShellConfig;
}

/**
 * Get shell environment.
 * Returns current environment with PATH unmodified.
 */
export function getShellEnv(): NodeJS.ProcessEnv {
	return { ...process.env };
}

/**
 * Sanitize binary output for display/storage.
 * Removes characters that crash string-width or cause display issues.
 */
export function sanitizeBinaryOutput(str: string): string {
	// Use Array.from to properly iterate over code points
	return Array.from(str)
		.filter((char) => {
			const code = char.codePointAt(0);

			// Skip if code point is undefined
			if (code === undefined) return false;

			// Allow tab, newline, carriage return
			if (code === 0x09 || code === 0x0a || code === 0x0d) return true;

			// Filter out control characters (0x00-0x1F, except 0x09, 0x0a, 0x0x0d)
			if (code <= 0x1f) return false;

			// Filter out Unicode format characters
			if (code >= 0xfff9 && code <= 0xfffb) return false;

			return true;
		})
		.join("");
}

/**
 * Kill a process and all its children (cross-platform)
 */
export function killProcessTree(pid: number): void {
	if (process.platform === "win32") {
		// Use taskkill on Windows to kill process tree
		try {
			spawn("taskkill", ["/F", "/T", "/PID", String(pid)], {
				stdio: "ignore",
				detached: true,
			});
		} catch {
			// Ignore errors if taskkill fails
		}
	} else {
		// Use SIGKILL on Unix/Linux/Mac
		try {
			process.kill(-pid, "SIGKILL");
		} catch {
			// Fallback to killing just the child if process group kill fails
			try {
				process.kill(pid, "SIGKILL");
			} catch {
				// Process already dead
			}
		}
	}
}
