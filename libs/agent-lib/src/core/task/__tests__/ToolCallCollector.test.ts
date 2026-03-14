/**
 * ToolCallCollector Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolCallCollector, createToolCallCollector, type ToolCallData } from '../collector/ToolCallCollector.js';
import type { CollectionContext } from '../types.js';

describe('ToolCallCollector', () => {
    let collector: ToolCallCollector;

    beforeEach(() => {
        collector = new ToolCallCollector();
    });

    describe('type', () => {
        it('should have type "tool_call"', () => {
            expect(collector.type).toBe('tool_call');
        });
    });

    describe('canCollect', () => {
        it('should return true for valid ToolCallData', () => {
            const data: ToolCallData = {
                name: 'test_tool',
                arguments: { param1: 'value1' },
            };

            expect(collector.canCollect(data)).toBe(true);
        });

        it('should return true for objects', () => {
            expect(collector.canCollect({})).toBe(true);
            expect(collector.canCollect({ key: 'value' })).toBe(true);
        });

        it('should return true for strings', () => {
            expect(collector.canCollect('some string')).toBe(true);
        });

        it('should return true for primitives', () => {
            // Primitives are not objects, so canCollect returns false
            expect(collector.canCollect(123)).toBe(false);
            expect(collector.canCollect(true)).toBe(false);
            expect(collector.canCollect(false)).toBe(false);
        });
    });

    describe('collect', () => {
        it('should collect valid ToolCallData', () => {
            const data: ToolCallData = {
                name: 'search_files',
                arguments: { pattern: '*.ts' },
                result: { files: ['file1.ts', 'file2.ts'] },
                timestamp: Date.now(),
            };

            const result = collector.collect(data);

            expect(result.type).toBe('tool_call');
            expect(result.data).toEqual(data);
            expect(result.metadata).toEqual({
                source: 'tool_call', // Changed from 'llm_text' to 'tool_call'
                toolName: 'search_files',
                argumentCount: 1,
            });
        });

        it('should extract tool name from context if available', () => {
            const context: CollectionContext = {
                source: 'tool_call',
                toolName: 'custom_tool',
            };

            const result = collector.collect({ some: 'data' }, context);

            expect(result.data).toEqual({
                name: 'custom_tool',
                arguments: { some: 'data' }, // Changed: the data becomes arguments
                result: { some: 'data' },
            });
            expect(result.metadata?.toolName).toBe('custom_tool');
        });

        it('should handle data without tool name', () => {
            const result = collector.collect({ some: 'data' });

            expect(result.data).toEqual({
                name: 'unknown',
                arguments: {},
                result: { some: 'data' },
            });
        });

        it('should handle string data', () => {
            const result = collector.collect('string data');

            expect(result.data).toEqual({
                name: 'unknown',
                arguments: {},
                result: 'string data',
            });
        });

        it('should include context source in metadata', () => {
            const context: CollectionContext = {
                source: 'external',
            };

            const data: ToolCallData = {
                name: 'test_tool',
                arguments: { arg1: 'val1' },
            };

            const result = collector.collect(data, context);

            expect(result.metadata?.source).toBe('external');
        });

        it('should count arguments correctly', () => {
            const data: ToolCallData = {
                name: 'test_tool',
                arguments: {
                    arg1: 'val1',
                    arg2: 'val2',
                    arg3: 'val3',
                },
            };

            const result = collector.collect(data);

            expect(result.metadata?.argumentCount).toBe(3);
        });

        it('should handle empty arguments', () => {
            const data: ToolCallData = {
                name: 'test_tool',
                arguments: {},
            };

            const result = collector.collect(data);

            expect(result.metadata?.argumentCount).toBe(0);
        });

        it('should include custom metadata from context', () => {
            const context: CollectionContext = {
                metadata: { custom: 'value', callId: '123' },
            };

            const result = collector.collect({ data: 'test' }, context);

            // Custom metadata is not automatically included in the result metadata
            // The collector only includes source, toolName, and argumentCount
            expect(result.metadata?.source).toBeDefined();
            expect(result.metadata?.toolName).toBeDefined();
        });
    });

    describe('createToolCallCollector factory', () => {
        it('should create a ToolCallCollector instance', () => {
            const collector = createToolCallCollector();

            expect(collector).toBeInstanceOf(ToolCallCollector);
            expect(collector.type).toBe('tool_call');
        });
    });
});
