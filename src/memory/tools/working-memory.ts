/**
 * Working Memory Tool
 * Based on Mastra updateWorkingMemoryTool
 */

import type { MemoryConfig, WorkingMemoryConfig } from "../types.js";
import type { MemoryStorage } from "../storage/base.js";

/**
 * Tool input schema for working memory update
 */
export interface UpdateWorkingMemoryInput {
  newMemory?: string;
  searchString?: string;
  updateReason?: "append-new-memory" | "clarify-existing-memory" | "replace-irrelevant-memory";
}

/**
 * Tool result for working memory update
 */
export interface UpdateWorkingMemoryResult {
  success: boolean;
  reason: string;
}

/**
 * Deep merge two objects
 */
export function deepMergeWorkingMemory(
  existing: Record<string, unknown> | null | undefined,
  update: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!existing) return update ?? {};
  if (!update) return existing;

  const result: Record<string, unknown> = { ...existing };

  for (const key of Object.keys(update)) {
    if (
      typeof update[key] === "object" &&
      update[key] !== null &&
      !Array.isArray(update[key]) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMergeWorkingMemory(
        result[key] as Record<string, unknown>,
        update[key] as Record<string, unknown>,
      );
    } else {
      result[key] = update[key];
    }
  }

  return result;
}

/**
 * Extract working memory tags from content
 */
export function extractWorkingMemoryTags(content: string): { start: number; end: number; content: string } | null {
  const startTag = "<working_memory>";
  const endTag = "</working_memory>";
  
  const start = content.indexOf(startTag);
  if (start === -1) return null;
  
  const end = content.indexOf(endTag, start);
  if (end === -1) return null;
  
  return {
    start: start + startTag.length,
    end,
    content: content.slice(start + startTag.length, end).trim(),
  };
}

/**
 * Remove working memory tags from content
 */
export function removeWorkingMemoryTags(content: string): string {
  const extracted = extractWorkingMemoryTags(content);
  if (!extracted) return content;
  
  return content.replace(/<working_memory>[\s\S]*?<\/working_memory>/g, "").trim();
}

/**
 * Create the update working memory tool
 */
