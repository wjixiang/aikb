import { describe, it, expect, beforeEach } from 'vitest';
import { AssistantMessageParser } from '../AssistantMessageParser';
import { AssistantMessageContent, TextContent, ToolUse } from '../assistantMessageTypes';

describe('AssistantMessageParser', () => {
    let parser: AssistantMessageParser;

    beforeEach(() => {
        parser = new AssistantMessageParser();
    });

    describe('Constructor and Initialization', () => {
        it('should initialize with empty state', () => {
            expect(parser.getContentBlocks()).toEqual([]);
        });
    });

    describe('reset', () => {
        it('should reset parser state to initial values', () => {
            // Process some content first
            parser.processChunk('Hello world');
            parser.finalizeContentBlocks();

            // Reset
            parser.reset();

            // Check state is reset
            expect(parser.getContentBlocks()).toEqual([]);
        });
    });

    describe('getContentBlocks', () => {
        it('should return a shallow copy of content blocks', () => {
            parser.processChunk('Hello');
            const blocks1 = parser.getContentBlocks();
            const blocks2 = parser.getContentBlocks();

            expect(blocks1).toEqual(blocks2);
            expect(blocks1).not.toBe(blocks2); // Different references
        });
    });

    describe.only('processChunk - Text Content', () => {
        it('should process simple text content', () => {
            const result = parser.processChunk('Hello world');
            console.log(result)
            expect(result[0].type).toBe('text');
            expect((result[0] as TextContent).content).toBe('Hello world');
            expect(result[0].partial).toBe(true);
        });

    });

    describe('processChunk - Tool Use', () => {
        it('should detect tool use opening tags', () => {
            const result = parser.processChunk('<read_file>');

            expect(result[1].type).toBe('tool_use');
            expect((result[1] as ToolUse).name).toBe('read_file');
            expect((result[1] as ToolUse).partial).toBe(true);
            expect((result[1] as ToolUse).params).toEqual({});
        });

        it('should handle semantic_search tool', () => {
            const result = parser.processChunk('semantic_search');

            expect((result[1] as ToolUse).name).toBe('semantic_search');
        });

        it('should process tool use with parameters', () => {
            parser.processChunk('<read_file>');
            parser.processChunk('<path>test.txt</path>');
            parser.processChunk('</read_file>');

            const result = parser.getContentBlocks();
            const toolUse = result.find(block => block.type === 'tool_use') as ToolUse;

            expect(toolUse.params['path']).toBe('test.txt');
            expect(toolUse.partial).toBe(false);
        });

        it('should handle multiple parameters in a tool use', () => {
            parser.processChunk('<execute_command>');
            parser.processChunk('<command>npm test</command>');
            parser.processChunk('<cwd>/workspace</cwd>');
            parser.processChunk('</execute_command>');

            const result = parser.getContentBlocks();
            const toolUse = result.find(block => block.type === 'tool_use') as ToolUse;

            expect(toolUse.params['command']).toBe('npm test');
            expect(toolUse.params['cwd']).toBe('/workspace');
            expect(toolUse.partial).toBe(false);
        });
    })
})