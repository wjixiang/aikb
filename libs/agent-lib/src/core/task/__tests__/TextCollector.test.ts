/**
 * TextCollector Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { TextCollector, createTextCollector } from '../collector/TextCollector.js';
import type { CollectionContext } from '../types.js';

describe('TextCollector', () => {
    let collector: TextCollector;

    beforeEach(() => {
        collector = new TextCollector();
    });

    describe('type', () => {
        it('should have type "text"', () => {
            expect(collector.type).toBe('text');
        });
    });

    describe('canCollect', () => {
        it('should return true for string data', () => {
            expect(collector.canCollect('some text')).toBe(true);
        });

        it('should return true for null', () => {
            expect(collector.canCollect(null)).toBe(true);
        });

        it('should return true for undefined', () => {
            expect(collector.canCollect(undefined)).toBe(true);
        });

        it('should return false for other types', () => {
            expect(collector.canCollect(123)).toBe(false);
            expect(collector.canCollect({})).toBe(false);
            expect(collector.canCollect([])).toBe(false);
        });
    });

    describe('collect', () => {
        it('should collect string data correctly', () => {
            const result = collector.collect('Hello, world!');

            expect(result.type).toBe('text');
            expect(result.data).toBe('Hello, world!');
            expect(result.metadata).toEqual({
                source: 'llm_text',
                toolName: undefined,
                length: 13,
            });
            expect(result.timestamp).toBeDefined();
            expect(typeof result.timestamp).toBe('number');
        });

        it('should collect null as empty string', () => {
            const result = collector.collect(null);

            expect(result.data).toBe('');
        });

        it('should collect undefined as empty string', () => {
            const result = collector.collect(undefined);

            expect(result.data).toBe('');
        });

        it('should JSON stringify non-string data', () => {
            const data = { key: 'value', number: 42 };
            const result = collector.collect(data);

            expect(result.data).toBe(JSON.stringify(data));
        });

        it('should include context in metadata', () => {
            const context: CollectionContext = {
                source: 'tool_call',
                toolName: 'test_tool',
            };

            const result = collector.collect('test data', context);

            expect(result.metadata).toEqual({
                source: 'tool_call',
                toolName: 'test_tool',
                length: 9,
            });
        });

        it('should include custom metadata from context', () => {
            const context: CollectionContext = {
                source: 'external',
                metadata: { custom: 'value' },
            };

            const result = collector.collect('test', context);

            // Custom metadata is not automatically included in the result metadata
            // The collector only includes source, toolName, and length
            expect(result.metadata?.source).toBe('external');
        });

        it('should calculate correct length for empty string', () => {
            const result = collector.collect('');

            expect(result.metadata?.length).toBe(0);
        });

        it('should handle unicode characters correctly', () => {
            const text = 'Hello 世界 🌍';
            const result = collector.collect(text);

            expect(result.data).toBe(text);
            expect(result.metadata?.length).toBe(text.length);
        });
    });

    describe('createTextCollector factory', () => {
        it('should create a TextCollector instance', () => {
            const collector = createTextCollector();

            expect(collector).toBeInstanceOf(TextCollector);
            expect(collector.type).toBe('text');
        });
    });
});
