/**
 * Simplified MemoryModule - Manages conversation memory without turn-based concepts
 *
 * This module manages:
 * 1. Simple message storage
 * 2. Token-based context compression when exceeding context limit
 * 3. Error tracking for context injection
 * 4. LLM-based summarization for compression
 */

import { injectable, inject, optional } from 'inversify';
import { ApiMessage, WorkspaceContextEntry } from './types.js';
import type { IMemoryModule, MemoryModuleConfig } from './types.js';
import { TYPES } from '../di/types.js';
import { tiktoken } from '../utils/tiktoken.js';
import type { ApiClient } from '../api-client/index.js';
import type { IPersistenceService } from '../persistence/types.js';
import { diffChars } from 'diff';

// Re-export types
export type { MemoryModuleConfig };

/**
 * Default context sizes for different models
 */
export const DEFAULT_MODEL_CONTEXT_SIZES: Record<string, number> = {
  'claude-3-5-sonnet': 200000,
  'claude-3-opus': 200000,
  'claude-3-haiku': 200000,
  'Minimax-M2.5-highspeed': 200000,
  'gpt-4o': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
};

/**
 * Default configuration for simplified MemoryModule
 */
export const defaultMemoryConfig: MemoryModuleConfig = {
  enableRecall: false,
  maxRecallContexts: 3,
  maxRecalledMessages: 20,
  // Token-based compression settings (DISABLED - no compression)
  maxContextTokens: 100000, // Max tokens in context
  contextCompressionRatio: 0.8, // Compress when at 80% of maxContextTokens
  compressionTargetTokens: 60000, // Target after compression
  // LLM summarization settings (DISABLED - workspace context recording only)
  enableLLMSummarization: false, // DISABLED: Use simple summary only
  maxTokensForSummary: 15000, // Max tokens to send for summarization
  summaryModel: 'claude-3-5-sonnet', // Model to use for summarization
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

/**
 * System prompt for LLM workspace context diff analysis
 */
const WORKSPACE_CONTEXT_DIFF_PROMPT = `You are an expert at analyzing workspace context changes. Given the previous and current workspace context, your task is to:

1. **Identify Changes**: Compare the previous and current context to identify what sections changed
2. **Summarize Key Changes**: For each changed section, provide a brief summary of what changed
3. **Highlight Important Updates**: Call out any significant decisions, completed tasks, or new information

**Workspace Context Structure** (typically has these sections):
- Header/Summary information
- Component states (mail, picos, etc.)
- Recent Tool Calls
- Current task status

**Output Format**:
Return a structured summary in this format:
\`\`\`
## Changed Sections

### [Section Name]
- **What changed**: [brief description of the change]
- **Key details**: [specific values or information that changed]

### [Section Name]
- **What changed**: [brief description]
- **Key details**: [specific values]
\`\`\`

If no significant changes exist, return "No significant changes detected."
If this is the first context (no previous), return "Initial workspace context" followed by a brief summary of the workspace state.`;

/**
 * Simplified MemoryModule - no turn concepts, with token-based compression
 */
@injectable()
export class MemoryModule implements IMemoryModule {
  private config: MemoryModuleConfig;

  // Simple message storage
  private messages: ApiMessage[] = [];

  // Workspace context storage (for storing workspace state at each iteration)
  private workspaceContexts: WorkspaceContextEntry[] = [];

  // Previous full context for diff calculation
  private _previousFullContext: string | null = null;

  // Error storage
  private savedErrors: Error[] = [];

  // Cached token count
  private _cachedTokenCount: number | null = null;

  // API client for LLM calls
  private apiClient: ApiClient | null = null;

  // Flag to prevent recursive compression
  private _isCompressing = false;

  // Persistence service for memory durability
  private persistenceService: IPersistenceService | null = null;

  // Instance ID for persistence (injected via Inversify)
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

  /**
   * Set API client (can be set after construction)
   */
  setApiClient(apiClient: ApiClient): void {
    this.apiClient = apiClient;
  }

  /**
   * Get current configuration
   */
  getConfig(): MemoryModuleConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MemoryModuleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ==================== Persistence ====================

  /**
   * Persist memory to storage (if persistence service is available)
   */
  private async _persistMemory(): Promise<void> {
    if (!this.persistenceService || !this.instanceId) {
      this.logger.warn(
        'PersistenceService not exist in MemoryModule, skip memory persisting.',
      );
      return;
    }

    try {
      await this.persistenceService.saveMemory(this.instanceId, {
        messages: this.messages,
        workspaceContexts: this.workspaceContexts,
        config: this.config,
      });

      this.logger.debug('[MemoryModule] Memory has been persisted');
    } catch (error) {
      this.logger.warn(`[MemoryModule] Failed to persist memory: ${error}`);
    }
  }

  // ==================== Message Management ====================

  /**
   * Add message to storage
   */
  async addMessage(message: ApiMessage): Promise<ApiMessage> {
    this.messages.push(message);
    this._cachedTokenCount = null; // Invalidate cache

    // Don't compress if already compressing or if this is a summary message
    if (!this._isCompressing && !this.isSummaryMessage(message)) {
      await this.compressIfNeeded();
    }

    // Persist memory after adding message
    await this._persistMemory();

    return message;
  }

  /**
   * Check if message is a summary (to avoid recursive compression)
   */
  private isSummaryMessage(message: ApiMessage): boolean {
    const text = this.extractText(message.content);
    return (
      text.includes('[Previous conversation summarized:') ||
      text.includes('[LLM Summary:')
    );
  }

  /**
   * Add message (sync version for compatibility - doesn't trigger compression)
   */
  async addMessageSync(message: ApiMessage): Promise<ApiMessage> {
    this.messages.push(message);
    this._cachedTokenCount = null;
    // Persist memory after adding message
    await this._persistMemory();
    return message;
  }

  /**
   * Record tool call result (no-op - already handled by addMessage)
   */
  recordToolCall(toolName: string, success: boolean, result: any): void {
    // No-op
  }

  // ==================== History Retrieval ====================

  /**
   * Get all historical messages
   */
  getAllMessages(): ApiMessage[] {
    return [...this.messages];
  }

  /**
   * Get total token count for all messages
   */
  async getTotalTokens(): Promise<number> {
    if (this._cachedTokenCount !== null) {
      return this._cachedTokenCount;
    }

    if (this.messages.length === 0) {
      this._cachedTokenCount = 0;
      return 0;
    }

    // Convert ApiMessage to ContentBlockParam format for tiktoken
    const contentBlocks = this.messages.flatMap((msg) => {
      if (msg.role === 'system') {
        // System messages become text blocks
        return this.extractContentBlocks(msg.content);
      } else if (msg.role === 'user') {
        return this.extractContentBlocks(msg.content);
      } else if (msg.role === 'assistant') {
        return this.extractContentBlocks(msg.content);
      }
      return [];
    });

    this._cachedTokenCount = await tiktoken(contentBlocks);
    return this._cachedTokenCount;
  }

  /**
   * Get total token count synchronously (estimate)
   */
  getTotalTokensEstimate(): number {
    if (this._cachedTokenCount !== null) {
      return this._cachedTokenCount;
    }

    // Simple estimate: ~4 chars per token
    let totalChars = 0;
    for (const msg of this.messages) {
      const text = this.extractText(msg.content);
      totalChars += text.length;
    }

    this._cachedTokenCount = Math.ceil(totalChars / 4);
    return this._cachedTokenCount;
  }

  /**
   * Extract content blocks from message content
   */
  private extractContentBlocks(content: ApiMessage['content']) {
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

  /**
   * Extract plain text from content
   */
  private extractText(content: ApiMessage['content']): string {
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

  /**
   * Get history for prompt injection
   * Returns all messages with errors prepended as system messages
   * Note: Workspace contexts are recorded but NOT rendered into prompt (record only mode)
   * @param interleaveWorkspaces - DEPRECATED, ignored. Workspace contexts are never rendered.
   */
  getHistoryForPrompt(interleaveWorkspaces = false): ApiMessage[] {
    const result: ApiMessage[] = [];

    // Prepend errors as system messages
    const errors = this.popErrors();
    for (const error of errors) {
      result.push({
        role: 'system',
        content: [{ type: 'text' as const, text: `[Error: ${error.message}]` }],
        ts: Date.now(),
      });
    }

    // Add all messages (workspace contexts are NOT interleaved - they are recorded only)
    result.push(...this.messages);

    return result;
  }

  /**
   * Interleave workspace contexts with messages
   * Assumes pattern after errors: user, assistant, user, assistant, ...
   * Inserts workspace context after each assistant message
   */
  private _interleaveWorkspaceContexts(messages: ApiMessage[]): ApiMessage[] {
    if (this.workspaceContexts.length === 0) {
      return messages;
    }

    const result: ApiMessage[] = [];
    let workspaceIndex = 0;

    for (let i = 0; i < messages.length; i++) {
      result.push(messages[i]);

      // After each assistant message (that is not an error or tool_result), insert workspace context
      const msg = messages[i];
      if (msg.role === 'assistant') {
        if (workspaceIndex < this.workspaceContexts.length) {
          const ctx = this.workspaceContexts[workspaceIndex];
          result.push({
            role: 'system' as const,
            content: [
              {
                type: 'text' as const,
                text: `[Workspace Context (Iteration ${ctx.iteration})]\n${ctx.content}`,
              },
            ],
            ts: ctx.ts,
          });
          workspaceIndex++;
        }
      }
    }

    // Add any remaining workspace contexts at the end
    while (workspaceIndex < this.workspaceContexts.length) {
      const ctx = this.workspaceContexts[workspaceIndex];
      result.push({
        role: 'system' as const,
        content: [
          {
            type: 'text' as const,
            text: `[Workspace Context (Iteration ${ctx.iteration})]\n${ctx.content}`,
          },
        ],
        ts: ctx.ts,
      });
      workspaceIndex++;
    }

    return result;
  }

  // ==================== Workspace Context Management ====================

  /**
   * Parse workspace context into sections by component
   * Returns a map of section name -> content
   */
  private _parseContextBySections(context: string): Map<string, string> {
    const sections = new Map<string, string>();
    const lines = context.split('\n');

    let currentSection = 'header';
    let currentContent: string[] = [];

    for (const line of lines) {
      // Match ## section-name pattern
      const sectionMatch = line.match(/^##\s+(.+)$/);
      if (sectionMatch) {
        // Save previous section
        if (currentSection || currentContent.length > 0) {
          sections.set(currentSection, currentContent.join('\n'));
        }
        currentSection = sectionMatch[1].trim();
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection || currentContent.length > 0) {
      sections.set(currentSection, currentContent.join('\n'));
    }

    return sections;
  }

  /**
   * Compute diff between previous context and current context
   * Returns diff structure indicating what changed
   * Ignores changes in Recent Tool Calls section (always changes)
   */
  _computeContextDiff(
    prevContext: string | null,
    currContext: string,
  ): { hasChanges: boolean; changedSections: string[] } {
    if (!prevContext) {
      // First context
      return { hasChanges: true, changedSections: ['[INITIAL]'] };
    }

    // Strip Recent Tool Calls section before comparison (always changes)
    const stripToolCalls = (text: string): string => {
      const toolCallsMarker = '**Recent Tool Calls**';
      const idx = text.indexOf(toolCallsMarker);
      return idx >= 0 ? text.substring(0, idx).trimEnd() : text;
    };

    const prevClean = stripToolCalls(prevContext);
    const currClean = stripToolCalls(currContext);

    if (prevClean === currClean) {
      return { hasChanges: false, changedSections: [] };
    }

    const difResult = diffChars(prevClean, currClean);

    const changedSections = difResult
      .filter((e) => (e.added || e.removed) === true)
      .map((e) => `[${e.added ? 'ADDED' : 'REMOVED'}] ${e.value}`);

    return {
      hasChanges: changedSections.length > 0,
      changedSections,
    };
  }

  /**
   * Record a workspace context snapshot
   * Only stores when context actually changes, skips duplicate entries
   * Uses LLM to analyze diff and generate summary
   */
  async recordWorkspaceContext(
    context: string,
    iteration: number,
  ): Promise<void> {
    // Strip Recent Tool Calls section before storing/comparing
    const stripToolCalls = (text: string): string => {
      const toolCallsMarker = '**Recent Tool Calls**';
      const idx = text.indexOf(toolCallsMarker);
      return idx >= 0 ? text.substring(0, idx).trimEnd() : text;
    };

    const cleanedContext = stripToolCalls(context);
    const diffResult = this._computeContextDiff(
      this._previousFullContext,
      cleanedContext,
    );

    if (!diffResult.hasChanges) {
      // No changes, skip storing this entry
      this.logger.debug(
        `[MemoryModule] Skipped workspace context for iteration ${iteration} (unchanged)`,
      );
      return;
    }

    // Generate simple diff summary (LLM summarization is disabled)
    const summary = this._previousFullContext
      ? this._simpleContextDiff(this._previousFullContext, cleanedContext)
      : `Initial workspace context (iteration ${iteration})`;

    // Store the simple diff summary
    this.workspaceContexts.push({
      content: summary,
      ts: Date.now(),
      iteration,
      isDiff: true,
    });
    this._previousFullContext = cleanedContext;
    this.logger.debug(
      `[MemoryModule] Recorded workspace context for iteration ${iteration}`,
    );

    // Persist memory after recording workspace context
    await this._persistMemory();
  }

  /**
   * Analyze context diff using LLM
   */
  private async _analyzeContextDiffWithLLM(
    prevContext: string,
    currContext: string,
    iteration: number,
  ): Promise<string> {
    if (!this.apiClient) {
      throw new Error('ApiClient not available');
    }

    // Build messages for LLM
    const systemMsg: ApiMessage = {
      role: 'system',
      content: [{ type: 'text' as const, text: WORKSPACE_CONTEXT_DIFF_PROMPT }],
      ts: Date.now(),
    };

    const userMsg: ApiMessage = {
      role: 'user',
      content: [
        {
          type: 'text' as const,
          text: `## Previous Workspace Context (Iteration ${iteration - 1})
\`\`\`
${prevContext}
\`\`\`

## Current Workspace Context (Iteration ${iteration})
\`\`\`
${currContext}
\`\`\`

Please analyze the changes between these two workspace contexts.`,
        },
      ],
      ts: Date.now(),
    };

    // Call LLM
    const response = await this.apiClient.makeRequest(
      WORKSPACE_CONTEXT_DIFF_PROMPT,
      '', // workspace context - empty for diff analysis
      [
        this.formatMessageAsString(systemMsg),
        this.formatMessageAsString(userMsg),
      ],
      { timeout: 60000 },
      [], // no tools
    );

    // Extract summary from response
    const summary =
      response.textResponse?.trim() ||
      `Context changed at iteration ${iteration}`;
    return summary;
  }

  /**
   * Simple context diff fallback (without LLM)
   */
  private _simpleContextDiff(prevContext: string, currContext: string): string {
    const prevLines = prevContext.split('\n');
    const currLines = currContext.split('\n');

    const changedSections: string[] = [];

    // Simple line-by-line comparison to find section changes
    let prevSection = 'header';
    let currSection = 'header';

    for (let i = 0; i < Math.max(prevLines.length, currLines.length); i++) {
      const prevLine = prevLines[i] || '';
      const currLine = currLines[i] || '';

      // Detect section headers
      const prevSectionMatch = prevLine.match(/^##\s+(.+)$/);
      const currSectionMatch = currLine.match(/^##\s+(.+)$/);

      if (prevSectionMatch) prevSection = prevSectionMatch[1].trim();
      if (currSectionMatch) currSection = currSectionMatch[1].trim();

      if (prevLine !== currLine && (prevLine || currLine)) {
        // Lines differ
        if (
          !changedSections.includes(currSection) &&
          currSection !== prevSection
        ) {
          changedSections.push(currSection);
        }
      }
    }

    if (changedSections.length === 0) {
      return 'Minor context updates';
    }

    return `Changed sections: ${changedSections.join(', ')}`;
  }

  /**
   * Get all workspace context entries
   */
  getWorkspaceContexts(): WorkspaceContextEntry[] {
    return [...this.workspaceContexts];
  }

  /**
   * Get workspace contexts formatted for prompt injection
   * Returns them as system messages with special formatting
   * Only returns entries where context actually changed
   */
  getWorkspaceContextsForPrompt(): ApiMessage[] {
    if (this.workspaceContexts.length === 0) {
      return [];
    }

    return this.workspaceContexts.map((ctx) => ({
      role: 'system' as const,
      content: [
        {
          type: 'text' as const,
          text: `[Workspace Context (Iteration ${ctx.iteration})]\n${ctx.content}`,
        },
      ],
      ts: ctx.ts,
    }));
  }

  /**
   * Clear workspace contexts
   */
  clearWorkspaceContexts(): void {
    this.workspaceContexts = [];
  }

  // ==================== Error Management ====================

  /**
   * Push errors to be saved for later retrieval
   */
  pushErrors(errors: Error[]): void {
    this.savedErrors.push(...errors);
  }

  /**
   * Pop and return all saved errors
   */
  popErrors(): Error[] {
    const errors = [...this.savedErrors];
    this.savedErrors = [];
    return errors;
  }

  /**
   * Get saved errors without clearing them
   */
  getErrors(): Error[] {
    return [...this.savedErrors];
  }

  /**
   * Clear all saved errors
   */
  clearErrors(): void {
    this.savedErrors = [];
  }

  // ==================== Token-Based Context Compression ====================

  /**
   * Check if compression is needed based on token count
   */
  private async compressIfNeeded(): Promise<void> {
    const maxTokens = this.config.maxContextTokens || 100000;
    const threshold = this.config.contextCompressionRatio || 0.8;
    const triggerTokens = Math.floor(maxTokens * threshold);

    const currentTokens = await this.getTotalTokens();

    if (currentTokens > triggerTokens) {
      const targetTokens =
        this.config.compressionTargetTokens || Math.floor(maxTokens * 0.6);
      await this.compress(targetTokens);
    }
  }

  /**
   * Compress messages to target token count
   */
  private async compress(targetTokens: number): Promise<void> {
    if (this.messages.length === 0 || this._isCompressing) {
      return;
    }

    this._isCompressing = true;

    try {
      const startCount = this.messages.length;

      // Collect messages to be removed for summarization
      const messagesToSummarize: ApiMessage[] = [];
      let currentTokens = await this.getTotalTokens();

      // Remove oldest messages until under target
      while (this.messages.length > 1 && currentTokens > targetTokens) {
        const removed = this.messages.shift();
        if (removed) {
          messagesToSummarize.push(removed);
          this._cachedTokenCount = null;
          currentTokens = await this.getTotalTokens();
        }
      }

      const removedCount = messagesToSummarize.length;
      if (removedCount > 0) {
        // Check if LLM summarization is needed or should be skipped
        const summaryText = await this.generateSummary(messagesToSummarize);

        const summaryMessage: ApiMessage = {
          role: 'system',
          content: [
            {
              type: 'text' as const,
              text: `[Previous conversation summarized:\n${summaryText}]`,
            },
          ],
          ts: Date.now(),
        };

        // Insert summary at the beginning (sync to avoid recursion)
        this.messages.unshift(summaryMessage);
        this._cachedTokenCount = null;

        this.logger.info(
          `[MemoryModule] Compressed ${removedCount} messages, now ${this.messages.length} messages`,
        );
      }
    } finally {
      this._isCompressing = false;
    }
  }

  /**
   * Check if content is essentially the same (repetitive/low information)
   * Returns true if LLM summarization should be skipped
   */
  private _isContentRepetitive(messages: ApiMessage[]): boolean {
    if (messages.length < 3) {
      return true; // Too few messages, use simple summary
    }

    // Extract all text content
    const texts = messages.map((m) =>
      this.extractText(m.content).toLowerCase(),
    );

    // Check if all messages are tool results only (no meaningful conversation)
    const hasUserMessages = messages.some((m) => m.role === 'user');
    const hasAssistantMessages = messages.some((m) => m.role === 'assistant');

    if (!hasUserMessages && !hasAssistantMessages) {
      // All tool results - no meaningful conversation to summarize
      return true;
    }

    // Check for repetitive content (same text repeated)
    const uniqueTexts = new Set(texts);
    if (uniqueTexts.size <= 2 && texts.length > 4) {
      // Very few unique texts among many messages - repetitive
      return true;
    }

    // Check for very short repetitive messages (like polling loops)
    const avgLength =
      texts.reduce((sum, t) => sum + t.length, 0) / texts.length;
    if (avgLength < 50 && uniqueTexts.size <= texts.length / 3) {
      // Short messages with high repetition - likely polling/status checks
      return true;
    }

    return false;
  }

  /**
   * Generate summary using LLM or fallback to simple summary
   * Skips LLM if content is repetitive/identical
   */
  private async generateSummary(messages: ApiMessage[]): Promise<string> {
    // Skip LLM if content is repetitive - use simple summary instead
    if (this._isContentRepetitive(messages)) {
      this.logger.debug(
        '[MemoryModule] Content is repetitive, skipping LLM summarization',
      );
      return this.simpleSummary(messages);
    }

    if (!this.config.enableLLMSummarization || !this.apiClient) {
      return this.simpleSummary(messages);
    }

    try {
      return await this.summarizeWithLLM(messages);
    } catch (error) {
      this.logger.warn(
        `[MemoryModule] LLM summarization failed, using simple summary: ${error}`,
      );
      return this.simpleSummary(messages);
    }
  }

  /**
   * Summarize messages using LLM
   */
  private async summarizeWithLLM(messages: ApiMessage[]): Promise<string> {
    if (!this.apiClient) {
      throw new Error('ApiClient not available');
    }

    // Format messages for summarization
    const conversationText = this.formatMessagesForSummary(messages);

    // Check token count - limit to maxTokensForSummary
    const tokenEstimate = Math.ceil(conversationText.length / 4);
    let textToSummarize = conversationText;

    if (tokenEstimate > (this.config.maxTokensForSummary || 15000)) {
      // Truncate to fit token limit
      const maxChars = (this.config.maxTokensForSummary || 15000) * 4;
      textToSummarize =
        conversationText.substring(0, maxChars) + '\n[truncated]';
    }

    // Build messages for LLM
    const systemMsg: ApiMessage = {
      role: 'system',
      content: [{ type: 'text' as const, text: SUMMARIZATION_PROMPT }],
      ts: Date.now(),
    };

    const userMsg: ApiMessage = {
      role: 'user',
      content: [
        {
          type: 'text' as const,
          text: `Please summarize the following conversation:\n\n${textToSummarize}`,
        },
      ],
      ts: Date.now(),
    };

    // Call LLM
    const response = await this.apiClient.makeRequest(
      SUMMARIZATION_PROMPT,
      '', // workspace context - empty for summarization
      [
        this.formatMessageAsString(systemMsg),
        this.formatMessageAsString(userMsg),
      ],
      { timeout: 60000 },
      [], // no tools
    );

    // Extract summary from response
    const summary =
      response.textResponse?.trim() || this.simpleSummary(messages);
    return summary;
  }

  /**
   * Format messages for summary prompt
   */
  private formatMessagesForSummary(messages: ApiMessage[]): string {
    return messages
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
  }

  /**
   * Format a message as string for LLM context
   */
  private formatMessageAsString(message: ApiMessage): string {
    const role =
      message.role === 'user'
        ? 'User'
        : message.role === 'assistant'
          ? 'Assistant'
          : 'System';
    const text = this.extractText(message.content);
    return `<${role}>\n${text}\n</${role}>`;
  }

  /**
   * Simple statistical summary fallback
   */
  private simpleSummary(messages: ApiMessage[]): string {
    const userMsgs = messages.filter((m) => m.role === 'user').length;
    const assistantMsgs = messages.filter((m) => m.role === 'assistant').length;
    const toolResults = messages.filter(
      (m) =>
        Array.isArray(m.content) &&
        m.content.some((c) => c.type === 'tool_result'),
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

  // ==================== Import/Export ====================

  /**
   * Export memory state
   */
  export() {
    return {
      messages: this.messages,
      workspaceContexts: this.workspaceContexts,
      config: this.config,
      savedErrors: this.savedErrors,
    };
  }

  /**
   * Import memory state
   */
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
    // Persist after import
    this._persistMemory();
  }

  /**
   * Clear all memory
   */
  clear() {
    this.messages = [];
    this.workspaceContexts = [];
    this.savedErrors = [];
    this._cachedTokenCount = null;
    this._previousFullContext = null;
  }
}

// Type for Logger (pino)
type Logger = import('pino').Logger;
