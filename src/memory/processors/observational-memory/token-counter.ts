/**
 * Token Counter Utility
 * Based on Mastra TokenCounter
 */

import type { CoreMessage, MessageContentV2 } from "../../types.js";

/**
 * Simple token counter using character-based estimation.
 * For production, integrate with js-tiktoken for accurate counting.
 */
export class TokenCounter {
  // Average characters per token (OpenAI's estimation)
  private static readonly CHARS_PER_TOKEN = 4;
  
  // Per-message overhead for role tokens, framing, separators
  private static readonly TOKENS_PER_MESSAGE = 3.8;
  
  // Conversation-level overhead
  private static readonly TOKENS_PER_CONVERSATION = 24;

  /**
   * Count tokens in a plain string
   */
  countString(text: string): number {
    if (!text) return 0;
    // Simple estimation: characters / 4
    // For production, use tiktoken for accurate counting
    return Math.ceil(text.length / TokenCounter.CHARS_PER_TOKEN);
  }

  /**
   * Count tokens in a single message
   */
  countMessage(message: CoreMessage): number {
    let tokenString = message.role;
    let overhead = TokenCounter.TOKENS_PER_MESSAGE;

    if (typeof message.content === "string") {
      tokenString += message.content;
    } else if (message.content && typeof message.content === "object") {
      const content = message.content as MessageContentV2;
      
      if (content.content && !Array.isArray(content.parts)) {
        tokenString += content.content;
      } else if (Array.isArray(content.parts)) {
        for (const part of content.parts) {
          if (part.type === "text") {
            tokenString += part.text;
          } else if (part.type === "tool-call") {
            tokenString += part.toolName;
            if (part.args) {
              tokenString += JSON.stringify(part.args);
              overhead -= 12; // Compensate for JSON overhead
            }
          } else if (part.type === "tool-result") {
            if (part.result !== undefined) {
              tokenString += typeof part.result === "string" 
                ? part.result 
                : JSON.stringify(part.result);
              overhead -= 12;
            }
          }
        }
      }
    }

    return Math.round(this.countString(tokenString) + overhead);
  }

  /**
   * Count tokens in an array of messages
   */
  countMessages(messages: CoreMessage[]): number {
    if (!messages || messages.length === 0) return 0;

    let total = TokenCounter.TOKENS_PER_CONVERSATION;
    for (const message of messages) {
      total += this.countMessage(message);
    }
    return total;
  }

  /**
   * Count tokens in observations string
   */
  countObservations(observations: string): number {
    return this.countString(observations);
  }
}

/**
 * Create a default token counter instance
 */
export function createTokenCounter(): TokenCounter {
  return new TokenCounter();
}
