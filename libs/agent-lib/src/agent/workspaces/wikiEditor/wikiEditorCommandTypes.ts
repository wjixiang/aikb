/**
 * Wiki Editor XML Command Types
 * Defines the schema for XML-based editing commands
 */

/**
 * Supported edit command types
 */
export enum EditCommandType {
  INSERT = 'insert',
  REPLACE = 'replace',
  DELETE = 'delete',
  APPEND = 'append',
  PREPEND = 'prepend',
  MOVE = 'move',
  COPY = 'copy',
  BATCH = 'batch'
}

/**
 * Base interface for all edit commands
 */
export interface BaseEditCommand {
  type: EditCommandType;
}

/**
 * Insert command - inserts content at a specific position
 */
export interface InsertCommand extends BaseEditCommand {
  type: EditCommandType.INSERT;
  position?: number; // Character position to insert at (0-indexed)
  after?: string; // Insert after this text marker
  before?: string; // Insert before this text marker
  content: string; // Content to insert
}

/**
 * Replace command - replaces a portion of content
 */
export interface ReplaceCommand extends BaseEditCommand {
  type: EditCommandType.REPLACE;
  search: string; // Text to search for
  replace: string; // Replacement text
  replaceAll?: boolean; // Replace all occurrences (default: false)
  caseSensitive?: boolean; // Case-sensitive search (default: true)
}

/**
 * Delete command - removes content
 */
export interface DeleteCommand extends BaseEditCommand {
  type: EditCommandType.DELETE;
  search: string; // Text to delete
  deleteAll?: boolean; // Delete all occurrences (default: false)
  caseSensitive?: boolean; // Case-sensitive search (default: true)
  start?: number; // Start position
  end?: number; // End position
}

/**
 * Append command - adds content at the end
 */
export interface AppendCommand extends BaseEditCommand {
  type: EditCommandType.APPEND;
  content: string; // Content to append
  newLine?: boolean; // Add a newline before appending (default: true)
}

/**
 * Prepend command - adds content at the beginning
 */
export interface PrependCommand extends BaseEditCommand {
  type: EditCommandType.PREPEND;
  content: string; // Content to prepend
  newLine?: boolean; // Add a newline after prepending (default: true)
}

/**
 * Move command - moves a section of content
 */
export interface MoveCommand extends BaseEditCommand {
  type: EditCommandType.MOVE;
  search: string; // Text to move
  after?: string; // Move after this text marker
  before?: string; // Move before this text marker
  position?: number; // Move to this position
  caseSensitive?: boolean; // Case-sensitive search (default: true)
}

/**
 * Copy command - copies a section of content
 */
export interface CopyCommand extends BaseEditCommand {
  type: EditCommandType.COPY;
  search: string; // Text to copy
  after?: string; // Copy after this text marker
  before?: string; // Copy before this text marker
  position?: number; // Copy to this position
  caseSensitive?: boolean; // Case-sensitive search (default: true)
}

/**
 * Batch command - executes multiple commands in sequence
 */
export interface BatchCommand extends BaseEditCommand {
  type: EditCommandType.BATCH;
  commands: EditCommand[]; // Commands to execute
  stopOnError?: boolean; // Stop on error (default: true)
}

/**
 * Union type for all edit commands
 */
export type EditCommand =
  | InsertCommand
  | ReplaceCommand
  | DeleteCommand
  | AppendCommand
  | PrependCommand
  | MoveCommand
  | CopyCommand
  | BatchCommand;

/**
 * Result of executing an edit command
 */
export interface EditCommandResult {
  success: boolean;
  command: EditCommand;
  error?: string;
  previousContent: string;
  newContent: string;
  changes: number; // Number of changes made
}

/**
 * Result of executing a batch command
 */
export interface BatchCommandResult {
  success: boolean;
  command: BatchCommand;
  results: EditCommandResult[];
  error?: string;
  previousContent: string;
  newContent: string;
  changes: number; // Total number of changes made across all commands
}

