import XMLToolCallingParser from '../XMLToolCallingParser';

describe('XMLToolCallingParser', () => {
    let parser: XMLToolCallingParser;

    beforeEach(() => {
        parser = new XMLToolCallingParser();
    });

    describe('processMessage', () => {
        it('should parse plain text content', () => {
            const message = 'Hello, world!';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'text',
                content: 'Hello, world!',
            });
        });

        it('should parse a simple tool call with no parameters', () => {
            const message = '<attempt_completion></attempt_completion>';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'tool_use',
                name: 'attempt_completion',
                params: {},
                partial: false,
            });
        });

        it('should parse a tool call with a single parameter', () => {
            const message = '<read_file><path>test.txt</path></read_file>';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'tool_use',
                name: 'read_file',
                params: { path: 'test.txt' },
                partial: false,
            });
        });

        it('should parse a tool call with multiple parameters', () => {
            const message = '<execute_command><command>ls -la</command><cwd>/workspace</cwd></execute_command>';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'tool_use',
                name: 'execute_command',
                params: { command: 'ls -la', cwd: '/workspace' },
                partial: false,
            });
        });

        it('should parse text followed by a tool call', () => {
            const message = 'I will read the file.<read_file><path>test.txt</path></read_file>';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                type: 'text',
                content: 'I will read the file.',
            });
            expect(result[1]).toEqual({
                type: 'tool_use',
                name: 'read_file',
                params: { path: 'test.txt' },
                partial: false,
            });
        });

        it('should parse multiple tool calls', () => {
            const message = '<read_file><path>file1.txt</path></read_file><read_file><path>file2.txt</path></read_file>';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                type: 'tool_use',
                name: 'read_file',
                params: { path: 'file1.txt' },
                partial: false,
            });
            expect(result[1]).toEqual({
                type: 'tool_use',
                name: 'read_file',
                params: { path: 'file2.txt' },
                partial: false,
            });
        });

        it('should parse text between tool calls', () => {
            const message = '<read_file><path>file1.txt</path></read_file>Now reading another file.<read_file><path>file2.txt</path></read_file>';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({
                type: 'tool_use',
                name: 'read_file',
                params: { path: 'file1.txt' },
                partial: false,
            });
            expect(result[1]).toEqual({
                type: 'text',
                content: 'Now reading another file.',
            });
            expect(result[2]).toEqual({
                type: 'tool_use',
                name: 'read_file',
                params: { path: 'file2.txt' },
                partial: false,
            });
        });

        it('should handle content parameter with newlines', () => {
            const message = '<write_to_file><path>test.txt</path><content>\nLine 1\nLine 2\n</content></write_to_file>';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'tool_use',
                name: 'write_to_file',
                params: {
                    path: 'test.txt',
                    content: 'Line 1\nLine 2',
                },
                partial: false,
            });
        });

        // it('should handle write_to_file with content containing closing tags', () => {
        //     const message = '<write_to_file><path>test.txt</path><content>Some content with </content> inside</content></write_to_file>';
        //     const result = parser.processMessage(message);

        //     expect(result).toHaveLength(1);
        //     expect(result[0]).toEqual({
        //         type: 'tool_use',
        //         name: 'write_to_file',
        //         params: {
        //             path: 'test.txt',
        //             content: 'Some content with </content> inside',
        //         },
        //         partial: false,
        //     });
        // });

        it('should handle attempt_completion with result', () => {
            const message = '<attempt_completion><result>Task completed successfully!</result></attempt_completion>';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'tool_use',
                name: 'attempt_completion',
                params: { result: 'Task completed successfully!' },
                partial: false,
            });
        });

        it('should handle incomplete tool call (partial)', () => {
            const message = '<read_file><path>test.txt</path>';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'tool_use',
                name: 'read_file',
                params: { path: 'test.txt' },
                partial: true,
            });
        });

        it('should handle empty message', () => {
            const message = '';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(0);
        });

        it('should handle whitespace-only message', () => {
            const message = '   \n\t  ';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(0);
        });

        it('should handle text with leading/trailing whitespace', () => {
            const message = '  Hello world  ';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'text',
                content: 'Hello world',
            });
        });

        it('should handle complex nested scenario', () => {
            const message = `I'll help you with that.
<read_file><path>package.json</path></read_file>
Let me check the dependencies.`;
            const result = parser.processMessage(message);

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({
                type: 'text',
                content: "I'll help you with that.",
            });
            expect(result[1]).toEqual({
                type: 'tool_use',
                name: 'read_file',
                params: { path: 'package.json' },
                partial: false,
            });
            expect(result[2]).toEqual({
                type: 'text',
                content: 'Let me check the dependencies.',
            });
        });

        it('should handle browser_action with multiple parameters', () => {
            const message = '<browser_action><action>click</action><coordinate>100,200@800x600</coordinate></browser_action>';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'tool_use',
                name: 'browser_action',
                params: {
                    action: 'click',
                    coordinate: '100,200@800x600',
                },
                partial: false,
            });
        });

        it('should handle search_files with regex and file_pattern', () => {
            const message = '<search_files><path>/workspace</path><regex>import.*React</regex><file_pattern>*.ts</file_pattern></search_files>';
            const result = parser.processMessage(message);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'tool_use',
                name: 'search_files',
                params: {
                    path: '/workspace',
                    regex: 'import.*React',
                    file_pattern: '*.ts',
                },
                partial: false,
            });
        });
    });
});
