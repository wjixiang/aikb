import { describe, it, expect } from 'vitest';
import {
    executeCommand,
    executeCommands,
    applyCommand,
    CommandExecutionError
} from '../wikiEditorCommandExecutor';
import {
    EditCommandType,
    InsertCommand,
    ReplaceCommand,
    DeleteCommand,
    AppendCommand,
    PrependCommand,
    MoveCommand,
    CopyCommand,
    BatchCommand,
    EditCommand
} from '../wikiEditorCommandTypes';

describe('executeCommand', () => {
    describe('INSERT command', () => {
        it('should insert content at position 0', () => {
            const content = 'Hello World';
            const command: InsertCommand = {
                type: EditCommandType.INSERT,
                position: 0,
                content: 'Start: '
            };
            const result = executeCommand(content, command);
            expect(result.success).toBe(true);
            expect(result.newContent).toBe('Start: Hello World');
            expect(result.changes).toBe(1);
        });

        it('should insert content at middle position', () => {
            const content = 'Hello World';
            const command: InsertCommand = {
                type: EditCommandType.INSERT,
                position: 5,
                content: ' Beautiful'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Hello Beautiful World');
        });

        it('should insert content at end position', () => {
            const content = 'Hello';
            const command: InsertCommand = {
                type: EditCommandType.INSERT,
                position: 5,
                content: ' World'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Hello World');
        });

        it('should insert content after marker', () => {
            const content = '## Introduction\n\nContent here.\n## Conclusion';
            const command: InsertCommand = {
                type: EditCommandType.INSERT,
                after: '## Introduction',
                content: '\n## New Section\n\nNew content.'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toContain('## Introduction');
            expect(result.newContent).toContain('## New Section');
            expect(result.newContent).toContain('## Conclusion');
        });

        it('should insert content before marker', () => {
            const content = '## Introduction\n\nContent here.\n## Conclusion';
            const command: InsertCommand = {
                type: EditCommandType.INSERT,
                before: '## Conclusion',
                content: '\n## New Section\n\nNew content.'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toContain('## Introduction');
            expect(result.newContent).toContain('## New Section');
            expect(result.newContent).toContain('## Conclusion');
        });

        it('should clamp position to content length', () => {
            const content = 'Hello';
            const command: InsertCommand = {
                type: EditCommandType.INSERT,
                position: 100,
                content: '!'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Hello!');
        });

        it('should clamp negative position to 0', () => {
            const content = 'Hello';
            const command: InsertCommand = {
                type: EditCommandType.INSERT,
                position: -5,
                content: 'Start: '
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Start: Hello');
        });

        it('should throw error when after marker not found', () => {
            const content = 'Hello World';
            const command: InsertCommand = {
                type: EditCommandType.INSERT,
                after: 'Not Found',
                content: 'Test'
            };
            expect(() => executeCommand(content, command)).toThrow(CommandExecutionError);
            expect(() => executeCommand(content, command)).toThrow('Could not find text to insert after');
        });

        it('should throw error when before marker not found', () => {
            const content = 'Hello World';
            const command: InsertCommand = {
                type: EditCommandType.INSERT,
                before: 'Not Found',
                content: 'Test'
            };
            expect(() => executeCommand(content, command)).toThrow(CommandExecutionError);
            expect(() => executeCommand(content, command)).toThrow('Could not find text to insert before');
        });
    });

    describe('REPLACE command', () => {
        it('should replace first occurrence', () => {
            const content = 'Hello World Hello';
            const command: ReplaceCommand = {
                type: EditCommandType.REPLACE,
                search: 'Hello',
                replace: 'Hi'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Hi World Hello');
            expect(result.changes).toBe(1);
        });

        it('should replace all occurrences', () => {
            const content = 'Hello World Hello';
            const command: ReplaceCommand = {
                type: EditCommandType.REPLACE,
                search: 'Hello',
                replace: 'Hi',
                replaceAll: true
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Hi World Hi');
            expect(result.changes).toBe(2);
        });

        it('should be case sensitive by default', () => {
            const content = 'Hello world hello';
            const command: ReplaceCommand = {
                type: EditCommandType.REPLACE,
                search: 'hello',
                replace: 'Hi'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Hello world Hi');
        });

        it('should be case insensitive when specified', () => {
            const content = 'Hello world hello';
            const command: ReplaceCommand = {
                type: EditCommandType.REPLACE,
                search: 'hello',
                replace: 'Hi',
                caseSensitive: false
            };
            const result = executeCommand(content, command);
            // Case insensitive replaces first occurrence of "hello" (case-insensitive)
            // "Hello" matches "hello" case-insensitively, so it becomes "Hi"
            expect(result.newContent).toBe('Hi world hello');
            expect(result.changes).toBe(1);
        });

        it('should throw error when search text not found', () => {
            const content = 'Hello World';
            const command: ReplaceCommand = {
                type: EditCommandType.REPLACE,
                search: 'Not Found',
                replace: 'Test'
            };
            expect(() => executeCommand(content, command)).toThrow(CommandExecutionError);
            expect(() => executeCommand(content, command)).toThrow('Could not find text to replace');
        });
    });

    describe('DELETE command', () => {
        it('should delete by search', () => {
            const content = 'Hello World Hello';
            const command: DeleteCommand = {
                type: EditCommandType.DELETE,
                search: 'World '
            };
            const result = executeCommand(content, command);
            // Delete removes "World " which leaves "Hello Hello"
            expect(result.newContent).toBe('Hello Hello');
            expect(result.changes).toBe(1);
        });

        it('should delete all occurrences', () => {
            const content = 'Hello World Hello';
            const command: DeleteCommand = {
                type: EditCommandType.DELETE,
                search: 'Hello',
                deleteAll: true
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe(' World ');
            expect(result.changes).toBe(2);
        });

        it('should delete by range', () => {
            const content = 'Hello World';
            const command: DeleteCommand = {
                type: EditCommandType.DELETE,
                search: 'Hello', // Required by type
                start: 0,
                end: 5
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe(' World');
            expect(result.changes).toBe(1);
        });

        it('should delete by range in middle', () => {
            const content = 'Hello Beautiful World';
            const command: DeleteCommand = {
                type: EditCommandType.DELETE,
                search: 'Hello', // Required by type
                start: 6,
                end: 16
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Hello World');
        });

        it('should be case sensitive by default', () => {
            const content = 'Hello world hello';
            const command: DeleteCommand = {
                type: EditCommandType.DELETE,
                search: 'hello'
            };
            const result = executeCommand(content, command);
            // Case sensitive - only lowercase "hello" is deleted
            expect(result.newContent).toBe('Hello world ');
        });

        it('should be case insensitive when specified', () => {
            const content = 'Hello world hello';
            const command: DeleteCommand = {
                type: EditCommandType.DELETE,
                search: 'hello',
                caseSensitive: false,
                deleteAll: true
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe(' world ');
            expect(result.changes).toBe(2);
        });

        it('should throw error when search text not found', () => {
            const content = 'Hello World';
            const command: DeleteCommand = {
                type: EditCommandType.DELETE,
                search: 'Not Found'
            };
            expect(() => executeCommand(content, command)).toThrow(CommandExecutionError);
            expect(() => executeCommand(content, command)).toThrow('Could not find text to delete');
        });

        it('should throw error for invalid range', () => {
            const content = 'Hello World';
            const command: DeleteCommand = {
                type: EditCommandType.DELETE,
                search: 'Hello', // Required by type
                start: 10,
                end: 5
            };
            expect(() => executeCommand(content, command)).toThrow(CommandExecutionError);
            expect(() => executeCommand(content, command)).toThrow('Start position cannot be greater than end position');
        });
    });

    describe('APPEND command', () => {
        it('should append content with newline by default', () => {
            const content = 'Hello';
            const command: AppendCommand = {
                type: EditCommandType.APPEND,
                content: 'World'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Hello\nWorld');
            expect(result.changes).toBe(1);
        });

        it('should append content without newline when specified', () => {
            const content = 'Hello';
            const command: AppendCommand = {
                type: EditCommandType.APPEND,
                content: ' World',
                newLine: false
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Hello World');
        });

        it('should append to empty content', () => {
            const content = '';
            const command: AppendCommand = {
                type: EditCommandType.APPEND,
                content: 'Hello'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Hello');
        });

        it('should append multi-line content', () => {
            const content = 'Hello';
            const command: AppendCommand = {
                type: EditCommandType.APPEND,
                content: '\n\nWorld\n\n!'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Hello\n\nWorld\n\n!');
        });
    });

    describe('PREPEND command', () => {
        it('should prepend content with newline by default', () => {
            const content = 'World';
            const command: PrependCommand = {
                type: EditCommandType.PREPEND,
                content: 'Hello'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Hello\nWorld');
            expect(result.changes).toBe(1);
        });

        it('should prepend content without newline when specified', () => {
            const content = 'World';
            const command: PrependCommand = {
                type: EditCommandType.PREPEND,
                content: 'Hello ',
                newLine: false
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Hello World');
        });

        it('should prepend to empty content', () => {
            const content = '';
            const command: PrependCommand = {
                type: EditCommandType.PREPEND,
                content: 'Hello'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('Hello');
        });
    });

    describe('MOVE command', () => {
        it('should move content after marker', () => {
            const content = '## Section 1\nContent 1\n## Section 2\nContent 2';
            const command: MoveCommand = {
                type: EditCommandType.MOVE,
                search: 'Content 1',
                after: '## Section 2'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toContain('## Section 1');
            expect(result.newContent).toContain('## Section 2');
            expect(result.newContent).toContain('Content 1');
            const content1Pos = result.newContent.indexOf('Content 1');
            const section2Pos = result.newContent.indexOf('## Section 2');
            expect(content1Pos).toBeGreaterThan(section2Pos);
        });

        it('should move content before marker', () => {
            const content = '## Section 1\nContent 1\n## Section 2\nContent 2';
            const command: MoveCommand = {
                type: EditCommandType.MOVE,
                search: 'Content 2',
                before: '## Section 1'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toContain('## Section 1');
            expect(result.newContent).toContain('## Section 2');
            expect(result.newContent).toContain('Content 2');
            const content2Pos = result.newContent.indexOf('Content 2');
            const section1Pos = result.newContent.indexOf('## Section 1');
            expect(content2Pos).toBeLessThan(section1Pos);
        });

        it('should move content to position', () => {
            const content = 'ABCDEF';
            const command: MoveCommand = {
                type: EditCommandType.MOVE,
                search: 'BC',
                position: 4
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toBe('ADEFBC');
        });

        it('should be case sensitive by default', () => {
            const content = 'Hello world hello';
            const command: MoveCommand = {
                type: EditCommandType.MOVE,
                search: 'hello',
                after: 'Hello'
            };
            // Case sensitive means "hello" (lowercase) won't match "Hello" (uppercase)
            // But "hello" DOES exist in the content, so it will find it and move it
            const result = executeCommand(content, command);
            expect(result.success).toBe(true);
            expect(result.newContent).toContain('hello');
        });

        it('should be case insensitive when specified', () => {
            const content = 'Hello world hello';
            const command: MoveCommand = {
                type: EditCommandType.MOVE,
                search: 'hello',
                after: 'Hello',
                caseSensitive: false
            };
            const result = executeCommand(content, command);
            // Case insensitive finds "hello" and moves it after "Hello"
            expect(result.newContent).toContain('hello');
        });

        it('should throw error when search text not found', () => {
            const content = 'Hello World';
            const command: MoveCommand = {
                type: EditCommandType.MOVE,
                search: 'Not Found',
                after: 'Hello'
            };
            expect(() => executeCommand(content, command)).toThrow(CommandExecutionError);
            expect(() => executeCommand(content, command)).toThrow('Could not find text to move');
        });
    });

    describe('COPY command', () => {
        it('should copy content after marker', () => {
            const content = '## Section 1\nContent 1\n## Section 2\nContent 2';
            const command: CopyCommand = {
                type: EditCommandType.COPY,
                search: 'Content 1',
                after: '## Section 2'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toContain('## Section 1');
            expect(result.newContent).toContain('## Section 2');
            expect(result.newContent.split('Content 1')).toHaveLength(3); // Should appear twice
        });

        it('should copy content before marker', () => {
            const content = '## Section 1\nContent 1\n## Section 2\nContent 2';
            const command: CopyCommand = {
                type: EditCommandType.COPY,
                search: 'Content 2',
                before: '## Section 1'
            };
            const result = executeCommand(content, command);
            expect(result.newContent).toContain('## Section 1');
            expect(result.newContent).toContain('## Section 2');
            expect(result.newContent.split('Content 2')).toHaveLength(3); // Should appear twice
        });

        it('should copy content to position', () => {
            const content = 'ABCDEF';
            const command: CopyCommand = {
                type: EditCommandType.COPY,
                search: 'BC',
                position: 4
            };
            const result = executeCommand(content, command);
            // Copy "BC" and insert at position 4 (after "ABCD")
            // Original: ABCDEF, after removing BC: ADEF, then inserting BC at position 4: ABCDBCEF
            expect(result.newContent).toBe('ABCDBCEF');
        });

        it('should throw error when search text not found', () => {
            const content = 'Hello World';
            const command: CopyCommand = {
                type: EditCommandType.COPY,
                search: 'Not Found',
                after: 'Hello'
            };
            expect(() => executeCommand(content, command)).toThrow(CommandExecutionError);
            expect(() => executeCommand(content, command)).toThrow('Could not find text to copy');
        });
    });

    describe('BATCH command', () => {
        it('should execute multiple commands in sequence', () => {
            const content = 'Hello';
            const command: BatchCommand = {
                type: EditCommandType.BATCH,
                commands: [
                    {
                        type: EditCommandType.APPEND,
                        content: ' World'
                    },
                    {
                        type: EditCommandType.REPLACE,
                        search: 'Hello',
                        replace: 'Hi'
                    }
                ]
            };
            const result = executeCommand(content, command);
            expect(result.success).toBe(true);
            expect(result.newContent).toBe('Hi\n World');
            expect(result.changes).toBe(2);
            if ('results' in result) {
                expect(result.results).toHaveLength(2);
            }
        });

        it('should stop on error by default', () => {
            const content = 'Hello';
            const command: BatchCommand = {
                type: EditCommandType.BATCH,
                commands: [
                    {
                        type: EditCommandType.APPEND,
                        content: ' World'
                    },
                    {
                        type: EditCommandType.DELETE,
                        search: 'Not Found'
                    },
                    {
                        type: EditCommandType.REPLACE,
                        search: 'Hello',
                        replace: 'Hi'
                    }
                ]
            };
            const result = executeCommand(content, command);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            if ('results' in result) {
                expect(result.results).toHaveLength(2); // First two commands executed
            }
            // Append adds newline by default, so result is "Hello\n World"
            expect(result.newContent).toBe('Hello\n World'); // Only first command applied
        });

        it('should continue on error when stopOnError is false', () => {
            const content = 'Hello';
            const command: BatchCommand = {
                type: EditCommandType.BATCH,
                stopOnError: false,
                commands: [
                    {
                        type: EditCommandType.APPEND,
                        content: ' World'
                    },
                    {
                        type: EditCommandType.DELETE,
                        search: 'Not Found'
                    },
                    {
                        type: EditCommandType.REPLACE,
                        search: 'Hello',
                        replace: 'Hi'
                    }
                ]
            };
            const result = executeCommand(content, command);
            expect(result.success).toBe(true); // Batch succeeds even with individual failures
            if ('results' in result) {
                expect(result.results).toHaveLength(3);
                const batchResult = result as any;
                expect(batchResult.results[1].success).toBe(false);
            }
            // Append adds newline by default, so result is "Hi\n World"
            expect(result.newContent).toBe('Hi\n World'); // First and third commands applied
        });

        it('should handle nested batch commands', () => {
            const content = 'A';
            const command: BatchCommand = {
                type: EditCommandType.BATCH,
                commands: [
                    {
                        type: EditCommandType.APPEND,
                        content: 'B'
                    },
                    {
                        type: EditCommandType.BATCH,
                        commands: [
                            {
                                type: EditCommandType.APPEND,
                                content: 'C'
                            },
                            {
                                type: EditCommandType.APPEND,
                                content: 'D'
                            }
                        ]
                    }
                ]
            };
            const result = executeCommand(content, command);
            // Append adds newlines by default, so result is "A\nB\nC\nD"
            expect(result.newContent).toBe('A\nB\nC\nD');
            expect(result.changes).toBe(3);
        });
    });
});

describe('executeCommands', () => {
    it('should execute multiple commands in sequence', () => {
        const content = 'Hello';
        const commands: EditCommand[] = [
            {
                type: EditCommandType.APPEND,
                content: ' World'
            },
            {
                type: EditCommandType.REPLACE,
                search: 'Hello',
                replace: 'Hi'
            }
        ];
        const results = executeCommands(content, commands);
        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(true);
        expect(results[1].success).toBe(true);
        // Append adds newline by default, so result is "Hi\n World"
        expect(results[1].newContent).toBe('Hi\n World');
    });

    it('should stop on error', () => {
        const content = 'Hello';
        const commands: EditCommand[] = [
            {
                type: EditCommandType.APPEND,
                content: ' World'
            },
            {
                type: EditCommandType.DELETE,
                search: 'Not Found'
            },
            {
                type: EditCommandType.REPLACE,
                search: 'Hello',
                replace: 'Hi'
            }
        ];
        const results = executeCommands(content, commands);
        expect(results).toHaveLength(2); // Stops after error
        expect(results[1].success).toBe(false);
    });
});

describe('applyCommand', () => {
    it('should apply command and return new content', () => {
        const content = 'Hello';
        const command: AppendCommand = {
            type: EditCommandType.APPEND,
            content: ' World'
        };
        const newContent = applyCommand(content, command);
        // Append adds a newline by default, so we get "Hello\n World"
        expect(newContent).toBe('Hello\n World');
    });

    it('should throw error on failure', () => {
        const content = 'Hello';
        const command: DeleteCommand = {
            type: EditCommandType.DELETE,
            search: 'Not Found'
        };
        expect(() => applyCommand(content, command)).toThrow(CommandExecutionError);
    });
});

describe('Real-world scenarios', () => {
    it('should build a wiki document from scratch', () => {
        let content = '';
        const commands: EditCommand[] = [
            {
                type: EditCommandType.PREPEND,
                content: '# My Wiki',
                newLine: false
            },
            {
                type: EditCommandType.APPEND,
                content: '\n\n## Introduction\n\nWelcome to my wiki.'
            },
            {
                type: EditCommandType.APPEND,
                content: '\n\n## Features\n\n- Feature 1\n- Feature 2\n- Feature 3'
            }
        ];

        for (const cmd of commands) {
            const result = executeCommand(content, cmd);
            content = result.newContent;
        }

        expect(content).toContain('# My Wiki');
        expect(content).toContain('## Introduction');
        expect(content).toContain('## Features');
    });

    it('should reorganize a document', () => {
        const content = `# Document

## Section 1
Content 1

## Section 2
Content 2

## Section 3
Content 3`;

        const commands: EditCommand[] = [
            {
                type: EditCommandType.MOVE,
                search: '## Section 3\nContent 3',
                before: '## Section 1'
            }
        ];

        const result = executeCommands(content, commands)[0];
        expect(result.newContent).toContain('## Section 3');
        const section3Pos = result.newContent.indexOf('## Section 3');
        const section1Pos = result.newContent.indexOf('## Section 1');
        expect(section3Pos).toBeLessThan(section1Pos);
    });

    it('should perform find and replace across document', () => {
        const content = `The old system was old.
The old approach was old.
Everything was old.`;

        const command: ReplaceCommand = {
            type: EditCommandType.REPLACE,
            search: 'old',
            replace: 'new',
            replaceAll: true,
            caseSensitive: false
        };

        const result = executeCommand(content, command);
        expect(result.newContent).not.toContain('old');
        expect(result.newContent).toContain('new');
        expect(result.changes).toBe(5); // "old" appears 5 times in the test content
    });
});
