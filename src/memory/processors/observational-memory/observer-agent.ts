/**
 * Observer Agent - Prompts and Parsing
 * Based on Mastra ObserverAgent
 */

import type { CoreMessage, MessageContentV2 } from "../../types.js";

/**
 * Core extraction instructions for the Observer
 */
export const OBSERVER_EXTRACTION_INSTRUCTIONS = `CRITICAL: DISTINGUISH USER ASSERTIONS FROM QUESTIONS

When the user TELLS you something about themselves, mark it as an assertion:
- "I have two kids" → 🔴 (14:30) User stated has two kids
- "I work at Acme Corp" → 🔴 (14:31) User stated works at Acme Corp

When the user ASKS about something, mark it as a question/request:
- "Can you help me with X?" → 🔴 (15:00) User asked help with X
- "What's the best way to do Y?" → 🔴 (15:01) User asked best way to do Y

STATE CHANGES AND UPDATES:
When a user indicates they are changing something, frame it as a state change:
- "I'm going to start doing X instead of Y" → "User will start doing X (changing from Y)"
- "I'm switching from A to B" → "User is switching from A to B"

TEMPORAL ANCHORING:
Each observation has TWO potential timestamps:
1. BEGINNING: The time the statement was made - ALWAYS include this
2. END: The time being REFERENCED, if different - ONLY when there's a relative time reference

FORMAT:
- With time reference: (TIME) [observation]. (meaning/estimated DATE)
- Without time reference: (TIME) [observation].

CONVERSATION CONTEXT:
- What the user is working on or asking about
- Previous topics and their outcomes
- User preferences (likes, dislikes, etc.)
- Any specifically formatted text that needs to be reproduced later
- When who/what/where/when is mentioned, note all details

USER MESSAGE CAPTURE:
- Short and medium-length user messages should be captured nearly verbatim
- For very long user messages, summarize but quote key phrases

AVOIDING REPETITIVE OBSERVATIONS:
- Do NOT repeat the same observation across multiple turns
- Group repeated similar actions into a single parent observation`;

/**
 * Output format for Observer
 */
export const OBSERVER_OUTPUT_FORMAT_BASE = `Use priority levels:
- 🔴 High: explicit user facts, preferences, goals achieved, critical context
- 🟡 Medium: project details, learned information, tool results
- 🟢 Low: minor details, uncertain observations

Group related observations by indenting:
* 🔴 (14:33) Agent debugging auth issue
  * -> ran git status, found 3 modified files
  * -> viewed auth.ts, found missing null check

Group observations by date, then list each with 24-hour time.

<observations>
Date: Dec 4, 2025
* 🔴 (14:30) User prefers direct answers
* 🔴 (14:31) Working on feature X
* 🟡 (14:32) User might prefer dark mode

Date: Dec 5, 2025
* 🔴 (09:15) Continued work on feature X
</observations>

<current-task>
State the current task(s) explicitly.
</current-task>

<suggested-response>
Hint for the agent's immediate next message.
</suggested-response>`;

/**
 * Observer guidelines
 */
export const OBSERVER_GUIDELINES = `- Be specific enough for the assistant to act on
- Add 1 to 5 observations per exchange
- Use terse language to save tokens
- Do not add repetitive observations
- If the agent calls tools, observe what was called and what was learned
- Make sure you start each observation with a priority emoji (🔴, 🟡, 🟢)
- User messages are always 🔴 priority`;

/**
 * Result from Observer agent
 */
export interface ObserverResult {
  observations: string;
  currentTask?: string;
  suggestedContinuation?: string;
  rawOutput?: string;
  degenerate?: boolean;
}

/**
 * Build the Observer system prompt
 */
