/**
 * CompositeCollector Implementation
 * 
 * A collector that chains multiple collectors together.
 * Tries each collector in order until one can collect the data.
 */

import type {
    IResultCollector,
    CollectedResult,
    CollectionContext,
} from '../types.js';

/**
 * Configuration for CompositeCollector
 */
export interface CompositeCollectorConfig {
    collectors: IResultCollector[];
    stopOnFirstSuccess?: boolean;
}

/**
 * Collector that chains multiple collectors
 */
export class CompositeCollector implements IResultCollector {
    readonly type = 'composite';
    private readonly collectors: IResultCollector[];
    private readonly stopOnFirstSuccess: boolean;

    constructor(config: CompositeCollectorConfig) {
        this.collectors = config.collectors;
        this.stopOnFirstSuccess = config.stopOnFirstSuccess ?? true;
    }

    collect(data: unknown, context?: CollectionContext): CollectedResult {
        const results: CollectedResult[] = [];

        for (const collector of this.collectors) {
            if (collector.canCollect(data)) {
                const result = collector.collect(data, context);
                results.push(result);

                if (this.stopOnFirstSuccess) {
                    return result;
                }
            }
        }

        // If no collector could collect, return a default result
        if (results.length === 0) {
            return {
                type: this.type,
                data,
                metadata: {
                    error: 'No collector could handle this data',
                    attemptedCollectors: this.collectors.map(c => c.type),
                },
                timestamp: Date.now(),
            };
        }

        // Return all results if not stopping on first success
        return {
            type: this.type,
            data: results.map(r => r.data),
            metadata: {
                collectorTypes: results.map(r => r.type),
                resultCount: results.length,
            },
            timestamp: Date.now(),
        };
    }

    canCollect(data: unknown): boolean {
        return this.collectors.some(collector => collector.canCollect(data));
    }

    /**
     * Add a collector to the chain
     */
    addCollector(collector: IResultCollector): void {
        this.collectors.push(collector);
    }

    /**
     * Remove a collector from the chain
     */
    removeCollector(collectorType: string): void {
        const index = this.collectors.findIndex(c => c.type === collectorType);
        if (index !== -1) {
            this.collectors.splice(index, 1);
        }
    }
}

/**
 * Factory function to create a CompositeCollector
 */
export function createCompositeCollector(
    collectors: IResultCollector[],
    stopOnFirstSuccess = true
): CompositeCollector {
    return new CompositeCollector({ collectors, stopOnFirstSuccess });
}
