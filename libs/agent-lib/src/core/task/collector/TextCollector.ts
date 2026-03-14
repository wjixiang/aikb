/**
 * TextCollector Implementation
 * 
 * A basic collector that collects text responses from LLM.
 */

import type {
    IResultCollector,
    CollectedResult,
    CollectionContext,
} from '../types.js';

/**
 * Collector for plain text responses
 */
export class TextCollector implements IResultCollector {
    readonly type = 'text';

    collect(data: unknown, context?: CollectionContext): CollectedResult {
        let text: string;

        if (typeof data === 'string') {
            text = data;
        } else if (data === null || data === undefined) {
            text = '';
        } else {
            text = JSON.stringify(data);
        }

        return {
            type: this.type,
            data: text,
            metadata: {
                source: context?.source || 'llm_text',
                toolName: context?.toolName,
                length: text.length,
            },
            timestamp: Date.now(),
        };
    }

    canCollect(data: unknown): boolean {
        return typeof data === 'string' || data == null;
    }
}

/**
 * Factory function to create a TextCollector
 */
export function createTextCollector(): TextCollector {
    return new TextCollector();
}