export function buildObserverSystemPrompt(multiThread: boolean = false, instruction?: string): string {
  const outputFormat = OBSERVER_OUTPUT_FORMAT_BASE;

  if (multiThread) {
    return `You are the memory consciousness of an AI assistant. Your observations will be the ONLY information the assistant has about past interactions with this user.

Extract observations that will help the assistant remember:

${OBSERVER_EXTRACTION_INSTRUCTIONS}

=== MULTI-THREAD INPUT ===

You will receive messages from MULTIPLE conversation threads, each wrapped in <thread id="..."> tags.
Process each thread separately and output observations for each thread.

=== OUTPUT FORMAT ===

<observations>
<thread id="thread_id_1">
Date: Dec 4, 2025
* 🔴 (14:30) User prefers direct answers

<current-task>
What the agent is currently working on
</current-task>

<suggested-response>
Hint for the agent's next message
</suggested-response>
</thread>
</observations>

Use priority levels: 🔴 High, 🟡 Medium, 🟢 Low

=== GUIDELINES ===

${OBSERVER_GUIDELINES}

Remember: These observations are the assistant's ONLY memory. Make them count.${instruction ? `\n\n=== CUSTOM INSTRUCTIONS ===\n\n${instruction}` : ""}`;
  }

  return `You are the memory consciousness of an AI assistant. Your observations will be the ONLY information the assistant has about past interactions with this user.

Extract observations that will help the assistant remember:

${OBSERVER_EXTRACTION_INSTRUCTIONS}

=== OUTPUT FORMAT ===

Your output MUST use XML tags to structure the response.

${outputFormat}

=== GUIDELINES ===

${OBSERVER_GUIDELINES}

Remember: These observations are the assistant's ONLY memory. Make them count.${instruction ? `\n\n=== CUSTOM INSTRUCTIONS ===\n\n${instruction}` : ""}`;
}

/**
 * Default Observer system prompt
 */
export const OBSERVER_SYSTEM_PROMPT = buildObserverSystemPrompt();

/**
 * Format messages for Observer input
 */
export function formatMessagesForObserver(messages: CoreMessage[], options?: { maxPartLength?: number }): string {
  const maxLen = options?.maxPartLength;

  return messages
    .map(msg => {
      const timestamp = msg.createdAt
        ? new Date(msg.createdAt).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        : "";

      const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
      const timestampStr = timestamp ? ` (${timestamp})` : "";

      let content = "";
      if (typeof msg.content === "string") {
        content = maybeTruncate(msg.content, maxLen);
      } else if (msg.content && typeof msg.content === "object") {
        const contentObj = msg.content as MessageContentV2;
        if (contentObj.parts && Array.isArray(contentObj.parts) && contentObj.parts.length > 0) {
          content = contentObj.parts
            .map(part => {
              if (part.type === "text") return maybeTruncate(part.text, maxLen);
              if (part.type === "tool-call") {
                return `[Tool Call: ${part.toolName}]\n${maybeTruncate(JSON.stringify(part.args, null, 2), maxLen)}`;
              }
              if (part.type === "tool-result") {
                return `[Tool Result: ${part.toolName}]\n${maybeTruncate(JSON.stringify(part.result, null, 2), maxLen)}`;
              }
              return "";
            })
            .filter(Boolean)
            .join("\n");
        } else if (contentObj.content) {
          content = maybeTruncate(contentObj.content, maxLen);
        }
      }

      return `**${role}${timestampStr}:**\n${content}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Truncate string if needed
 */
function maybeTruncate(str: string, maxLen?: number): string {
  if (!maxLen || str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}\n... [truncated ${str.length - maxLen} characters]`;
}

/**
 * Build the Observer prompt
 */
export function buildObserverPrompt(
  existingObservations: string | undefined,
  messagesToObserve: CoreMessage[],
  options?: { skipContinuationHints?: boolean },
): string {
  const formattedMessages = formatMessagesForObserver(messagesToObserve);

  let prompt = "";

  if (existingObservations) {
    prompt += `## Previous Observations\n\n${existingObservations}\n\n---\n\n`;
    prompt += "Do not repeat these existing observations. Your new observations will be appended.\n\n";
  }

  prompt += `## New Message History to Observe\n\n${formattedMessages}\n\n---\n\n`;

  prompt += `## Your Task\n\n`;
  prompt += `Extract new observations from the message history above. Do not repeat observations already in previous observations.`;

  if (options?.skipContinuationHints) {
    prompt += `\n\nIMPORTANT: Do NOT include <current-task> or <suggested-response> sections. Only output <observations>.`;
  }

  return prompt;
}

/**
 * Parse Observer output
 */
export function parseObserverOutput(output: string): ObserverResult {
  // Check for degenerate repetition
  if (detectDegenerateRepetition(output)) {
    return {
      observations: "",
      rawOutput: output,
      degenerate: true,
    };
  }

  const parsed = parseMemorySectionXml(output);
  const observations = sanitizeObservationLines(parsed.observations || "");

  return {
    observations,
    currentTask: parsed.currentTask || undefined,
    suggestedContinuation: parsed.suggestedResponse || undefined,
    rawOutput: output,
  };
}

/**
 * Parsed memory section
 */
interface ParsedMemorySection {
  observations: string;
  currentTask: string;
  suggestedResponse: string;
}

/**
 * Parse XML tags from observer/reflector output
 */
function parseMemorySectionXml(content: string): ParsedMemorySection {
  const result: ParsedMemorySection = {
    observations: "",
    currentTask: "",
    suggestedResponse: "",
  };

  // Extract <observations> content
  const observationsRegex = /^[ \t]*<observations>([\s\S]*?)^[ \t]*<\/observations>/gim;
  const observationsMatches = [...content.matchAll(observationsRegex)];
  if (observationsMatches.length > 0) {
    result.observations = observationsMatches
      .map(m => m[1]?.trim() ?? "")
      .filter(Boolean)
      .join("\n");
  } else {
    result.observations = extractListItemsOnly(content);
  }

  // Extract <current-task> content
  const currentTaskMatch = content.match(/^[ \t]*<current-task>([\s\S]*?)^[ \t]*<\/current-task>/im);
  if (currentTaskMatch?.[1]) {
    result.currentTask = currentTaskMatch[1].trim();
  }

  // Extract <suggested-response> content
  const suggestedResponseMatch = content.match(/^[ \t]*<suggested-response>([\s\S]*?)^[ \t]*<\/suggested-response>/im);
  if (suggestedResponseMatch?.[1]) {
    result.suggestedResponse = suggestedResponseMatch[1].trim();
  }

  return result;
}

/**
 * Extract only list items from content
 */
function extractListItemsOnly(content: string): string {
  const lines = content.split("\n");
  const listLines: string[] = [];

  for (const line of lines) {
    if (/^\s*[-*]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
      listLines.push(line);
    }
  }

  return listLines.join("\n").trim();
}

/**
 * Maximum length for a single observation line
 */
const MAX_OBSERVATION_LINE_CHARS = 10_000;

/**
 * Truncate observation lines that exceed max length
 */
export function sanitizeObservationLines(observations: string): string {
  if (!observations) return observations;
  const lines = observations.split("\n");
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.length > MAX_OBSERVATION_LINE_CHARS) {
      lines[i] = lines[i]!.slice(0, MAX_OBSERVATION_LINE_CHARS) + " … [truncated]";
      changed = true;
    }
  }
  return changed ? lines.join("\n") : observations;
}

