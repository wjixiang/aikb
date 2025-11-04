/**
 * Client-safe configuration types for chat functionality
 * These are simple interfaces that don't import server-side dependencies
 */

export interface ChatConfig {
  useHyDE: boolean;
  useHybrid: boolean;
  topK: number;
  language: 'zh' | 'en';
}

export const defaultChatConfig: ChatConfig = {
  useHyDE: false,
  useHybrid: false,
  topK: 10,
  language: 'zh',
};
