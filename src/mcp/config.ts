/**
 * MCP Configuration Loading
 *
 * Loads MCP server configurations from XDG-compliant paths:
 * - Project: ./.indusagi/mcp.json
 * - User: ~/.config/indusagi/mcp.json (XDG)
 * - Legacy: ~/.indusagi/agent/mcp.json
 *
 * Reference: @mastra/mcp configuration patterns
 */

import { existsSync, readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import type { MCPConnectionOptions, MCPServerConfig, MCPConfigFile } from "./types.js";
import { MCPError, MCPErrorCode } from "./errors.js";

/**
 * Load MCP configuration from all sources.
 *
 * If a specific file path is provided, loads from that file directly.
 * Otherwise merges configurations from:
 * 1. Project-level config: ./.indusagi/mcp.json
 * 2. User-level (XDG): ~/.config/indusagi/mcp.json
 * 3. Legacy: ~/.indusagi/agent/mcp.json or ~/.indusagi/agent/mcp-servers.json
 *
 * @param configPathOrCwd - Either a specific config file path, or a working directory
 * @returns Array of MCP connection options
 */
export function loadMCPConfig(configPathOrCwd: string = process.cwd()): MCPConnectionOptions[] {
  const configs: MCPConnectionOptions[] = [];

  // Check if the path is a specific config file (exists and is a file, not directory)
  if (existsSync(configPathOrCwd)) {
    try {
      const stats = require("fs").statSync(configPathOrCwd);
      if (stats.isFile()) {
        const fileConfigs = parseConfigFile(configPathOrCwd);
        configs.push(...fileConfigs);
        return configs;
      }
    } catch {
      // Not a valid file, continue with directory-based loading
    }
  }

  const cwd = configPathOrCwd;

  // 1. Project-level config: ./.indusagi/mcp.json
  const projectConfig = join(cwd, ".indusagi", "mcp.json");
  if (existsSync(projectConfig)) {
    try {
      const projectConfigs = parseConfigFile(projectConfig);
      configs.push(...projectConfigs);
      console.log(`[MCP] Loaded ${projectConfigs.length} servers from project config`);
    } catch (error) {
      console.error(`[MCP] Error loading project config:`, error);
    }
  }

  // 2. User-level config: ~/.config/indusagi/mcp.json (XDG)
  const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  const userConfig = join(xdgConfigHome, "indusagi", "mcp.json");
  if (existsSync(userConfig)) {
    try {
      const userConfigs = parseConfigFile(userConfig);
      configs.push(...userConfigs);
      console.log(`[MCP] Loaded ${userConfigs.length} servers from user config`);
    } catch (error) {
      console.error(`[MCP] Error loading user config:`, error);
    }
  }

  // 3. Legacy: ~/.indusagi/agent/mcp.json (for backwards compatibility)
  const legacyConfig = join(homedir(), ".indusagi", "agent", "mcp.json");
  if (existsSync(legacyConfig)) {
    try {
      const legacyConfigs = parseConfigFile(legacyConfig);
      configs.push(...legacyConfigs);
      console.log(`[MCP] Loaded ${legacyConfigs.length} servers from legacy config`);
    } catch (error) {
      console.error(`[MCP] Error loading legacy config:`, error);
    }
  }

  // 4. Also check mcp-servers.json (alternative legacy name)
  const legacyServersConfig = join(homedir(), ".indusagi", "agent", "mcp-servers.json");
  if (existsSync(legacyServersConfig)) {
    try {
      const legacyConfigs = parseConfigFile(legacyServersConfig);
      configs.push(...legacyConfigs);
      console.log(`[MCP] Loaded ${legacyConfigs.length} servers from mcp-servers.json`);
    } catch (error) {
      console.error(`[MCP] Error loading mcp-servers.json:`, error);
    }
  }

  return configs;
}

/**
 * Parse a configuration file.
 * Supports both array and object formats for servers:
 * - Array: { "servers": [{ "name": "github", "command": "npx", ... }] }
 * - Object: { "servers": { "github": { "command": "npx", ... } } }
 */
function parseConfigFile(path: string): MCPConnectionOptions[] {
  const content = readFileSync(path, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = JSON.parse(content);

  if (!config.servers) {
    console.warn(`[MCP] Invalid config file ${path}: missing "servers" field`);
    return [];
  }

  // Handle both array and object formats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let serversArray: any[];

  if (Array.isArray(config.servers)) {
    serversArray = config.servers;
  } else if (typeof config.servers === "object") {
    // Convert object format to array
    serversArray = Object.entries(config.servers).map(([name, serverConfig]) => ({
      name,
      ...(serverConfig as Record<string, unknown>),
    }));
  } else {
    console.warn(`[MCP] Invalid config file ${path}: "servers" must be array or object`);
    return [];
  }

  return serversArray
    .filter((server: any) => server.enabled !== false)
    .map((server: any) => {
      if (server.url) {
        // HTTP transport
        return {
          name: server.name,
          config: {
            url: new URL(server.url),
            headers: server.headers,
          } as MCPServerConfig,
          timeout: server.timeout,
        };
      } else if (server.command) {
        // Stdio transport
        return {
          name: server.name,
          config: {
            command: server.command,
            args: server.args,
            env: server.env,
          } as MCPServerConfig,
          timeout: server.timeout,
        };
      }
      throw new MCPError(
        `Invalid server config: ${server.name}`,
        MCPErrorCode.CONFIG_ERROR,
        { server }
      );
    });
}

/**
 * Get the path where user config should be saved.
 */
export function getUserConfigPath(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdgConfigHome, "indusagi", "mcp.json");
}

/**
 * Get the path where project config should be saved.
 */
export function getProjectConfigPath(cwd: string = process.cwd()): string {
  return join(cwd, ".indusagi", "mcp.json");
}

/**
 * Ensure the user config directory exists.
 */
export function ensureUserConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  const configDir = join(xdgConfigHome, "indusagi");
  
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  
  return configDir;
}

/**
 * Ensure the project config directory exists.
 */
export function ensureProjectConfigDir(cwd: string = process.cwd()): string {
  const configDir = join(cwd, ".indusagi");
  
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  
  return configDir;
}

/**
 * Save configuration to a file.
 */
export function saveConfig(path: string, config: MCPConfigFile): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  const content = JSON.stringify(config, null, 2);
  require("fs").writeFileSync(path, content, "utf-8");
}

/**
 * Save user configuration.
 */
export function saveUserConfig(config: MCPConfigFile): void {
  saveConfig(getUserConfigPath(), config);
}

/**
 * Save project configuration.
 */
export function saveProjectConfig(config: MCPConfigFile, cwd: string = process.cwd()): void {
  saveConfig(getProjectConfigPath(cwd), config);
}

/**
 * Create a default configuration.
 */
export function createDefaultConfig(): MCPConfigFile {
  return {
    servers: [],
  };
}

/**
 * Example configuration for documentation.
 */
export const EXAMPLE_CONFIG: MCPConfigFile = {
  servers: [
    {
      name: "filesystem",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"],
      enabled: true,
    },
    {
      name: "github",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_TOKEN: "your-github-token",
      },
      enabled: true,
    },
    {
      name: "remote-server",
      url: "http://localhost:8080/mcp",
      headers: {
        Authorization: "Bearer your-token",
      },
      enabled: false,
    },
  ],
};