/**
 * Detect degenerate repetition in output
 */
export function detectDegenerateRepetition(text: string): boolean {
  if (!text || text.length < 2000) return false;

  const windowSize = 200;
  const step = Math.max(1, Math.floor(text.length / 50));
  const seen = new Map<string, number>();
  let duplicateWindows = 0;
  let totalWindows = 0;

  for (let i = 0; i + windowSize <= text.length; i += step) {
    const window = text.slice(i, i + windowSize);
    totalWindows++;
    const count = (seen.get(window) ?? 0) + 1;
    seen.set(window, count);
    if (count > 1) duplicateWindows++;
  }

  if (totalWindows > 5 && duplicateWindows / totalWindows > 0.4) {
    return true;
  }

  // Check for extremely long lines
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.length > 50_000) return true;
  }

  return false;
}

/**
 * Optimize observations for token efficiency
 */
export function optimizeObservationsForContext(observations: string): string {
  let optimized = observations;

  // Remove 🟡 and 🟢 emojis (keep 🔴)
  optimized = optimized.replace(/🟡\s*/g, "");
  optimized = optimized.replace(/🟢\s*/g, "");

  // Remove semantic tags
  optimized = optimized.replace(/\[(?![\d\s]*items collapsed)[^\]]+\]/g, "");

  // Remove arrow indicators
  optimized = optimized.replace(/\s*->\s*/g, " ");

  // Clean up multiple spaces
  optimized = optimized.replace(/  +/g, " ");

  // Clean up multiple newlines
  optimized = optimized.replace(/\n{3,}/g, "\n\n");

  return optimized.trim();
}
