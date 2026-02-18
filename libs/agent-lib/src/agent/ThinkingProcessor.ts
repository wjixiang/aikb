import { ApiMessage } from '../task/task.type.js';
import { countTokens } from '../utils/countTokens.js';

/**
 * Result of the thinking phase
 */
export interface ThinkingResult {
    /** Summary of what has been accomplished */
    summary: string;
    /** Current state and context */
    currentState: string;
    /** Compressed/filtered conversation history */
    compressedHistory: ApiMessage[];
    /** Key insights from tool results */
    insights: string[];
    /** Next action plan */
    nextActions: string;
    /** Token usage for this thinking phase */
    thinkingTokens: number;
}

/**
 * Tool result from execution
 */
export interface ToolResult {
    toolName: string;
    success: boolean;
    result: any;
    timestamp: number;
}

/**
 * Configuration for ThinkingProcessor
 */
export interface ThinkingProcessorConfig {
    /** Strategy for context compression */
    strategy: 'sliding-window' | 'semantic' | 'token-budget';
    /** Token threshold for compression */
    compressionThreshold: number;
    /** Window size for sliding window strategy */
    slidingWindowSize?: number;
}

/**
 * ThinkingProcessor - Manages context compression and reflection
 * 
 * This class implements the thinking phase that occurs between tool execution
 * and the next API request. It analyzes the current state, compresses context,
 * and provides insights for the next cycle.
 */
export class ThinkingProcessor {
    private config: ThinkingProcessorConfig;

    constructor(config: ThinkingProcessorConfig) {
        this.config = {
            ...config,
            slidingWindowSize: config.slidingWindowSize || 10, // default: keep last 10 messages
        };
    }

    /**
     * Perform thinking phase analysis
     * 
     * @param conversationHistory - Full conversation history
     * @param workspaceContext - Current workspace state
     * @param lastToolResults - Results from most recent tool executions
     * @returns Thinking result with compressed context
     */
    async performThinking(
        conversationHistory: ApiMessage[],
        workspaceContext: string,
        lastToolResults?: ToolResult[]
    ): Promise<ThinkingResult> {
        const startTime = Date.now();

        // Estimate current token count
        const currentTokens = await this.estimateTokens(conversationHistory);

        // Decide if compression is needed
        const needsCompression = currentTokens > this.config.compressionThreshold;

        let compressedHistory = conversationHistory;
        let summary = '';
        let insights: string[] = [];
        let nextActions = '';

        if (needsCompression) {
            // Apply compression strategy
            switch (this.config.strategy) {
                case 'sliding-window':
                    compressedHistory = this.compressSlidingWindow(conversationHistory);
                    summary = this.generateSlidingWindowSummary(conversationHistory, compressedHistory);
                    break;
                case 'token-budget':
                    compressedHistory = this.compressTokenBudget(conversationHistory, this.config.compressionThreshold);
                    summary = this.generateTokenBudgetSummary(conversationHistory, compressedHistory);
                    break;
                case 'semantic':
                    // For now, fall back to sliding window
                    // TODO: Implement semantic compression
                    compressedHistory = this.compressSlidingWindow(conversationHistory);
                    summary = this.generateSlidingWindowSummary(conversationHistory, compressedHistory);
                    break;
            }
        }

        // Analyze tool results
        if (lastToolResults && lastToolResults.length > 0) {
            insights = this.analyzeToolResults(lastToolResults);
        }

        // Determine next actions
        nextActions = this.determineNextActions(compressedHistory, insights);

        // Calculate thinking tokens (rough estimate)
        const thinkingTokens = await this.estimateTokens(compressedHistory);

        return {
            summary,
            currentState: this.extractCurrentState(workspaceContext),
            compressedHistory,
            insights,
            nextActions,
            thinkingTokens,
        };
    }

    /**
     * Sliding window compression - keep last N messages
     */
    private compressSlidingWindow(history: ApiMessage[]): ApiMessage[] {
        const windowSize = this.config.slidingWindowSize || 10;

        if (history.length <= windowSize) {
            return history;
        }

        // Keep the first message (usually the task) and last N messages
        const firstMessage = history[0];
        const recentMessages = history.slice(-windowSize);

        return [firstMessage, ...recentMessages];
    }

