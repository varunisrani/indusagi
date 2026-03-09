/**
 * Serialization utilities for span data
 * 
 * Handles cleaning and truncating large payloads for export
 */

import type { SerializationOptions } from './types.js';

/**
 * Default serialization options
 */
const DEFAULT_OPTIONS: Required<SerializationOptions> = {
  maxStringLength: 10000,
  maxDepth: 10,
  maxArrayLength: 100,
  maxObjectKeys: 100,
};

/**
 * Merge serialization options with defaults
 */
export function mergeSerializationOptions(
  options?: SerializationOptions
): Required<SerializationOptions> {
  if (!options) return { ...DEFAULT_OPTIONS };
  return {
    maxStringLength: options.maxStringLength ?? DEFAULT_OPTIONS.maxStringLength,
    maxDepth: options.maxDepth ?? DEFAULT_OPTIONS.maxDepth,
    maxArrayLength: options.maxArrayLength ?? DEFAULT_OPTIONS.maxArrayLength,
    maxObjectKeys: options.maxObjectKeys ?? DEFAULT_OPTIONS.maxObjectKeys,
  };
}

/**
 * Deep clean a value by applying serialization options
 */
export function deepClean<T>(
  value: T,
  options: Required<SerializationOptions>,
  depth = 0
): T | undefined {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Check depth limit
  if (depth > options.maxDepth) {
    return '[MAX_DEPTH_EXCEEDED]' as T;
  }

  // Handle strings
  if (typeof value === 'string') {
    if (value.length > options.maxStringLength) {
      return value.slice(0, options.maxStringLength) + '...[TRUNCATED]' as T;
    }
    return value;
  }

  // Handle numbers, booleans, etc.
  if (typeof value !== 'object') {
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length > options.maxArrayLength) {
      return value
        .slice(0, options.maxArrayLength)
        .map(item => deepClean(item, options, depth + 1))
        .concat(['...[TRUNCATED]']) as T;
    }
    return value.map(item => deepClean(item, options, depth + 1)) as T;
  }

  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }

  // Handle Error objects
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    } as T;
  }

  // Handle regular objects
  const keys = Object.keys(value as object);
  if (keys.length > options.maxObjectKeys) {
    const truncated: Record<string, unknown> = {};
    keys.slice(0, options.maxObjectKeys).forEach(key => {
      truncated[key] = deepClean((value as Record<string, unknown>)[key], options, depth + 1);
    });
    truncated['...[TRUNCATED]'] = `${keys.length - options.maxObjectKeys} more keys`;
    return truncated as T;
  }

  const result: Record<string, unknown> = {};
  for (const key of keys) {
    result[key] = deepClean((value as Record<string, unknown>)[key], options, depth + 1);
  }
  return result as T;
}

/**
 * Redact sensitive data from an object
 */
export function redactSensitiveData(
  value: unknown,
  patterns: RegExp[],
  replacement = '[REDACTED]'
): unknown {
  if (typeof value === 'string') {
    let result = value;
    for (const pattern of patterns) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  if (Array.isArray(value)) {
    return value.map(item => redactSensitiveData(item, patterns, replacement));
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      // Check if key matches sensitive patterns
      const isSensitiveKey = patterns.some(pattern => pattern.test(key));
      if (isSensitiveKey) {
        result[key] = replacement;
      } else {
        result[key] = redactSensitiveData(val, patterns, replacement);
      }
    }
    return result;
  }

  return value;
}

/**
 * Default sensitive data patterns
 */
export const DEFAULT_SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /auth[_-]?header/i,
  /bearer/i,
  /credential/i,
  /private[_-]?key/i,
];
