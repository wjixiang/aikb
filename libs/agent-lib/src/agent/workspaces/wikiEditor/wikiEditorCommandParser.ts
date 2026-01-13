/**
 * Wiki Editor XML Command Parser
 * Parses XML-based editing commands into typed command objects
 */

import { z } from 'zod';
import {
    EditCommand,
    EditCommandType,
    InsertCommand,
    ReplaceCommand,
    DeleteCommand,
    AppendCommand,
    PrependCommand,
    MoveCommand,
    CopyCommand,
    BatchCommand,
    XML_TAGS
} from './wikiEditorCommandTypes';

/**
 * Error class for parsing errors
 */
export class CommandParseError extends Error {
    constructor(message: string, public readonly xml?: string) {
        super(message);
        this.name = 'CommandParseError';
    }
}

/**
 * Parse boolean string value
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (!value) return defaultValue;
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes';
}

/**
 * Parse integer string value
 */
function parseIntValue(value: string | undefined, defaultValue?: number): number | undefined {
    if (!value) return defaultValue;
    const parsed = parseInt(value.trim(), 10);
    if (isNaN(parsed)) return defaultValue;
    return parsed;
}

/**
 * Parse insert command
 */
function parseInsertCommand(params: Record<string, string>): InsertCommand {
    const position = parseIntValue(params[XML_TAGS.POSITION]);
    const after = params[XML_TAGS.AFTER]?.trim();
    const before = params[XML_TAGS.BEFORE]?.trim();
    const content = params[XML_TAGS.CONTENT] || '';

    // Validate that exactly one positioning method is provided
    const positionCount = [position, after, before].filter(v => v !== undefined).length;
    if (positionCount === 0) {
        throw new CommandParseError(
            'Insert command requires one of: position, after, or before parameter'
        );
    }
    if (positionCount > 1) {
        throw new CommandParseError(
            'Insert command can only use one of: position, after, or before parameter'
        );
    }

    return {
        type: EditCommandType.INSERT,
        position,
        after,
        before,
        content
    };
}

/**
 * Parse replace command
 */
function parseReplaceCommand(params: Record<string, string>): ReplaceCommand {
    const search = params[XML_TAGS.SEARCH]?.trim();
    const replaceText = params[XML_TAGS.REPLACE_TEXT] || '';
    const replaceAll = parseBoolean(params[XML_TAGS.REPLACE_ALL], false);
    const caseSensitive = parseBoolean(params[XML_TAGS.CASE_SENSITIVE], true);

    if (!search) {
        throw new CommandParseError('Replace command requires search parameter');
    }

    return {
        type: EditCommandType.REPLACE,
        search,
        replace: replaceText,
        replaceAll,
        caseSensitive
    };
}

/**
 * Parse delete command
 */
function parseDeleteCommand(params: Record<string, string>): DeleteCommand {
    const search = params[XML_TAGS.SEARCH]?.trim();
    const start = parseIntValue(params[XML_TAGS.START]);
    const end = parseIntValue(params[XML_TAGS.END]);
    const deleteAll = parseBoolean(params[XML_TAGS.DELETE_ALL], false);
    const caseSensitive = parseBoolean(params[XML_TAGS.CASE_SENSITIVE], true);

    // Validate that either search or start/end is provided
    const hasSearch = !!search;
    const hasRange = start !== undefined || end !== undefined;

    if (!hasSearch && !hasRange) {
        throw new CommandParseError('Delete command requires search parameter or start/end range');
    }

    if (hasRange) {
        if (start === undefined || end === undefined) {
            throw new CommandParseError('When using range, both start and end parameters are required');
        }
        if (start < 0 || end < 0) {
            throw new CommandParseError('Start and end positions must be non-negative');
        }
        if (start > end) {
            throw new CommandParseError('Start position cannot be greater than end position');
        }
    }

    return {
        type: EditCommandType.DELETE,
        search,
        deleteAll,
        caseSensitive,
        start,
        end
    };
}

/**
 * Parse append command
 */
function parseAppendCommand(params: Record<string, string>): AppendCommand {
    const content = params[XML_TAGS.CONTENT] || '';
    const newLine = parseBoolean(params[XML_TAGS.NEW_LINE], true);

    return {
        type: EditCommandType.APPEND,
        content,
        newLine
    };
}

/**
 * Parse prepend command
 */