export function createUpdateWorkingMemoryTool(config: {
  storage: MemoryStorage;
  getThreadId: () => string;
  getResourceId: () => string;
  memoryConfig?: MemoryConfig;
}) {
  const { storage, getThreadId, getResourceId, memoryConfig } = config;

  return {
    id: "update-working-memory",
    description: `Update the working memory with new information about the user. This tool allows you to persist important information across conversations.`,
    inputSchema: {
      type: "object",
      properties: {
        newMemory: {
          type: "string",
          description: "The new memory content to add or update",
        },
        searchString: {
          type: "string",
          description: "Search string to find and replace specific content",
        },
        updateReason: {
          type: "string",
          enum: ["append-new-memory", "clarify-existing-memory", "replace-irrelevant-memory"],
          description: "Reason for the update",
        },
      },
    },
    execute: async (input: UpdateWorkingMemoryInput): Promise<UpdateWorkingMemoryResult> => {
      const { newMemory, searchString, updateReason } = input;

      if (!newMemory) {
        return { success: false, reason: "No new memory content provided" };
      }

      const threadId = getThreadId();
      const resourceId = getResourceId();
      const workingMemoryConfig = memoryConfig?.workingMemory as WorkingMemoryConfig | undefined;
      const scope = workingMemoryConfig?.scope ?? "resource";

      try {
        // Get current working memory
        let currentMemory: string | undefined;

        if (scope === "thread") {
          const thread = await storage.getThreadById({ threadId });
          currentMemory = thread?.metadata?.workingMemory as string | undefined;
        } else {
          const resource = await storage.getResourceById({ resourceId });
          currentMemory = resource?.workingMemory;
        }

        // Update based on reason
        let updatedMemory: string;

        if (updateReason === "append-new-memory") {
          updatedMemory = currentMemory ? `${currentMemory}\n\n${newMemory}` : newMemory;
        } else if (updateReason === "replace-irrelevant-memory" && searchString && currentMemory) {
          updatedMemory = currentMemory.replace(searchString, newMemory);
        } else if (updateReason === "clarify-existing-memory" && currentMemory) {
          updatedMemory = `${currentMemory}\n\n[Clarification] ${newMemory}`;
        } else {
          updatedMemory = currentMemory ? `${currentMemory}\n\n${newMemory}` : newMemory;
        }

        // Save updated memory
        if (scope === "thread") {
          const thread = await storage.getThreadById({ threadId });
          if (thread) {
            await storage.updateThread({
              id: threadId,
              metadata: { ...thread.metadata, workingMemory: updatedMemory },
            });
          }
        } else {
          await storage.updateResource({
            resourceId,
            workingMemory: updatedMemory,
          });
        }

        return { success: true, reason: `Working memory updated (${updateReason ?? "append"})` };
      } catch (error) {
        return {
          success: false,
          reason: `Failed to update working memory: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  };
}

/**
 * Create the update working memory tool (VNext version)
 */
export function createUpdateWorkingMemoryToolVNext(config: {
  storage: MemoryStorage;
  getThreadId: () => string;
  getResourceId: () => string;
  memoryConfig?: MemoryConfig;
}) {
  const { storage, getThreadId, getResourceId, memoryConfig } = config;

  return {
    id: "update-working-memory",
    description: `Update the working memory with new information about the user.`,
    inputSchema: {
      type: "object",
      properties: {
        newMemory: {
          type: "string",
          description: "The new memory content to add",
        },
        searchString: {
          type: "string",
          description: "Optional search string to find and replace",
        },
        updateReason: {
          type: "string",
          enum: ["append-new-memory", "clarify-existing-memory", "replace-irrelevant-memory"],
          description: "Reason for the update",
        },
      },
    },
    execute: async (input: UpdateWorkingMemoryInput): Promise<UpdateWorkingMemoryResult> => {
      const { newMemory, searchString, updateReason = "append-new-memory" } = input;

      if (!newMemory && !searchString) {
        return { success: false, reason: "Either newMemory or searchString must be provided" };
      }

      const threadId = getThreadId();
      const resourceId = getResourceId();
      const workingMemoryConfig = memoryConfig?.workingMemory as WorkingMemoryConfig | undefined;
      const scope = workingMemoryConfig?.scope ?? "resource";

      try {
        // Get current working memory
        let currentMemory: string | undefined;

        if (scope === "thread") {
          const thread = await storage.getThreadById({ threadId });
          currentMemory = thread?.metadata?.workingMemory as string | undefined;
        } else {
          const resource = await storage.getResourceById({ resourceId });
          currentMemory = resource?.workingMemory;
        }

        let updatedMemory: string;

        if (searchString && currentMemory) {
          // Find and update
          if (currentMemory.includes(searchString)) {
            updatedMemory = newMemory
              ? currentMemory.replace(searchString, newMemory)
              : currentMemory.replace(searchString, "");
          } else if (newMemory) {
            updatedMemory = `${currentMemory}\n\n${newMemory}`;
          } else {
            return { success: false, reason: "Search string not found in memory" };
          }
        } else if (newMemory) {
          updatedMemory = currentMemory ? `${currentMemory}\n\n${newMemory}` : newMemory;
        } else {
          return { success: false, reason: "No operation to perform" };
        }

        // Save updated memory
        if (scope === "thread") {
          const thread = await storage.getThreadById({ threadId });
          if (thread) {
            await storage.updateThread({
              id: threadId,
              metadata: { ...thread.metadata, workingMemory: updatedMemory },
            });
          }
        } else {
          await storage.updateResource({
            resourceId,
            workingMemory: updatedMemory,
          });
        }

        return { success: true, reason: `Working memory updated (${updateReason})` };
      } catch (error) {
        return {
          success: false,
          reason: `Failed to update working memory: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  };
}