    /**
     * Token budget compression - iteratively remove messages until under budget
     */
    private compressTokenBudget(history: ApiMessage[], maxTokens: number): ApiMessage[] {
        let compressed = [...history];
        let tokenCount = 0;

        // Keep removing oldest messages (except first) until under budget
        while (compressed.length > 1 && tokenCount > maxTokens) {
            tokenCount = 0;
            for (const msg of compressed) {
                tokenCount += this.estimateMessageTokens(msg);
            }

            if (tokenCount > maxTokens) {
                // Remove second message (keep first as task context)
                compressed = [compressed[0], ...compressed.slice(2)];
            }
        }

        return compressed;
    }

    /**
     * Generate summary for sliding window compression
     */
    private generateSlidingWindowSummary(original: ApiMessage[], compressed: ApiMessage[]): string {
        const removedCount = original.length - compressed.length;
        if (removedCount <= 0) {
            return 'No compression needed.';
        }

        return `Compressed conversation history: removed ${removedCount} older messages to reduce context. Kept initial task and ${compressed.length - 1} most recent messages.`;
    }

    /**
     * Generate summary for token budget compression
     */
    private generateTokenBudgetSummary(original: ApiMessage[], compressed: ApiMessage[]): string {
        const originalTokens = this.estimateHistoryTokens(original);
        const compressedTokens = this.estimateHistoryTokens(compressed);
        const savedTokens = originalTokens - compressedTokens;

        return `Compressed conversation history: reduced from ${originalTokens} to ${compressedTokens} tokens (saved ${savedTokens} tokens).`;
    }

    /**
     * Analyze tool results for insights
     */
    private analyzeToolResults(results: ToolResult[]): string[] {
        const insights: string[] = [];

        // Count successes and failures
        const successes = results.filter(r => r.success).length;
        const failures = results.filter(r => !r.success).length;

        if (successes > 0) {
            insights.push(`Successfully executed ${successes} tool(s).`);
        }

        if (failures > 0) {
            insights.push(`Failed to execute ${failures} tool(s).`);
        }

        // Analyze specific tools
        const toolSet = new Set(results.map(r => r.toolName));
        const toolNames = Array.from(toolSet);
        if (toolNames.length > 0) {
            insights.push(`Used tools: ${toolNames.join(', ')}.`);
        }

        return insights;
    }

    /**
     * Determine next actions based on history and insights
     */
    private determineNextActions(history: ApiMessage[], insights: string[]): string {
        // Check if task was completed
        const lastMessage = history[history.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
            const hasAttemptCompletion = lastMessage.content.some(
                block => block.type === 'tool_use' &&
                    (block as any).name === 'attempt_completion'
            );
            if (hasAttemptCompletion) {
                return 'Task completed.';
            }
        }

        // Check for errors
        const hasErrors = insights.some(i => i.includes('Failed'));
        if (hasErrors) {
            return 'Review failed tool executions and adjust approach.';
        }

        // Default: continue with next step
        return 'Continue with next step in task execution.';
    }

    /**
     * Extract current state from workspace context
     */
    private extractCurrentState(workspaceContext: string): string {
        // For now, return a truncated version
        // TODO: Implement smarter state extraction
        const maxLength = 500;
        if (workspaceContext.length <= maxLength) {
            return workspaceContext;
        }
        return workspaceContext.substring(0, maxLength) + '...';
    }

    /**
     * Estimate total tokens in conversation history
     */
    private async estimateTokens(history: ApiMessage[]): Promise<number> {
        return this.estimateHistoryTokens(history);
    }

    /**
     * Estimate tokens in history (synchronous version)
     */
    private estimateHistoryTokens(history: ApiMessage[]): number {
        return history.reduce((total, msg) => total + this.estimateMessageTokens(msg), 0);
    }

    /**
     * Estimate tokens in a single message
     */
    private estimateMessageTokens(message: ApiMessage): number {
        let text = '';

        for (const block of message.content) {
            if (block.type === 'text') {
                text += block.text + ' ';
            } else if (block.type === 'tool_use') {
                text += JSON.stringify(block) + ' ';
            } else if (block.type === 'tool_result') {
                text += JSON.stringify(block) + ' ';
            }
        }

        // Rough estimate: ~4 characters per token
        return Math.ceil(text.length / 4);
    }
}
