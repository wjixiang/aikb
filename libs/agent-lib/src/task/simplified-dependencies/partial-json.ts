/**
 * Simplified partial JSON parser
 * Extracted from core/assistant-message/NativeToolCallParser.ts
 */

/**
 * Parse potentially incomplete JSON strings.
 * Returns the parsed object if valid, null otherwise.
 */
export function parseJSON(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
}
