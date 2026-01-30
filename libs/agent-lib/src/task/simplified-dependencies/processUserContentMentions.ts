import Anthropic from '@anthropic-ai/sdk';

/**
 * Simplified user content mentions processor
 * Extracted from core/mentions/processUserContentMentions.ts
 */
export async function processUserContentMentions(options: {
  userContent: Anthropic.Messages.ContentBlockParam[];
}): Promise<Anthropic.Messages.ContentBlockParam[]> {
  // Simplified implementation - just return the content as-is
  // In a real implementation, this would process mentions, URLs, etc.
  // For our simplified version, we just pass through the content
  return Promise.resolve(options.userContent);
}
