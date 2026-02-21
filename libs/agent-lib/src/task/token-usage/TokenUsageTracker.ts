import { MessageTokenUsage } from '../../types/index.js';
import type { ApiStreamChunk, ApiStreamUsageChunk } from '../../api-client/index.js';

/**
 * Tracks and accumulates token usage from API responses
 */
export class TokenUsageTracker {
    private tokenUsage: MessageTokenUsage = {
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCost: 0,
        contextTokens: 0,
    };

    /**
     * Accumulate token usage information from usage chunks
     */
    accumulate(usageChunk: ApiStreamChunk): void {
        if (!usageChunk || usageChunk.type !== 'usage') return;

        const chunk = usageChunk as ApiStreamUsageChunk;
        this.tokenUsage.totalTokensIn += chunk.inputTokens;
        this.tokenUsage.totalTokensOut += chunk.outputTokens;

        if (chunk.cacheWriteTokens !== undefined) {
            this.tokenUsage.totalCacheWrites = (this.tokenUsage.totalCacheWrites || 0) + chunk.cacheWriteTokens;
        }
        if (chunk.cacheReadTokens !== undefined) {
            this.tokenUsage.totalCacheReads = (this.tokenUsage.totalCacheReads || 0) + chunk.cacheReadTokens;
        }
        if (chunk.totalCost !== undefined) {
            this.tokenUsage.totalCost += chunk.totalCost;
        }
    }

    /**
     * Get current token usage
     */
    getUsage(): MessageTokenUsage {
        return { ...this.tokenUsage };
    }

    /**
     * Reset token usage
     */
    reset(): void {
        this.tokenUsage = {
            totalTokensIn: 0,
            totalTokensOut: 0,
            totalCacheWrites: 0,
            totalCacheReads: 0,
            totalCost: 0,
            contextTokens: 0,
        };
    }

    /**
     * Set context tokens
     */
    setContextTokens(tokens: number): void {
        this.tokenUsage.contextTokens = tokens;
    }
}
