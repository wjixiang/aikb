/**
 * Simplified assistant message types
 * Extracted from core/assistant-message/index.ts
 */

export interface AssistantMessageContent {
  type: 'text' | 'tool_use';
  content?: string;
  partial?: boolean;
}

export interface TextContent {
  type: 'text';
  content: string;
  partial?: boolean;
}

export interface ToolUse {
  type: 'tool_use';
  name: string;
  params: Record<string, any>;
  partial?: boolean;
  id?: string;
  nativeArgs?: any;
}

export interface FileEntry {
  path: string;
  lineRanges?: Array<{ start: number; end: number }>;
}

export interface NativeToolArgs {
  read_file?: { files: FileEntry[] };
  attempt_completion?: { result: any };
  execute_command?: { command: string; cwd?: string };
  write_to_file?: { path: string; content: string };
  ask_followup_question?: { question: string; follow_up?: string[] };
  apply_diff?: { path: string; diff: string };
  browser_action?: {
    action: string;
    url?: string;
    coordinate?: string;
    size?: string;
    text?: string;
  };
  codebase_search?: { query: string; path?: string };
  fetch_instructions?: { task: string };
  generate_image?: { prompt: string; path?: string; image?: string };
  list_code_definition_names?: { path: string };
  run_slash_command?: { command: string; args?: string };
  search_files?: { path?: string; regex?: string; file_pattern?: string };
  switch_mode?: { mode_slug: string; reason?: string };
  update_todo_list?: { todos: any };
  use_mcp_tool?: { server_name: string; tool_name: string; arguments?: any };
  apply_patch?: { patch: string };
  search_replace?: {
    file_path: string;
    old_string?: string;
    new_string?: string;
  };
  access_mcp_resource?: { server_name: string; uri?: string };
}

export type ToolName =
  | 'read_file'
  | 'attempt_completion'
  | 'execute_command'
  | 'write_to_file'
  | 'ask_followup_question'
  | 'apply_diff'
  | 'browser_action'
  | 'codebase_search'
  | 'fetch_instructions'
  | 'generate_image'
  | 'list_code_definition_names'
  | 'run_slash_command'
  | 'search_files'
  | 'switch_mode'
  | 'update_todo_list'
  | 'use_mcp_tool'
  | 'apply_patch'
  | 'search_replace'
  | 'access_mcp_resource';

export type ToolParamName =
  | 'path'
  | 'query'
  | 'files'
  | 'command'
  | 'cwd'
  | 'content'
  | 'diff'
  | 'url'
  | 'coordinate'
  | 'size'
  | 'text'
  | 'image'
  | 'prompt'
  | 'file_pattern'
  | 'regex'
  | 'mode_slug'
  | 'reason'
  | 'todos'
  | 'follow_up'
  | 'question'
  | 'server_name'
  | 'tool_name'
  | 'arguments'
  | 'patch'
  | 'file_path'
  | 'old_string'
  | 'new_string'
  | 'uri';

export const toolNames: ToolName[] = [
  'read_file',
  'attempt_completion',
  'execute_command',
  'write_to_file',
  'ask_followup_question',
  'apply_diff',
  'browser_action',
  'codebase_search',
  'fetch_instructions',
  'generate_image',
  'list_code_definition_names',
  'run_slash_command',
  'search_files',
  'switch_mode',
  'update_todo_list',
  'use_mcp_tool',
  'apply_patch',
  'search_replace',
  'access_mcp_resource',
];

export const toolParamNames: ToolParamName[] = [
  'path',
  'query',
  'files',
  'command',
  'cwd',
  'content',
  'diff',
  'url',
  'coordinate',
  'size',
  'text',
  'image',
  'prompt',
  'file_pattern',
  'regex',
  'mode_slug',
  'reason',
  'todos',
  'follow_up',
  'question',
  'server_name',
  'tool_name',
  'arguments',
  'patch',
  'file_path',
  'old_string',
  'new_string',
  'uri',
];
