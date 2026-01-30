// import { Anthropic } from '@anthropic-ai/sdk';

// import type {
//   ClineAsk,
//   ToolProgressStatus,
//   ToolGroup,
//   ToolName,
// } from '../types';

// export type ToolResponse =
//   | string
//   | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>;

// export type AskApproval = (
//   type: ClineAsk,
//   partialMessage?: string,
//   progressStatus?: ToolProgressStatus,
//   forceApproval?: boolean,
// ) => Promise<boolean>;

// export type HandleError = (action: string, error: Error) => Promise<void>;

// export type PushToolResult = (content: ToolResponse) => void;

// export type RemoveClosingTag = (tag: ToolParamName, content?: string) => string;

// export type AskFinishSubTaskApproval = () => Promise<boolean>;

// export type ToolDescription = () => string;

// export interface TextContent {
//   type: 'text';
//   content: string;
//   partial: boolean;
// }

// export const toolParamNames = [
//   'command',
//   'path',
//   'content',
//   'regex',
//   'file_pattern',
//   'recursive',
//   'action',
//   'url',
//   'coordinate',
//   'text',
//   'server_name',
//   'tool_name',
//   'arguments',
//   'uri',
//   'question',
//   'result',
//   'diff',
//   'mode_slug',
//   'reason',
//   'line',
//   'mode',
//   'message',
//   'cwd',
//   'follow_up',
//   'task',
//   'size',
//   'query',
//   'args',
//   'start_line',
//   'end_line',
//   'todos',
//   'prompt',
//   'image',
//   'files', // Native protocol parameter for read_file
//   'operations', // search_and_replace parameter for multiple operations
//   'patch', // apply_patch parameter
//   'file_path', // search_replace parameter
//   'old_string', // search_replace parameter
//   'new_string', // search_replace parameter
// ] as const;

// export type ToolParamName = (typeof toolParamNames)[number];

// /**
//  * Type map defining the native (typed) argument structure for each tool.
//  * Tools not listed here will fall back to `any` for backward compatibility.
//  */
// export type NativeToolArgs = {
//   access_mcp_resource: { server_name: string; uri: string };
//   attempt_completion: { result: string };
//   execute_command: { command: string; cwd?: string };
//   apply_diff: { path: string; diff: string };
//   search_and_replace: {
//     path: string;
//     operations: Array<{ search: string; replace: string }>;
//   };
//   search_replace: { file_path: string; old_string: string; new_string: string };
//   apply_patch: { patch: string };
//   ask_followup_question: {
//     question: string;
//     follow_up: Array<{ text: string; mode?: string }>;
//   };
//   codebase_search: { query: string; path?: string };
//   fetch_instructions: { task: string };
//   list_code_definition_names: { path: string };
//   run_slash_command: { command: string; args?: string };
//   search_files: { path: string; regex: string; file_pattern?: string | null };
//   switch_mode: { mode_slug: string; reason: string };
//   update_todo_list: { todos: string };
//   use_mcp_tool: {
//     server_name: string;
//     tool_name: string;
//     arguments?: Record<string, unknown>;
//   };
//   write_to_file: { path: string; content: string };
//   // Add more tools as they are migrated to native protocol
// };

// /**
//  * Generic ToolUse interface that provides proper typing for both protocols.
//  *
//  * @template TName - The specific tool name, which determines the nativeArgs type
//  */
// export interface ToolUse<TName extends ToolName = ToolName> {
//   type: 'tool_use';
//   id?: string; // Optional ID to track tool calls
//   name: TName;
//   // params is a partial record, allowing only some or none of the possible parameters to be used
//   params: Partial<Record<ToolParamName, string>>;
//   partial: boolean;
//   // nativeArgs is properly typed based on TName if it's in NativeToolArgs, otherwise never
//   nativeArgs?: TName extends keyof NativeToolArgs
//     ? NativeToolArgs[TName]
//     : never;
// }

import { ToolUse } from '../assistant-message/assistantMessageTypes';

// /**
//  * Represents a native MCP tool call from the model.
//  * In native mode, MCP tools are called directly with their prefixed name (e.g., "mcp_serverName_toolName")
//  * rather than through the use_mcp_tool wrapper. This type preserves the original tool name
//  * so it appears correctly in API conversation history.
//  */
// export interface McpToolUse {
//   type: 'mcp_tool_use';
//   id?: string; // Tool call ID from the API
//   /** The original tool name from the API (e.g., "mcp_serverName_toolName") */
//   name: string;
//   /** Extracted server name from the tool name */
//   serverName: string;
//   /** Extracted tool name from the tool name */
//   toolName: string;
//   /** Arguments passed to the MCP tool */
//   arguments: Record<string, unknown>;
//   partial: boolean;
// }

// export interface AttemptCompletionToolUse
//   extends ToolUse<'attempt_completion'> {
//   name: 'attempt_completion';
//   params: Partial<Pick<Record<ToolParamName, string>, 'result'>>;
// }

// // Define tool group configuration
// export type ToolGroupConfig = {
//   tools: readonly string[];
//   alwaysAvailable?: boolean; // Whether this group is always available and shouldn't show in prompts view
//   customTools?: readonly string[]; // Opt-in only tools - only available when explicitly included via model's includedTools
// };

// export const TOOL_DISPLAY_NAMES: Record<ToolName, string> = {
//   attempt_completion: 'complete tasks',
//   semantic_search: 'semantic search',
// } as const;

// // Define available tool groups.
// export const TOOL_GROUPS: Record<ToolGroup, ToolGroupConfig> = {
//   search: {
//     tools: ['semantic_search'],
//   },
// };

// // Tools that are always available to all modes.
// export const ALWAYS_AVAILABLE_TOOLS: ToolName[] = [
//   'attempt_completion',
// ] as const;

// export type DiffResult =
//   | { success: true; content: string; failParts?: DiffResult[] }
//   | ({
//     success: false;
//     error?: string;
//     details?: {
//       similarity?: number;
//       threshold?: number;
//       matchedRange?: { start: number; end: number };
//       searchContent?: string;
//       bestMatch?: string;
//     };
//     failParts?: DiffResult[];
//   } & ({ error: string } | { failParts: DiffResult[] }));

// export interface DiffItem {
//   content: string;
//   startLine?: number;
// }

// export interface DiffStrategy {
//   /**
//    * Get the name of this diff strategy for analytics and debugging
//    * @returns The name of the diff strategy
//    */
//   getName(): string;

//   /**
//    * Get the tool description for this diff strategy
//    * @param args The tool arguments including cwd and toolOptions
//    * @returns The complete tool description including format requirements and examples
//    */
//   getToolDescription(args: {
//     cwd: string;
//     toolOptions?: { [key: string]: string };
//   }): string;

//   /**
//    * Apply a diff to the original content
//    * @param originalContent The original file content
//    * @param diffContent The diff content in the strategy's format (string for legacy, DiffItem[] for new)
//    * @param startLine Optional line number where the search block starts. If not provided, searches the entire file.
//    * @param endLine Optional line number where the search block ends. If not provided, searches the entire file.
//    * @returns A DiffResult object containing either the successful result or error details
//    */
//   applyDiff(
//     originalContent: string,
//     diffContent: string | DiffItem[],
//     startLine?: number,
//     endLine?: number,
//   ): Promise<DiffResult>;

//   getProgressStatus?(toolUse: ToolUse, result?: any): ToolProgressStatus;
// }
