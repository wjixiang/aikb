/**
 * Wiki Editor XML Command Executor
 * Executes parsed edit commands on document content
 */

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
    EditCommandResult,
    BatchCommandResult,
    CommandResult
} from './wikiEditorCommandTypes';

// Re-export CommandResult for external use
export type { CommandResult };

/**
 * Error class for execution errors
 */
export class CommandExecutionError extends Error {
    constructor(
        message: string,
        public readonly command: EditCommand,
        public readonly content: string
    ) {
        super(message);
        this.name = 'CommandExecutionError';
    }
}

/**
 * Find the position of a search string in content
 */
function findPosition(content: string, search: string, caseSensitive: boolean): number {
    if (!caseSensitive) {
        return content.toLowerCase().indexOf(search.toLowerCase());
    }
    return content.indexOf(search);
}

/**
 * Find all positions of a search string in content
 */
function findAllPositions(content: string, search: string, caseSensitive: boolean): number[] {
    const positions: number[] = [];
    let pos = 0;
    const searchContent = caseSensitive ? content : content.toLowerCase();
    const searchTerm = caseSensitive ? search : search.toLowerCase();

    while (pos < searchContent.length) {
        const found = searchContent.indexOf(searchTerm, pos);
        if (found === -1) break;
        positions.push(found);
        pos = found + 1;
    }

    return positions;
}

/**
 * Execute insert command
 */
function executeInsert(content: string, command: InsertCommand): EditCommandResult {
    let insertPosition: number;

    if (command.position !== undefined) {
        insertPosition = Math.min(Math.max(0, command.position), content.length);
    } else if (command.after !== undefined) {
        const pos = findPosition(content, command.after, true);
        if (pos === -1) {
            throw new CommandExecutionError(
                `Could not find text to insert after: "${command.after}"`,
                command,
                content
            );
        }
        insertPosition = pos + command.after.length;
    } else if (command.before !== undefined) {
        const pos = findPosition(content, command.before, true);
        if (pos === -1) {
            throw new CommandExecutionError(
                `Could not find text to insert before: "${command.before}"`,
                command,
                content
            );
        }
        insertPosition = pos;
    } else {
        // This should never happen due to validation in parser
        throw new CommandExecutionError(
            'Insert command requires position, after, or before parameter',
            command,
            content
        );
    }

    const newContent =
        content.substring(0, insertPosition) + command.content + content.substring(insertPosition);

    return {
        success: true,
        command,
        previousContent: content,
        newContent,
        changes: 1
    };
}

/**
 * Execute replace command
 */
function executeReplace(content: string, command: ReplaceCommand): EditCommandResult {
    let newContent: string;
    let changes: number;

    if (command.replaceAll) {
        const positions = findAllPositions(content, command.search, command.caseSensitive ?? true);
        if (positions.length === 0) {
            throw new CommandExecutionError(
                `Could not find text to replace: "${command.search}"`,
                command,
                content
            );
        }

        newContent = content;
        changes = 0;

        // Replace from end to beginning to preserve positions
        for (let i = positions.length - 1; i >= 0; i--) {
            const pos = positions[i];
            newContent =
                newContent.substring(0, pos) +
                command.replace +
                newContent.substring(pos + command.search.length);
            changes++;
        }
    } else {
        const pos = findPosition(content, command.search, command.caseSensitive ?? true);
        if (pos === -1) {
            throw new CommandExecutionError(
                `Could not find text to replace: "${command.search}"`,
                command,
                content
            );
        }

        newContent =
            content.substring(0, pos) +
            command.replace +
            content.substring(pos + command.search.length);
        changes = 1;
    }

    return {
        success: true,
        command,
        previousContent: content,
        newContent,
        changes
    };
}

/**
 * Execute delete command
 */
