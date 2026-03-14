/**
 * ToolCallCollector Implementation
 * 
 * A collector that collects tool call information from LLM responses.
 */

import type {
    IResultCollector,
    CollectedResult,
    CollectionContext,
} from '../types.js';

/**
 * Tool call data structure
 */
export interface ToolCallData {
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    timestamp?: number;
}

/**
 * Collector for tool call information
 */
export class ToolCallCollector implements IResultCollector {
    readonly type = 'tool_call';

    collect(data: unknown, context?: CollectionContext): CollectedResult {
        let toolCallData: ToolCallData;

        if (this.isToolCallData(data)) {
            toolCallData = data;
        } else if (context?.toolName) {
            // Extract from context if available
            toolCallData = {
                name: context.toolName,
                arguments: (data as any) || {},
                result: data,
            };
        } else {
            // Try to parse as tool call
            toolCallData = {
                name: 'unknown',
                arguments: {},
                result: data,
            };
        }

        return {
            type: this.type,
            data: toolCallData,
            metadata: {
                source: context?.source || 'tool_call',
                toolName: toolCallData.name,
                argumentCount: Object.keys(toolCallData.arguments).length,
            },
            timestamp: Date.now(),
        };
    }

    canCollect(data: unknown): boolean {
        return (
            this.isToolCallData(data) ||
            typeof data === 'object' ||
            typeof data === 'string'
        );
    }

    /**
     * Check if data is ToolCallData
     */
    private isToolCallData(data: unknown): data is ToolCallData {
        return (
            typeof data === 'object' &&
            data !== null &&
            'name' in data &&
            typeof (data as any).name === 'string'
        );
    }
}

/**
 * Factory function to create a ToolCallCollector
 */
export function createToolCallCollector(): ToolCallCollector {
    return new ToolCallCollector();
}
