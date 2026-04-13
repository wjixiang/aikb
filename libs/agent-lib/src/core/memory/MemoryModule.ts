/**
 * MemoryModule - Manages conversation memory with LLM-based context compression
 *
 * Responsibilities:
 * 1. Simple message storage
 * 2. Token-based context compression using LLM summarization
 * 3. Error tracking for context injection
 * 4. Workspace context recording (record-only, not injected into prompts)
 */

import { injectable, inject, optional } from 'inversify';
<<<<<<< HEAD
import type { Message } from './types.js';
import { WorkspaceContextEntry } from './types.js';
import type { IMemoryModule, MemoryModuleConfig } from './types.js';
import { TYPES } from '../di/types.js';
import { tiktoken } from '../utils/tiktoken.js';
import type { ApiClient } from 'llm-api-client';
import { MessageBuilder } from 'llm-api-client';
import type { IPersistenceService } from '../persistence/types.js';
import { diffChars } from 'diff';

// Re-export types
export type { MemoryModuleConfig };

/**
 * Default configuration for MemoryModule
 */
export const defaultMemoryConfig: MemoryModuleConfig = {
  maxContextTokens: 100000,
  contextCompressionRatio: 0.8,
  compressionTargetTokens: 60000,
  minRetainedMessages: 20,
};

/**
 * System prompt for LLM summarization
 */
const SUMMARIZATION_PROMPT = `You are a concise summarizer. Given a conversation history, create a brief summary that captures the key points, decisions, and important context. Keep the summary under 500 words. Focus on:
- Main topics discussed
- Key conclusions or decisions made
- Any important context or constraints mentioned
- Outstanding tasks or questions

Format your response as a concise narrative summary.`;

/** Max tokens to send for LLM summarization */
const MAX_TOKENS_FOR_SUMMARY = 15000;

@injectable()
export class MemoryModule implements IMemoryModule {
  private config: MemoryModuleConfig;

  private messages: Message[] = [];
  private workspaceContexts: WorkspaceContextEntry[] = [];
  private _previousFullContext: string | null = null;
  private savedErrors: Error[] = [];
  private _cachedTokenCount: number | null = null;
  private apiClient: ApiClient | null = null;
  private _isCompressing = false;
  private persistenceService: IPersistenceService | null = null;
  private instanceId: string | null = null;

  constructor(
    @inject(TYPES.Logger) private logger: Logger,
    @inject(TYPES.MemoryModuleConfig)
    @optional()
    config: Partial<MemoryModuleConfig> = {},
    @inject(TYPES.ApiClient) @optional() apiClient: ApiClient | null = null,
    @inject(TYPES.IPersistenceService)
    @optional()
    persistenceService: IPersistenceService | null = null,
    @inject(TYPES.MemoryInstanceId)
    @optional()
    instanceId: string | null = null,
  ) {
    this.config = { ...defaultMemoryConfig, ...config };
    this.apiClient = apiClient || null;
    this.persistenceService = persistenceService || null;
    this.instanceId = instanceId;
  }

  setApiClient(apiClient: ApiClient): void {
    this.apiClient = apiClient;
  }

  getConfig(): MemoryModuleConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<MemoryModuleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ==================== Persistence ====================

  private async _persistMemory(): Promise<void> {
    if (!this.persistenceService || !this.instanceId) {
      return;
    }
    try {
      await this.persistenceService.saveMemory(this.instanceId, {
        messages: this.messages,
        workspaceContexts: this.workspaceContexts,
        config: this.config,
      });
    } catch (error) {
      this.logger.warn(`[MemoryModule] Failed to persist memory: ${error}`);
    }
  }

  // ==================== Message Management ====================

  async addMessage(message: Message): Promise<Message> {
    this.messages.push(message);
    this._cachedTokenCount = null;

    if (!this._isCompressing) {
      await this.compressIfNeeded();
    }

    await this._persistMemory();
    return message;
  }

  async addMessageSync(message: Message): Promise<Message> {
    this.messages.push(message);
    this._cachedTokenCount = null;
    await this._persistMemory();
    return message;
  }

  getAllMessages(): Message[] {
    return [...this.messages];
  }

  async getTotalTokens(): Promise<number> {
    if (this._cachedTokenCount !== null) {
      return this._cachedTokenCount;
    }

    if (this.messages.length === 0) {
      this._cachedTokenCount = 0;
      return 0;
    }

    const contentBlocks = this.messages.flatMap((msg) =>
      this.extractContentBlocks(msg.content),
    );

    this._cachedTokenCount = await tiktoken(contentBlocks);
    return this._cachedTokenCount;
  }