function parsePrependCommand(params: Record<string, string>): PrependCommand {
    const content = params[XML_TAGS.CONTENT] || '';
    const newLine = parseBoolean(params[XML_TAGS.NEW_LINE], true);

    return {
        type: EditCommandType.PREPEND,
        content,
        newLine
    };
}

/**
 * Parse move command
 */
function parseMoveCommand(params: Record<string, string>): MoveCommand {
    const search = params[XML_TAGS.SEARCH]?.trim();
    const after = params[XML_TAGS.AFTER]?.trim();
    const before = params[XML_TAGS.BEFORE]?.trim();
    const position = parseIntValue(params[XML_TAGS.POSITION]);
    const caseSensitive = parseBoolean(params[XML_TAGS.CASE_SENSITIVE], true);

    if (!search) {
        throw new CommandParseError('Move command requires search parameter');
    }

    // Validate that exactly one positioning method is provided
    const positionCount = [position, after, before].filter(v => v !== undefined).length;
    if (positionCount === 0) {
        throw new CommandParseError(
            'Move command requires one of: position, after, or before parameter'
        );
    }
    if (positionCount > 1) {
        throw new CommandParseError(
            'Move command can only use one of: position, after, or before parameter'
        );
    }

    return {
        type: EditCommandType.MOVE,
        search,
        after,
        before,
        position,
        caseSensitive
    };
}

/**
 * Parse copy command
 */
function parseCopyCommand(params: Record<string, string>): CopyCommand {
    const search = params[XML_TAGS.SEARCH]?.trim();
    const after = params[XML_TAGS.AFTER]?.trim();
    const before = params[XML_TAGS.BEFORE]?.trim();
    const position = parseIntValue(params[XML_TAGS.POSITION]);
    const caseSensitive = parseBoolean(params[XML_TAGS.CASE_SENSITIVE], true);

    if (!search) {
        throw new CommandParseError('Copy command requires search parameter');
    }

    // Validate that exactly one positioning method is provided
    const positionCount = [position, after, before].filter(v => v !== undefined).length;
    if (positionCount === 0) {
        throw new CommandParseError(
            'Copy command requires one of: position, after, or before parameter'
        );
    }
    if (positionCount > 1) {
        throw new CommandParseError(
            'Copy command can only use one of: position, after, or before parameter'
        );
    }

    return {
        type: EditCommandType.COPY,
        search,
        after,
        before,
        position,
        caseSensitive
    };
}

/**
 * Parse batch command
 */
function parseBatchCommand(params: Record<string, string>, nestedCommands?: EditCommand[]): BatchCommand {
    const stopOnError = parseBoolean(params[XML_TAGS.STOP_ON_ERROR], true);
    const commands = nestedCommands || [];

    if (commands.length === 0) {
        throw new CommandParseError('Batch command requires at least one nested command');
    }

    return {
        type: EditCommandType.BATCH,
        commands,
        stopOnError
    };
}

/**
 * Check if a tag name is a valid command type
 */
function isCommandType(tagName: string): boolean {
    const commandTypes: string[] = [
        XML_TAGS.INSERT,
        XML_TAGS.REPLACE,
        XML_TAGS.DELETE,
        XML_TAGS.APPEND,
        XML_TAGS.PREPEND,
        XML_TAGS.MOVE,
        XML_TAGS.COPY,
        XML_TAGS.BATCH,
        XML_TAGS.COMMANDS
    ];
    return commandTypes.includes(tagName);
}

/**
 * Parse a single command from tag name and parameters
 */
function parseCommand(tagName: string, params: Record<string, string>, nestedCommands?: EditCommand[]): EditCommand {
    switch (tagName) {
        case XML_TAGS.INSERT:
            return parseInsertCommand(params);
        case XML_TAGS.REPLACE:
            return parseReplaceCommand(params);
        case XML_TAGS.DELETE:
            return parseDeleteCommand(params);
        case XML_TAGS.APPEND:
            return parseAppendCommand(params);
        case XML_TAGS.PREPEND:
            return parsePrependCommand(params);
        case XML_TAGS.MOVE:
            return parseMoveCommand(params);
        case XML_TAGS.COPY:
            return parseCopyCommand(params);
        case XML_TAGS.BATCH:
            return parseBatchCommand(params, nestedCommands);
        default:
            throw new CommandParseError(`Unknown command type: ${tagName}`);
    }
}

/**
 * Simple XML parser that extracts command tags and their content
 */
interface ParsedTag {
    tagName: string;
    content: string;
    children: ParsedTag[];
}