function executeDelete(content: string, command: DeleteCommand): EditCommandResult {
    let newContent: string;
    let changes: number;

    if (command.start !== undefined && command.end !== undefined) {
        // Delete by range
        const start = Math.min(Math.max(0, command.start), content.length);
        const end = Math.min(Math.max(0, command.end), content.length);

        if (start > end) {
            throw new CommandExecutionError(
                'Start position cannot be greater than end position',
                command,
                content
            );
        }

        newContent = content.substring(0, start) + content.substring(end);
        changes = 1;
    } else if (command.search) {
        // Delete by search
        if (command.deleteAll) {
            const positions = findAllPositions(
                content,
                command.search,
                command.caseSensitive ?? true
            );
            if (positions.length === 0) {
                throw new CommandExecutionError(
                    `Could not find text to delete: "${command.search}"`,
                    command,
                    content
                );
            }

            newContent = content;
            changes = 0;

            // Delete from end to beginning to preserve positions
            for (let i = positions.length - 1; i >= 0; i--) {
                const pos = positions[i];
                newContent = newContent.substring(0, pos) + newContent.substring(pos + command.search!.length);
                changes++;
            }
        } else {
            const pos = findPosition(content, command.search, command.caseSensitive ?? true);
            if (pos === -1) {
                throw new CommandExecutionError(
                    `Could not find text to delete: "${command.search}"`,
                    command,
                    content
                );
            }

            newContent = content.substring(0, pos) + content.substring(pos + command.search.length);
            changes = 1;
        }
    } else {
        throw new CommandExecutionError(
            'Delete command requires search parameter or start/end range',
            command,
            content
        );
    }

    return {
        success: true,
        command,
        previousContent: content,
        newContent,
        changes
    };
}

/**
 * Execute append command
 */
function executeAppend(content: string, command: AppendCommand): EditCommandResult {
    let newContent: string;

    if (command.newLine !== false) {
        // Only add a newline if content doesn't already end with a newline
        // and the content being appended doesn't start with a newline
        const needsNewline = content.length > 0 && !content.endsWith('\n') && !command.content.startsWith('\n');
        newContent = content + (needsNewline ? '\n' : '') + command.content;
    } else {
        newContent = content + command.content;
    }

    return {
        success: true,
        command,
        previousContent: content,
        newContent,
        changes: 1
    };
}

/**
 * Execute prepend command
 */
function executePrepend(content: string, command: PrependCommand): EditCommandResult {
    let newContent: string;

    if (command.newLine !== false) {
        // Only add a newline if content doesn't already start with a newline
        // and the content being prepended doesn't end with a newline
        const needsNewline = content.length > 0 && !content.startsWith('\n') && !command.content.endsWith('\n');
        newContent = command.content + (needsNewline ? '\n' : '') + content;
    } else {
        newContent = command.content + content;
    }

    return {
        success: true,
        command,
        previousContent: content,
        newContent,
        changes: 1
    };
}

/**
 * Execute move command
 */
function executeMove(content: string, command: MoveCommand): EditCommandResult {
    const pos = findPosition(content, command.search, command.caseSensitive ?? true);
    if (pos === -1) {
        throw new CommandExecutionError(
            `Could not find text to move: "${command.search}"`,
            command,
            content
        );
    }

    const movedContent = content.substring(pos, pos + command.search.length);
    const contentWithoutMoved = content.substring(0, pos) + content.substring(pos + command.search.length);

    let insertPosition: number;

    if (command.position !== undefined) {
        insertPosition = Math.min(Math.max(0, command.position), contentWithoutMoved.length);
    } else if (command.after !== undefined) {
        const afterPos = findPosition(contentWithoutMoved, command.after, command.caseSensitive ?? true);
        if (afterPos === -1) {
            throw new CommandExecutionError(
                `Could not find text to move after: "${command.after}"`,
                command,
                content
            );
        }
        insertPosition = afterPos + command.after.length;
    } else if (command.before !== undefined) {
        const beforePos = findPosition(contentWithoutMoved, command.before, command.caseSensitive ?? true);
        if (beforePos === -1) {
            throw new CommandExecutionError(
                `Could not find text to move before: "${command.before}"`,
                command,
                content
            );
        }
        insertPosition = beforePos;
    } else {
        throw new CommandExecutionError(
            'Move command requires position, after, or before parameter',
            command,
            content
        );
    }

    const newContent =
        contentWithoutMoved.substring(0, insertPosition) +
        movedContent +
        contentWithoutMoved.substring(insertPosition);

    return {
        success: true,
        command,
        previousContent: content,
        newContent,
        changes: 1
    };
}

/**
 * Execute copy command
 */