  getHistoryForPrompt(): Message[] {
    const result: Message[] = [];

    // Prepend errors as system messages (consumed once)
    const errors = this.popErrors();
    for (const error of errors) {
      result.push({
        role: 'system',
        content: [
          { type: 'text' as const, text: `[Error: ${error.message}]` },
        ],
        ts: Date.now(),
      });
    }

    result.push(...this.messages);
    return result;
  }

  // ==================== Workspace Context Management ====================

  async recordWorkspaceContext(
    context: string,
    iteration: number,
  ): Promise<void> {
    const stripToolCalls = (text: string): string => {
      const idx = text.indexOf('**Recent Tool Calls**');
      return idx >= 0 ? text.substring(0, idx).trimEnd() : text;
    };

    const cleanedContext = stripToolCalls(context);
    const diffResult = this._computeContextDiff(
      this._previousFullContext,
      cleanedContext,
    );

    if (!diffResult.hasChanges) {
      return;
    }

    this.workspaceContexts.push({
      content: cleanedContext,
      ts: Date.now(),
      iteration,
    });
    this._previousFullContext = cleanedContext;

    await this._persistMemory();
  }

  getWorkspaceContexts(): WorkspaceContextEntry[] {
    return [...this.workspaceContexts];
  }

  clearWorkspaceContexts(): void {
    this.workspaceContexts = [];
  }

  // ==================== Error Management ====================

  pushErrors(errors: Error[]): void {
    this.savedErrors.push(...errors);
  }

  popErrors(): Error[] {
    const errors = [...this.savedErrors];
    this.savedErrors = [];
    return errors;
  }

  getErrors(): Error[] {
    return [...this.savedErrors];
  }

  clearErrors(): void {
    this.savedErrors = [];
  }

  // ==================== Token-Based Context Compression ====================

  private get compressionTriggerTokens(): number {
    return Math.floor(
      this.config.maxContextTokens * this.config.contextCompressionRatio,
    );
  }

  private async compressIfNeeded(): Promise<void> {
    const currentTokens = await this.getTotalTokens();
    if (currentTokens <= this.compressionTriggerTokens) return;
    await this.compress();
  }

  private async compress(): Promise<void> {
    if (
      this._isCompressing ||
      this.messages.length <= this.config.minRetainedMessages
    ) {
      return;
    }

    this._isCompressing = true;
    try {
      // Split: retain recent messages, compress older ones
      const retained = this.messages.slice(-this.config.minRetainedMessages);
      const toCompress = this.messages.slice(0, -this.config.minRetainedMessages);

      if (toCompress.length === 0) return;

      // Remove existing summary message from toCompress if present
      const existingSummaryIdx = toCompress.findIndex(
        (m) =>
          m.role === 'system' &&
          typeof m.content !== 'string' &&
          Array.isArray(m.content) &&
          m.content.some(
            (c) =>
              c.type === 'text' &&
              typeof c.text === 'string' &&
              c.text.startsWith('[Previous conversation summarized:'),
          ),
      );

      let finalToCompress = toCompress;
      if (existingSummaryIdx >= 0) {
        finalToCompress = toCompress.filter((_, i) => i !== existingSummaryIdx);
      }

      if (finalToCompress.length === 0) return;

      const summary = await this.summarize(finalToCompress);

      this.messages = [
        {
          role: 'system',
          content: [
            {
              type: 'text' as const,
              text: `[Previous conversation summarized:\n${summary}]`,
            },
          ],
          ts: Date.now(),
        },
        ...retained,
      ];
      this._cachedTokenCount = null;

      this.logger.info(
        `[MemoryModule] Compressed ${finalToCompress.length} messages into summary, retained ${retained.length} recent messages`,
      );
    } finally {
      this._isCompressing = false;
    }
  }

  /**
   * Generate summary using LLM, with statistical fallback
   */
  private async summarize(messages: Message[]): Promise<string> {
    if (!this.apiClient) {
      return this.statisticalSummary(messages);
    }

    try {
      return await this.summarizeWithLLM(messages);
    } catch (error) {
      this.logger.warn(
        `[MemoryModule] LLM summarization failed, using statistical summary: ${error}`,
      );
      return this.statisticalSummary(messages);
    }
  }

