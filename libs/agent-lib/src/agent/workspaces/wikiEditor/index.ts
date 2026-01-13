/**
 * Wiki Editor Module
 * XML-based editing commands for wiki document manipulation
 *
 * This module provides a comprehensive system for editing wiki documents
 * using XML-based commands. It supports various operations like insert,
 * replace, delete, append, prepend, move, copy, and batch operations.
 *
 * @module wikiEditor
 */

// Export the main component
export { WikiEditorComponents } from './wikiEditorComponents';

// Export types
export type {
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

export { XML_TAGS, XML_COMMAND_SCHEMA } from './wikiEditorCommandTypes';

// Export parser
export {
    parseXMLCommands,
    parseXMLCommand,
    CommandParseError
} from './wikiEditorCommandParser';

// Export executor
export {
    executeCommand,
    executeCommands,
    applyCommand,
    CommandExecutionError
} from './wikiEditorCommandExecutor';

// Export result type
export type { WikiEditorExecutionResult } from './wikiEditorComponents';
