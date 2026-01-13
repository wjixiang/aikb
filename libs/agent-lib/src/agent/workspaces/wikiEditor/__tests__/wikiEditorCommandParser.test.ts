import { describe, it, expect } from 'vitest';
import {
    parseXMLCommands,
    parseXMLCommand,
    CommandParseError
} from '../wikiEditorCommandParser';
import {
    EditCommandType,
    InsertCommand,
    ReplaceCommand,
    DeleteCommand,
    AppendCommand,
    PrependCommand,
    MoveCommand,
    CopyCommand,
    BatchCommand
} from '../wikiEditorCommandTypes';

describe('parseXMLCommands', () => {
    describe('INSERT command', () => {
        it('should parse insert with position', () => {
            const xml = '<insert><position>0</position><content>Test</content></insert>';
            const commands = parseXMLCommands(xml);
            console.log(commands)
            expect(commands).toHaveLength(1);
            expect(commands[0].type).toBe(EditCommandType.INSERT);
            const cmd = commands[0] as InsertCommand;
            expect(cmd.position).toBe(0);
            expect(cmd.content).toBe('Test');
        });

        it('should parse insert with after marker', () => {
            const xml = '<insert><after>## Intro</after><content>New section</content></insert>';
            const commands = parseXMLCommands(xml);
            expect(commands).toHaveLength(1);
            const cmd = commands[0] as InsertCommand;
            expect(cmd.after).toBe('## Intro');
            expect(cmd.content).toBe('New section');
        });

        it('should parse insert with before marker', () => {
            const xml = '<insert><before>## Conclusion</before><content>New section</content></insert>';
            const commands = parseXMLCommands(xml);
            expect(commands).toHaveLength(1);
            const cmd = commands[0] as InsertCommand;
            expect(cmd.before).toBe('## Conclusion');
            expect(cmd.content).toBe('New section');
        });

        it('should parse insert with multi-line content', () => {
            const xml = `<insert>
  <position>0</position>
  <content>## New Section

This is multi-line content.
</content>
</insert>`;
            const commands = parseXMLCommands(xml);
            expect(commands).toHaveLength(1);
            const cmd = commands[0] as InsertCommand;
            expect(cmd.content).toContain('## New Section');
            expect(cmd.content).toContain('This is multi-line content.');
        });

        it('should throw error for insert without positioning', () => {
            const xml = '<insert><content>Test</content></insert>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('requires one of: position, after, or before');
        });

        it('should throw error for insert with multiple positioning methods', () => {
            const xml = '<insert><position>0</position><after>Test</after><content>Content</content></insert>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('can only use one of');
        });
    });

    describe('REPLACE command', () => {
        it('should parse replace command', () => {
            const xml = '<replace><search>old</search><replace_text>new</replace_text></replace>';
            const commands = parseXMLCommands(xml);
            expect(commands).toHaveLength(1);
            const cmd = commands[0] as ReplaceCommand;
            expect(cmd.search).toBe('old');
            expect(cmd.replace).toBe('new');
            expect(cmd.replaceAll).toBe(false);
            expect(cmd.caseSensitive).toBe(true);
        });

        it('should parse replace with replace_all', () => {
            const xml = '<replace><search>old</search><replace_text>new</replace_text><replace_all>true</replace_all></replace>';
            const commands = parseXMLCommands(xml);
            const cmd = commands[0] as ReplaceCommand;
            expect(cmd.replaceAll).toBe(true);
        });

        it('should parse replace with case_sensitive false', () => {
            const xml = '<replace><search>old</search><replace_text>new</replace_text><case_sensitive>false</case_sensitive></replace>';
            const commands = parseXMLCommands(xml);
            const cmd = commands[0] as ReplaceCommand;
            expect(cmd.caseSensitive).toBe(false);
        });

        it('should throw error for replace without search', () => {
            const xml = '<replace><replace_text>new</replace_text></replace>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('requires search parameter');
        });
    });

    describe('DELETE command', () => {
        it('should parse delete with search', () => {
            const xml = '<delete><search>remove this</search></delete>';
            const commands = parseXMLCommands(xml);
            expect(commands).toHaveLength(1);
            const cmd = commands[0] as DeleteCommand;
            expect(cmd.search).toBe('remove this');
            expect(cmd.deleteAll).toBe(false);
            expect(cmd.caseSensitive).toBe(true);
        });

        it('should parse delete with range', () => {
            const xml = '<delete><start>0</start><end>100</end></delete>';
            const commands = parseXMLCommands(xml);
            const cmd = commands[0] as DeleteCommand;
            expect(cmd.start).toBe(0);
            expect(cmd.end).toBe(100);
        });

        it('should parse delete with delete_all', () => {
            const xml = '<delete><search>remove</search><delete_all>true</delete_all></delete>';
            const commands = parseXMLCommands(xml);
            const cmd = commands[0] as DeleteCommand;
            expect(cmd.deleteAll).toBe(true);
        });

        it('should throw error for delete without search or range', () => {
            const xml = '<delete></delete>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('requires search parameter or start/end range');
        });

        it('should throw error for delete with incomplete range', () => {
            const xml = '<delete><start>0</start></delete>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('both start and end parameters are required');
        });

        it('should throw error for delete with invalid range', () => {
            const xml = '<delete><start>100</start><end>50</end></delete>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('Start position cannot be greater than end position');
        });
    });

    describe('APPEND command', () => {
        it('should parse append command', () => {
            const xml = '<append><content>Add this</content></append>';
            const commands = parseXMLCommands(xml);
            expect(commands).toHaveLength(1);
            const cmd = commands[0] as AppendCommand;
            expect(cmd.content).toBe('Add this');
            expect(cmd.newLine).toBe(true);
        });

        it('should parse append with new_line false', () => {
            const xml = '<append><content>Add this</content><new_line>false</new_line></append>';
            const commands = parseXMLCommands(xml);
            const cmd = commands[0] as AppendCommand;
            expect(cmd.newLine).toBe(false);
        });
    });

    describe('PREPEND command', () => {
        it('should parse prepend command', () => {
            const xml = '<prepend><content>Add this</content></prepend>';
            const commands = parseXMLCommands(xml);
            expect(commands).toHaveLength(1);
            const cmd = commands[0] as PrependCommand;
            expect(cmd.content).toBe('Add this');
            expect(cmd.newLine).toBe(true);
        });

        it('should parse prepend with new_line false', () => {
            const xml = '<prepend><content>Add this</content><new_line>false</new_line></prepend>';
            const commands = parseXMLCommands(xml);
            const cmd = commands[0] as PrependCommand;
            expect(cmd.newLine).toBe(false);
        });
    });

    describe('MOVE command', () => {
        it('should parse move with after marker', () => {
            const xml = '<move><search>text to move</search><after>## Section 1</after></move>';
            const commands = parseXMLCommands(xml);
            expect(commands).toHaveLength(1);
            const cmd = commands[0] as MoveCommand;
            expect(cmd.search).toBe('text to move');
            expect(cmd.after).toBe('## Section 1');
        });

        it('should parse move with before marker', () => {
            const xml = '<move><search>text to move</search><before>## Section 2</before></move>';
            const commands = parseXMLCommands(xml);
            const cmd = commands[0] as MoveCommand;
            expect(cmd.before).toBe('## Section 2');
        });

        it('should parse move with position', () => {
            const xml = '<move><search>text to move</search><position>50</position></move>';
            const commands = parseXMLCommands(xml);
            const cmd = commands[0] as MoveCommand;
            expect(cmd.position).toBe(50);
        });

        it('should throw error for move without search', () => {
            const xml = '<move><after>Test</after></move>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('requires search parameter');
        });

        it('should throw error for move without positioning', () => {
            const xml = '<move><search>text</search></move>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('requires one of: position, after, or before');
        });
    });

    describe('COPY command', () => {
        it('should parse copy with after marker', () => {
            const xml = '<copy><search>text to copy</search><after>## Section 1</after></copy>';
            const commands = parseXMLCommands(xml);
            expect(commands).toHaveLength(1);
            const cmd = commands[0] as CopyCommand;
            expect(cmd.search).toBe('text to copy');
            expect(cmd.after).toBe('## Section 1');
        });

        it('should parse copy with position', () => {
            const xml = '<copy><search>text to copy</search><position>100</position></copy>';
            const commands = parseXMLCommands(xml);
            const cmd = commands[0] as CopyCommand;
            expect(cmd.position).toBe(100);
        });

        it('should throw error for copy without search', () => {
            const xml = '<copy><after>Test</after></copy>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('requires search parameter');
        });
    });

    describe('BATCH command', () => {
        it('should parse batch with nested commands', () => {
            const xml = `<batch>
  <stop_on_error>false</stop_on_error>
  <commands>
    <append><content>Content 1</content></append>
    <replace><search>old</search><replace_text>new</replace_text></replace>
  </commands>
</batch>`;
            const commands = parseXMLCommands(xml);
            console.log(commands)
            expect(commands).toHaveLength(1);
            const cmd = commands[0] as BatchCommand;
            expect(cmd.type).toBe(EditCommandType.BATCH);
            expect(cmd.stopOnError).toBe(false);
            expect(cmd.commands).toHaveLength(2);
            expect(cmd.commands[0].type).toBe(EditCommandType.APPEND);
            expect(cmd.commands[1].type).toBe(EditCommandType.REPLACE);
        });

        it('should throw error for batch without commands', () => {
            const xml = '<batch></batch>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('requires at least one nested command');
        });
    });

    describe('Multiple commands', () => {
        it('should parse multiple commands in sequence', () => {
            const xml = `
<append><content>First</content></append>
<replace><search>old</search><replace_text>new</replace_text></replace>
<insert><position>0</position><content>Second</content></insert>
`;
            const commands = parseXMLCommands(xml);
            expect(commands).toHaveLength(3);
            expect(commands[0].type).toBe(EditCommandType.APPEND);
            expect(commands[1].type).toBe(EditCommandType.REPLACE);
            expect(commands[2].type).toBe(EditCommandType.INSERT);
        });
    });

    describe('Mixed content', () => {
        it('should skip non-XML text content', () => {
            const xml = `Here is some text
<append><content>Actual command</content></append>
More text here`;
            const commands = parseXMLCommands(xml);
            expect(commands).toHaveLength(1);
            expect(commands[0].type).toBe(EditCommandType.APPEND);
        });
    });

    describe('Error handling', () => {
        it('should throw error for unknown command type', () => {
            const xml = '<unknown><content>test</content></unknown>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('Unknown command type: unknown');
        });

        it('should throw error for unclosed tag', () => {
            const xml = '<insert><position>0</position>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('Unclosed tag');
        });

        it('should throw error for mismatched closing tag', () => {
            const xml = '<insert></replace>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('Mismatched closing tag');
        });

        it('should throw error for empty tag name', () => {
            const xml = '<></>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('Empty tag name');
        });
    });

    describe('parseXMLCommand convenience function', () => {
        it('should parse single command', () => {
            const xml = '<append><content>Test</content></append>';
            const command = parseXMLCommand(xml);
            expect(command.type).toBe(EditCommandType.APPEND);
        });

        it('should throw error for no commands', () => {
            const xml = 'Just text';
            expect(() => parseXMLCommand(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommand(xml)).toThrow('No commands found');
        });

        it('should throw error for multiple commands', () => {
            const xml = '<append><content>First</content></append><append><content>Second</content></append>';
            expect(() => parseXMLCommand(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommand(xml)).toThrow('Multiple commands found');
        });
    });

    describe('Boolean parsing', () => {
        it('should parse true as true', () => {
            const xml = '<replace><search>old</search><replace_text>new</replace_text><replace_all>true</replace_all></replace>';
            const cmd = parseXMLCommands(xml)[0] as ReplaceCommand;
            expect(cmd.replaceAll).toBe(true);
        });

        it('should parse false as false', () => {
            const xml = '<replace><search>old</search><replace_text>new</replace_text><replace_all>false</replace_all></replace>';
            const cmd = parseXMLCommands(xml)[0] as ReplaceCommand;
            expect(cmd.replaceAll).toBe(false);
        });

        it('should parse 1 as true', () => {
            const xml = '<replace><search>old</search><replace_text>new</replace_text><replace_all>1</replace_all></replace>';
            const cmd = parseXMLCommands(xml)[0] as ReplaceCommand;
            expect(cmd.replaceAll).toBe(true);
        });

        it('should parse 0 as false', () => {
            const xml = '<replace><search>old</search><replace_text>new</replace_text><replace_all>0</replace_all></replace>';
            const cmd = parseXMLCommands(xml)[0] as ReplaceCommand;
            expect(cmd.replaceAll).toBe(false);
        });

        it('should parse yes as true', () => {
            const xml = '<replace><search>old</search><replace_text>new</replace_text><replace_all>yes</replace_all></replace>';
            const cmd = parseXMLCommands(xml)[0] as ReplaceCommand;
            expect(cmd.replaceAll).toBe(true);
        });

        it('should use default for missing boolean', () => {
            const xml = '<replace><search>old</search><replace_text>new</replace_text></replace>';
            const cmd = parseXMLCommands(xml)[0] as ReplaceCommand;
            expect(cmd.replaceAll).toBe(false); // default
        });
    });

    describe('Integer parsing', () => {
        it('should parse valid integer', () => {
            const xml = '<insert><position>42</position><content>Test</content></insert>';
            const cmd = parseXMLCommands(xml)[0] as InsertCommand;
            expect(cmd.position).toBe(42);
        });

        it('should parse negative integer', () => {
            const xml = '<insert><position>-5</position><content>Test</content></insert>';
            const cmd = parseXMLCommands(xml)[0] as InsertCommand;
            expect(cmd.position).toBe(-5);
        });

        it('should handle invalid integer as undefined', () => {
            const xml = '<insert><position>abc</position><content>Test</content></insert>';
            expect(() => parseXMLCommands(xml)).toThrow(CommandParseError);
            expect(() => parseXMLCommands(xml)).toThrow('Insert command requires one of: position, after, or before parameter');
        });

        it('should handle missing integer as undefined', () => {
            const xml = '<insert><content>Test</content></insert>';
            expect(() => parseXMLCommands(xml)).toThrow(); // No positioning method
        });
    });

    describe('Real-world examples', () => {
        it('should parse LLM response with explanation', () => {
            const xml = `I'll add a new section to the document.

<insert>
  <after>## Introduction</after>
  <content>## Getting Started

This is the getting started section.
</content>
</insert>

That should do it!`;
            const commands = parseXMLCommands(xml);
            expect(commands).toHaveLength(1);
            const cmd = commands[0] as InsertCommand;
            expect(cmd.after).toBe('## Introduction');
            expect(cmd.content).toContain('## Getting Started');
        });

        it('should parse complex batch operation', () => {
            const xml = `<batch>
  <stop_on_error>false</stop_on_error>
  <commands>
    <append>
      <content>## Additional Section

More content here.
</content>
    </append>
    <replace>
      <search>old term</search>
      <replace_text>new term</replace_text>
      <replace_all>true</replace_all>
    </replace>
    <insert>
      <before>## Conclusion</before>
      <content>## Summary

This is a summary.
</content>
    </insert>
  </commands>
</batch>`;
            const commands = parseXMLCommands(xml);
            expect(commands).toHaveLength(1);
            const batch = commands[0] as BatchCommand;
            expect(batch.commands).toHaveLength(3);
            expect(batch.commands[0].type).toBe(EditCommandType.APPEND);
            expect(batch.commands[1].type).toBe(EditCommandType.REPLACE);
            expect(batch.commands[2].type).toBe(EditCommandType.INSERT);
        });
    });
});