  private async summarizeWithLLM(messages: Message[]): Promise<string> {
    if (!this.apiClient) {
      throw new Error('ApiClient not available');
    }

    const conversationText = messages
      .map((msg) => {
        const role =
          msg.role === 'user'
            ? 'User'
            : msg.role === 'assistant'
              ? 'Assistant'
              : 'System';
        const text = this.extractText(msg.content);
        return `[${role}]: ${text}`;
      })
      .join('\n\n');

    // Truncate if too long
    let textToSummarize = conversationText;
    const tokenEstimate = Math.ceil(conversationText.length / 4);
    if (tokenEstimate > MAX_TOKENS_FOR_SUMMARY) {
      const maxChars = MAX_TOKENS_FOR_SUMMARY * 4;
      textToSummarize =
        conversationText.substring(0, maxChars) + '\n[truncated]';
    }

    const response = await this.apiClient.makeRequest(
      SUMMARIZATION_PROMPT,
      '',
      [
        MessageBuilder.system(`<System>\n${SUMMARIZATION_PROMPT}\n</System>`),
        MessageBuilder.user(`Please summarize the following conversation:\n\n${textToSummarize}`),
      ],
      { timeout: 60000 },
      [],
    );

    return (
      response.textResponse?.trim() || this.statisticalSummary(messages)
    );
  }

  /**
   * Statistical summary fallback when LLM is unavailable
   */
  private statisticalSummary(messages: Message[]): string {
    const userMsgs = messages.filter((m) => m.role === 'user').length;
    const assistantMsgs = messages.filter((m) => m.role === 'assistant').length;
    const toolResults = messages.filter((m) =>
      Array.isArray(m.content)
        ? m.content.some((c) => c.type === 'tool_result')
        : false,
    ).length;

    const firstText = this.extractText(messages[0]?.content || '').substring(
      0,
      100,
    );
    const lastText = this.extractText(
      messages[messages.length - 1]?.content || '',
    ).substring(0, 100);

    return (
      `${messages.length} messages (${userMsgs} user, ${assistantMsgs} assistant, ${toolResults} tool results). ` +
      `First exchange: "${firstText}...". ` +
      `Last exchange: "${lastText}...".`
    );
  }

  // ==================== Helpers ====================

  private extractContentBlocks(content: Message['content']) {
    if (typeof content === 'string') {
      return [{ type: 'text' as const, text: content }];
    }
    if (Array.isArray(content)) {
      return content.map((block) => {
        if (block.type === 'text') {
          return { type: 'text' as const, text: block.text };
        }
        if (block.type === 'tool_result') {
          return {
            type: 'text' as const,
            text: `[Tool Result: ${block.content}]`,
          };
        }
        return { type: 'text' as const, text: JSON.stringify(block) };
      });
    }
    return [{ type: 'text' as const, text: String(content) }];
  }

  private extractText(content: Message['content']): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
        .join(' ');
    }
    return String(content);
  }

  private _computeContextDiff(
    prevContext: string | null,
    currContext: string,
  ): { hasChanges: boolean; changedSections: string[] } {
    if (!prevContext) {
      return { hasChanges: true, changedSections: ['[INITIAL]'] };
    }

    if (prevContext === currContext) {
      return { hasChanges: false, changedSections: [] };
    }

    const difResult = diffChars(prevContext, currContext);
    const changedSections = difResult
      .filter((e) => e.added || e.removed)
      .map((e) => `[${e.added ? 'ADDED' : 'REMOVED'}] ${e.value}`);

    return {
      hasChanges: changedSections.length > 0,
      changedSections,
    };
  }

  // ==================== Import/Export ====================

  export() {
    return {
      messages: this.messages,
      workspaceContexts: this.workspaceContexts,
      config: this.config,
      savedErrors: this.savedErrors,
    };
  }

  import(data: any) {
    if (data.messages) {
      this.messages = data.messages;
    }
    if (data.workspaceContexts) {
      this.workspaceContexts = data.workspaceContexts;
    }
    if (data.savedErrors) {
      this.savedErrors = data.savedErrors;
    }
    this._cachedTokenCount = null;
    this._persistMemory();
  }

  clear() {
    this.messages = [];
    this.workspaceContexts = [];
    this.savedErrors = [];
    this._cachedTokenCount = null;
    this._previousFullContext = null;
  }
}

type Logger = import('pino').Logger;
