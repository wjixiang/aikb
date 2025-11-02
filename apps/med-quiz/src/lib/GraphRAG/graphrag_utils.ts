import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { cacheType } from "./CacheManager";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import * as crypto from "crypto";
import { StringExpression } from "mongoose";

/**
 * Simple non-cryptographic hash function for strings.
 * @param text The input string.
 * @returns A hash value.
 */
export function compute_hash(
  text: string,
  cache_type: cacheType,
): StringExpression {
  const hash_text = text + ":" + cache_type; // Combine text with cache type for unique hashing
  const hash = crypto.createHash("sha256").update(hash_text).digest("hex");
  return hash;
}
/**
 * Compute a hash for the given arguments.
 * @param args Arguments to hash
 * @param cache_type Type of cache (e.g., 'keywords', 'query', 'extract')
 * @returns Hash string
 */
/**
 * Compute a hash for the given arguments.
 * @param args Arguments to hash
 * @param cache_type Type of cache (e.g., 'keywords', 'query', 'extract')
 * @returns Hash string
 */
export function computeArgsHash(cache_type: cacheType, ...args: any[]): string {
  let args_str = args.map((arg) => String(arg)).join("");
  if (cache_type) {
    args_str = `${cache_type}:${args_str}`;
  }

  // Compute MD5 hash
  return crypto.createHash("md5").update(args_str).digest("hex");
}

// Placeholder for getConversationTurns - implement actual logic based on conversation history structure
export function getConversationTurns(history: any[], turns?: number): string {
  // Make turns optional
  // This is a placeholder implementation.
  // You should replace this with actual logic to format conversation history.
  console.warn("Using placeholder getConversationTurns");
  if (!history || history.length === 0) {
    return "";
  }
  const numTurns = turns === undefined ? history.length / 2 : turns; // Provide a default if turns is undefined
  const recentTurns = history.slice(Math.max(0, history.length - numTurns * 2));
  return recentTurns
    .map((turn, index) => {
      const prefix = index % 2 === 0 ? "User: " : "AI: ";
      return `${prefix}${turn.message || turn.content}`; // Adjust based on actual history object structure
    })
    .join("\n");
}

// Placeholder for encodeStringByTiktoken - implement actual tokenization logic
export function encodeStringByTiktoken(text: string): number[] {
  // This is a placeholder implementation.
  // You should replace this with actual tokenization logic using a library like 'tiktoken'.
  console.warn("Using placeholder encodeStringByTiktoken");
  // Return a dummy array of numbers based on string length as a placeholder
  return Array.from({ length: text.length / 4 }, (_, i) => i); // Very rough estimate
}