/**
 * Combined result type
 */
export type CommandResult = EditCommandResult | BatchCommandResult;

/**
 * XML tag names for commands
 */
export const XML_TAGS = {
  INSERT: 'insert',
  REPLACE: 'replace',
  DELETE: 'delete',
  APPEND: 'append',
  PREPEND: 'prepend',
  MOVE: 'move',
  COPY: 'copy',
  BATCH: 'batch',
  POSITION: 'position',
  AFTER: 'after',
  BEFORE: 'before',
  CONTENT: 'content',
  SEARCH: 'search',
  REPLACE_TEXT: 'replace_text',
  REPLACE_ALL: 'replace_all',
  CASE_SENSITIVE: 'case_sensitive',
  DELETE_ALL: 'delete_all',
  START: 'start',
  END: 'end',
  NEW_LINE: 'new_line',
  COMMANDS: 'commands',
  STOP_ON_ERROR: 'stop_on_error'
} as const;

/**
 * XML command schema documentation
 */
export const XML_COMMAND_SCHEMA = `
XML-Based Wiki Editor Commands
===============================

The Wiki Editor supports XML-based editing commands to modify document content.
All commands are wrapped in XML tags and can be combined in batch operations.

Command Structure:
------------------
<command_type>
  <parameter>value</parameter>
  ...
</command_type>

Available Commands:
-------------------

1. INSERT - Insert content at a specific position
   <insert>
     <position>0</position> OR <after>text</after> OR <before>text</before>
     <content>content to insert</content>
   </insert>

2. REPLACE - Replace text with new content
   <replace>
     <search>text to find</search>
     <replace_text>replacement text</replace_text>
     <replace_all>true|false</replace_all> (optional, default: false)
     <case_sensitive>true|false</case_sensitive> (optional, default: true)
   </replace>

3. DELETE - Remove content
   <delete>
     <search>text to delete</search> OR <start>0</start><end>10</end>
     <delete_all>true|false</delete_all> (optional, default: false)
     <case_sensitive>true|false</case_sensitive> (optional, default: true)
   </delete>

4. APPEND - Add content at the end
   <append>
     <content>content to append</content>
     <new_line>true|false</new_line> (optional, default: true)
   </append>

5. PREPEND - Add content at the beginning
   <prepend>
     <content>content to prepend</content>
     <new_line>true|false</new_line> (optional, default: true)
   </prepend>

6. MOVE - Move content to a new location
   <move>
     <search>text to move</search>
     <after>text</after> OR <before>text</before> OR <position>0</position>
     <case_sensitive>true|false</case_sensitive> (optional, default: true)
   </move>

7. COPY - Copy content to a new location
   <copy>
     <search>text to copy</search>
     <after>text</after> OR <before>text</before> OR <position>0</position>
     <case_sensitive>true|false</case_sensitive> (optional, default: true)
   </copy>

8. BATCH - Execute multiple commands in sequence
   <batch>
     <stop_on_error>true|false</stop_on_error> (optional, default: true)
     <commands>
       <!-- nested commands -->
     </commands>
   </batch>

Examples:
---------

Insert a new section:
<insert>
  <after>## Introduction</after>
  <content>## New Section

This is new content.
</content>
</insert>

Replace all occurrences:
<replace>
  <search>old text</search>
  <replace_text>new text</replace_text>
  <replace_all>true</replace_all>
</replace>

Delete a section:
<delete>
  <search>## Section to Delete</search>
</delete>

Batch operations:
<batch>
  <stop_on_error>false</stop_on_error>
  <commands>
    <append>
      <content>Additional content</content>
    </append>
    <replace>
      <search>foo</search>
      <replace_text>bar</replace_text>
    </replace>
  </commands>
</batch>

Notes:
------
- Content tags can contain multi-line text with markdown formatting
- Position values are 0-indexed character positions
- When using after/before markers, the first match is used
- Batch commands stop on error by default, set stop_on_error to false to continue
`;