function executeCopy(content: string, command: CopyCommand): EditCommandResult {
    const pos = findPosition(content, command.search, command.caseSensitive ?? true);
    if (pos === -1) {
        throw new CommandExecutionError(
            `Could not find text to copy: "${command.search}"`,
            command,
            content
        );
    }

    const copiedContent = content.substring(pos, pos + command.search.length);

    let insertPosition: number;

    if (command.position !== undefined) {
        insertPosition = Math.min(Math.max(0, command.position), content.length);
    } else if (command.after !== undefined) {
        const afterPos = findPosition(content, command.after, true);
        if (afterPos === -1) {
            throw new CommandExecutionError(
                `Could not find text to copy after: "${command.after}"`,
                command,
                content
            );
        }
        insertPosition = afterPos + command.after.length;
    } else if (command.before !== undefined) {
        const beforePos = findPosition(content, command.before, true);
        if (beforePos === -1) {
            throw new CommandExecutionError(
                `Could not find text to copy before: "${command.before}"`,
                command,
                content
            );
        }
        insertPosition = beforePos;
    } else {
        throw new CommandExecutionError(
            'Copy command requires position, after, or before parameter',
            command,
            content
        );
    }

    const newContent =
        content.substring(0, insertPosition) +
        copiedContent +
        content.substring(insertPosition);

    return {
        success: true,
        command,
        previousContent: content,
        newContent,
        changes: 1
    };
}

/**
 * Execute batch command
 */
function executeBatch(content: string, command: BatchCommand): BatchCommandResult {
    const results: EditCommandResult[] = [];
    let currentContent = content;
    const stopOnError = command.stopOnError !== false;

    for (const cmd of command.commands) {
        try {
            const result = executeCommand(currentContent, cmd);
            results.push(result);
            currentContent = result.newContent;
        } catch (error) {
            const errorResult: EditCommandResult = {
                success: false,
                command: cmd,
                error: error instanceof Error ? error.message : String(error),
                previousContent: currentContent,
                newContent: currentContent,
                changes: 0
            };
            results.push(errorResult);

            if (stopOnError) {
                return {
                    success: false,
                    command,
                    results,
                    error: errorResult.error,
                    previousContent: content,
                    newContent: currentContent,
                    changes: results.reduce((sum, r) => sum + r.changes, 0)
                };
            }
        }
    }

    return {
        success: true,
        command,
        results,
        previousContent: content,
        newContent: currentContent,
        changes: results.reduce((sum, r) => sum + r.changes, 0)
    };
}

/**
 * Execute a single command on content
 */
export function executeCommand(content: string, command: EditCommand): EditCommandResult {
    switch (command.type) {
        case EditCommandType.INSERT:
            return executeInsert(content, command);
        case EditCommandType.REPLACE:
            return executeReplace(content, command);
        case EditCommandType.DELETE:
            return executeDelete(content, command);
        case EditCommandType.APPEND:
            return executeAppend(content, command);
        case EditCommandType.PREPEND:
            return executePrepend(content, command);
        case EditCommandType.MOVE:
            return executeMove(content, command);
        case EditCommandType.COPY:
            return executeCopy(content, command);
        case EditCommandType.BATCH:
            return executeBatch(content, command);
        default:
            throw new CommandExecutionError(
                `Unknown command type: ${(command as any).type}`,
                command,
                content
            );
    }
}

/**
 * Execute multiple commands in sequence
 */
export function executeCommands(content: string, commands: EditCommand[]): CommandResult[] {
    const results: CommandResult[] = [];
    let currentContent = content;

    for (const command of commands) {
        try {
            const result = executeCommand(currentContent, command);
            results.push(result);
            currentContent = result.newContent;
        } catch (error) {
            const errorResult: EditCommandResult = {
                success: false,
                command,
                error: error instanceof Error ? error.message : String(error),
                previousContent: currentContent,
                newContent: currentContent,
                changes: 0
            };
            results.push(errorResult);
            break; // Stop on error for sequential execution
        }
    }

    return results;
}

/**
 * Execute a single command and return the new content
 * Convenience function that throws on error
 */
export function applyCommand(content: string, command: EditCommand): string {
    const result = executeCommand(content, command);
    if (!result.success) {
        throw new CommandExecutionError(
            result.error || 'Command execution failed',
            command,
            content
        );
    }
    return result.newContent;
}
