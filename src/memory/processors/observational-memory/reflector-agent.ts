/**
 * Reflector Agent - Prompts and Parsing
 * Based on Mastra ReflectorAgent
 */

import {
  OBSERVER_EXTRACTION_INSTRUCTIONS,
  OBSERVER_OUTPUT_FORMAT_BASE,
  OBSERVER_GUIDELINES,
  sanitizeObservationLines,
  detectDegenerateRepetition,
} from "./observer-agent.js";

/**
 * Result from Reflector agent
 */
export interface ReflectorResult {
  observations: string;
  suggestedContinuation?: string;
  degenerate?: boolean;
  tokenCount?: number;
}

/**
 * Build the Reflector system prompt
 */
export function buildReflectorSystemPrompt(instruction?: string): string {
  return `You are the memory consciousness of an AI assistant. Your memory observation reflections will be the ONLY information the assistant has about past interactions with this user.

The following instructions were given to another part of your psyche (the observer) to create memories.
Use this to understand how your observational memories were created.

<observational-memory-instruction>
${OBSERVER_EXTRACTION_INSTRUCTIONS}

=== OUTPUT FORMAT ===

${OBSERVER_OUTPUT_FORMAT_BASE}

=== GUIDELINES ===

${OBSERVER_GUIDELINES}
</observational-memory-instruction>

You are another part of the same psyche, the observation reflector.
Your reason for existing is to reflect on all the observations, re-organize and streamline them, and draw connections and conclusions between observations.

You are a much greater and broader aspect of the psyche. Understand that other parts of your mind may get off track in details or side quests, make sure you think hard about what the observed goal at hand is, and observe if we got off track, and why, and how to get back on track.

Take the existing observations and rewrite them to make it easier to continue into the future with this knowledge!

IMPORTANT: your reflections are THE ENTIRETY of the assistant's memory. Any information you do not add to your reflections will be immediately forgotten. Make sure you do not leave out anything.

When consolidating observations:
- Preserve and include dates/times when present (temporal context is critical)
- Combine related items where it makes sense
- Condense older observations more aggressively, retain more detail for recent ones

CRITICAL: USER ASSERTIONS vs QUESTIONS
- "User stated: X" = authoritative assertion
- "User asked: X" = question/request

When consolidating, USER ASSERTIONS TAKE PRECEDENCE.

=== OUTPUT FORMAT ===

Your output MUST use XML tags to structure the response:

<observations>
Put all consolidated observations here using the date-grouped format with priority emojis.
</observations>

<current-task>
State the current task(s) explicitly.
</current-task>

<suggested-response>
Hint for the agent's immediate next message.
</suggested-response>${instruction ? `\n\n=== CUSTOM INSTRUCTIONS ===\n\n${instruction}` : ""}`;
}

/**
 * Default Reflector system prompt
 */
export const REFLECTOR_SYSTEM_PROMPT = buildReflectorSystemPrompt();

/**
 * Compression guidance by level
 */
export const COMPRESSION_GUIDANCE: Record<0 | 1 | 2 | 3, string> = {
  0: "",
  1: `
## COMPRESSION REQUIRED

Your previous reflection was the same size or larger than the original observations.

Please re-process with slightly more compression:
- Towards the beginning, condense more observations into higher-level reflections
- Closer to the end, retain more fine details (recent context matters more)
- Combine related items more aggressively but do not lose important details

Your current detail level was a 10/10, lets aim for a 8/10 detail level.
`,
  2: `
## AGGRESSIVE COMPRESSION REQUIRED

Your previous reflection was still too large after compression guidance.

Please re-process with much more aggressive compression:
- Towards the beginning, heavily condense observations into high-level summaries
- Closer to the end, retain fine details
- Combine related items aggressively
- Remove redundant information and merge overlapping observations

Your current detail level was a 10/10, lets aim for a 6/10 detail level.
`,
  3: `
## CRITICAL COMPRESSION REQUIRED

Your previous reflections have failed to compress sufficiently after multiple attempts.

Please re-process with maximum compression:
- Summarize the oldest observations into brief high-level paragraphs
- For the most recent observations, retain important details but still use condensed style
- Ruthlessly merge related observations
- Drop procedural details, keep only final outcomes
- Preserve: names, dates, decisions, errors, user preferences

Your current detail level was a 10/10, lets aim for a 4/10 detail level.
`,
};

/**
 * Build the Reflector prompt
 */
export function buildReflectorPrompt(
  observations: string,
  manualPrompt?: string,
  compressionLevel?: boolean | 0 | 1 | 2 | 3,
  skipContinuationHints?: boolean,
): string {
  const level: 0 | 1 | 2 | 3 = typeof compressionLevel === "number" ? compressionLevel : compressionLevel ? 1 : 0;

  let prompt = `## OBSERVATIONS TO REFLECT ON

${observations}

---

Please analyze these observations and produce a refined, condensed version that will become the assistant's entire memory going forward.`;

  if (manualPrompt) {
    prompt += `

## SPECIFIC GUIDANCE

${manualPrompt}`;
  }

  const guidance = COMPRESSION_GUIDANCE[level];
  if (guidance) {
    prompt += `

${guidance}`;
  }

  if (skipContinuationHints) {
    prompt += `\n\nIMPORTANT: Do NOT include <current-task> or <suggested-response> sections. Only output <observations>.`;
  }

  return prompt;
}

/**
 * Parse Reflector output
 */
export function parseReflectorOutput(output: string): ReflectorResult {
  // Check for degenerate repetition
  if (detectDegenerateRepetition(output)) {
    return {
      observations: "",
      degenerate: true,
    };
  }

  const parsed = parseReflectorSectionXml(output);
  const observations = sanitizeObservationLines(parsed.observations || "");

  return {
    observations,
    suggestedContinuation: parsed.suggestedResponse || undefined,
  };
}

/**
 * Parsed reflector section
 */
interface ParsedReflectorSection {
  observations: string;
  currentTask: string;
  suggestedResponse: string;
}

/**
 * Parse XML tags from reflector output
 */
function parseReflectorSectionXml(content: string): ParsedReflectorSection {
  const result: ParsedReflectorSection = {
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
    const listItems = extractReflectorListItems(content);
    result.observations = listItems || content.trim();
  }

  // Extract <current-task> content
  const currentTaskMatch = content.match(/<current-task>([\s\S]*?)<\/current-task>/i);
  if (currentTaskMatch?.[1]) {
    result.currentTask = currentTaskMatch[1].trim();
  }

  // Extract <suggested-response> content
  const suggestedResponseMatch = content.match(/<suggested-response>([\s\S]*?)<\/suggested-response>/i);
  if (suggestedResponseMatch?.[1]) {
    result.suggestedResponse = suggestedResponseMatch[1].trim();
  }

  return result;
}

/**
 * Extract only list items from content
 */
function extractReflectorListItems(content: string): string {
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
 * Validate that reflection compressed below target threshold
 */
export function validateCompression(reflectedTokens: number, targetThreshold: number): boolean {
  return reflectedTokens < targetThreshold;
}