function parseSimpleXML(xml: string): ParsedTag[] {
    const tags: ParsedTag[] = [];
    const stack: Array<{ tagName: string; content: string; children: ParsedTag[] }> = [];

    let pos = 0;
    const length = xml.length;

    while (pos < length) {
        // Skip whitespace
        while (pos < length && /\s/.test(xml[pos])) {
            pos++;
        }

        if (pos >= length) break;

        // Check for opening tag
        if (xml[pos] === '<') {
            const tagEnd = xml.indexOf('>', pos);
            if (tagEnd === -1) {
                throw new CommandParseError('Unclosed tag', xml.substring(pos));
            }

            const isClosing = xml[pos + 1] === '/';
            const tagName = xml
                .substring(isClosing ? pos + 2 : pos + 1, tagEnd)
                .trim();

            if (!tagName) {
                throw new CommandParseError('Empty tag name', xml.substring(pos, tagEnd + 1));
            }

            if (isClosing) {
                // Closing tag
                if (stack.length === 0) {
                    throw new CommandParseError(`Unexpected closing tag: ${tagName}`);
                }

                const current = stack[stack.length - 1];
                if (current.tagName !== tagName) {
                    throw new CommandParseError(
                        `Mismatched closing tag: expected ${current.tagName}, got ${tagName}`
                    );
                }

                stack.pop();

                // If this is a top-level tag, add it to results
                if (stack.length === 0) {
                    tags.push({
                        tagName: current.tagName,
                        content: current.content,
                        children: current.children
                    });
                } else if (stack.length > 0) {
                    // Add as child to parent
                    const parent = stack[stack.length - 1];
                    parent.children.push({
                        tagName: current.tagName,
                        content: current.content,
                        children: current.children
                    });
                }

                pos = tagEnd + 1;
            } else {
                // Opening tag
                stack.push({
                    tagName,
                    content: '',
                    children: []
                });
                pos = tagEnd + 1;
            }
        } else {
            // Content - find next tag
            const nextTag = xml.indexOf('<', pos);
            if (nextTag === -1) {
                // No more tags, remaining is content
                const content = xml.substring(pos).trim();
                if (content && stack.length > 0) {
                    const current = stack[stack.length - 1];
                    if (!current.content) {
                        current.content = content;
                    }
                }
                break;
            }

            const content = xml.substring(pos, nextTag).trim();
            if (content && stack.length > 0) {
                const current = stack[stack.length - 1];
                if (!current.content) {
                    current.content = content;
                }
            }

            pos = nextTag;
        }
    }

    if (stack.length > 0) {
        throw new CommandParseError(
            `Unclosed tag(s): ${stack.map(t => t.tagName).join(', ')}`
        );
    }

    return tags;
}

/**
 * Extract parameters from children tags
 */
function extractParams(children: ParsedTag[]): Record<string, string> {
    const params: Record<string, string> = {};
    for (const child of children) {
        if (!isCommandType(child.tagName)) {
            // This is a parameter tag
            params[child.tagName] = child.content;
        }
    }
    return params;
}

/**
 * Parse parsed tags into command objects
 */
function parseParsedTags(tags: ParsedTag[]): EditCommand[] {
    const commands: EditCommand[] = [];
    for (const tag of tags) {
        if (isCommandType(tag.tagName)) {
            const params = extractParams(tag.children);
            const nestedTag = tag.children.find(c => c.tagName === 'commands')?.children.filter(c => isCommandType(c.tagName))
            let nestedCommands
            if (nestedTag) nestedCommands = parseParsedTags(nestedTag);
            const command = parseCommand(tag.tagName, params, nestedCommands);
            commands.push(command);
        } else {
            throw new CommandParseError(`Unknown command type: ${tag.tagName}`)
        }
    }

    return commands;
}

/**
 * Parse XML string into command objects
 * Supports both single commands and nested batch commands
 */
export function parseXMLCommands(xml: string): EditCommand[] {
    const parsedTags = parseSimpleXML(xml);
    return parseParsedTags(parsedTags);
}

/**
 * Parse XML command string and return the first command
 * Convenience function for single command parsing
 */
export function parseXMLCommand(xml: string): EditCommand {
    const commands = parseXMLCommands(xml);
    if (commands.length === 0) {
        throw new CommandParseError('No commands found in XML');
    }
    if (commands.length > 1) {
        throw new CommandParseError(
            `Multiple commands found, expected single command. Use parseXMLCommands for multiple commands.`
        );
    }
    return commands[0];
}
