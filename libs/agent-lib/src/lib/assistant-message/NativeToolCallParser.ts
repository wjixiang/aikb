import { ToolName, toolNames, FileEntry, NativeToolArgs, ToolParamName, toolParamNames } from '../task/simplified-dependencies/assistantMessageTypes';
// Simplified JSON parser for our standalone version
function parseJSON(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
}

/**
 * Event types returned from raw chunk processing.
 */
export type ToolCallStreamEvent =
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; delta: string }
  | { type: 'tool_call_end'; id: string };

/**
 * Simplified Native Tool Call Parser
 * Extracted from core/assistant-message/NativeToolCallParser.ts
 */
export class NativeToolCallParser {
  // Streaming state management for argument accumulation (keyed by tool call id)
  private static streamingToolCalls = new Map<
    string,
    {
      id: string;
      name: string;
      argumentsAccumulator: string;
    }
  >();

  // Raw chunk tracking state (keyed by index from API stream)
  private static rawChunkTracker = new Map<
    number,
    {
      id: string;
      name: string;
      hasStarted: boolean;
      deltaBuffer: string[];
    }
  >();

  /**
   * Process a raw tool call chunk from API stream.
   */
  public static processRawChunk(chunk: {
    index: number;
    id?: string;
    name?: string;
    arguments?: string;
  }): ToolCallStreamEvent[] {
    const events: ToolCallStreamEvent[] = [];
    const { index, id, name, arguments: args } = chunk;

    let tracked = this.rawChunkTracker.get(index);

    // Initialize new tool call tracking when we receive an id
    if (id && !tracked) {
      tracked = {
        id,
        name: name || '',
        hasStarted: false,
        deltaBuffer: [],
      };
      this.rawChunkTracker.set(index, tracked);
    }

    if (!tracked) {
      return events;
    }

    // Update name if present in chunk and not yet set
    if (name) {
      tracked.name = name;
    }

    // Emit start event when we have name
    if (!tracked.hasStarted && tracked.name) {
      events.push({
        type: 'tool_call_start',
        id: tracked.id,
        name: tracked.name,
      });
      tracked.hasStarted = true;

      // Flush buffered deltas
      for (const bufferedDelta of tracked.deltaBuffer) {
        events.push({
          type: 'tool_call_delta',
          id: tracked.id,
          delta: bufferedDelta,
        });
      }
      tracked.deltaBuffer = [];
    }

    // Emit delta event for argument chunks
    if (args) {
      if (tracked.hasStarted) {
        events.push({
          type: 'tool_call_delta',
          id: tracked.id,
          delta: args,
        });
      } else {
        tracked.deltaBuffer.push(args);
      }
    }

    return events;
  }

  /**
   * Process stream finish reason.
   */
  public static processFinishReason(
    finishReason: string | null | undefined,
  ): ToolCallStreamEvent[] {
    const events: ToolCallStreamEvent[] = [];

    if (finishReason === 'tool_calls' && this.rawChunkTracker.size > 0) {
      for (const [, tracked] of this.rawChunkTracker.entries()) {
        events.push({
          type: 'tool_call_end',
          id: tracked.id,
        });
      }
      this.rawChunkTracker.clear();
    }

    return events;
  }

  /**
   * Finalize any remaining tool calls that weren't explicitly ended.
   */
  public static finalizeRawChunks(): ToolCallStreamEvent[] {
    const events: ToolCallStreamEvent[] = [];

    if (this.rawChunkTracker.size > 0) {
      for (const [, tracked] of this.rawChunkTracker.entries()) {
        if (tracked.hasStarted) {
          events.push({
            type: 'tool_call_end',
            id: tracked.id,
          });
        }
      }
      this.rawChunkTracker.clear();
    }

    return events;
  }

  /**
   * Clear all raw chunk tracking state.
   */
  public static clearRawChunkState(): void {
    this.rawChunkTracker.clear();
  }

  /**
   * Start streaming a new tool call.
   */
  public static startStreamingToolCall(id: string, name: string): void {
    this.streamingToolCalls.set(id, {
      id,
      name,
      argumentsAccumulator: '',
    });
  }

  /**
   * Clear all streaming tool call state.
   */
  public static clearAllStreamingToolCalls(): void {
    this.streamingToolCalls.clear();
  }

  /**
   * Process a chunk of JSON arguments for a streaming tool call.
   */
  public static processStreamingChunk(
    id: string,
    chunk: string,
  ): any | null {
    const toolCall = this.streamingToolCalls.get(id);
    if (!toolCall) {
      console.warn(
        `[NativeToolCallParser] Received chunk for unknown tool call: ${id}`,
      );
      return null;
    }

    // Accumulate JSON string
    toolCall.argumentsAccumulator += chunk;

    // For dynamic MCP tools, we don't return partial updates - wait for final
    if (toolCall.name.startsWith('mcp_')) {
      return null;
    }

    // Parse whatever we can from incomplete JSON!
    try {
      const partialArgs = parseJSON(toolCall.argumentsAccumulator);

      // Create partial ToolUse with extracted values
      return this.createPartialToolUse(
        toolCall.id,
        toolCall.name as ToolName,
        partialArgs || {},
        true, // partial
      );
    } catch {
      // Even partial-json-parser can fail on severely malformed JSON
      // Return null and wait for next chunk
      return null;
    }
  }

  /**
   * Finalize a streaming tool call.
   */
  public static finalizeStreamingToolCall(
    id: string,
  ): any | null {
    const toolCall = this.streamingToolCalls.get(id);
    if (!toolCall) {
      console.warn(
        `[NativeToolCallParser] Attempting to finalize unknown tool call: ${id}`,
      );
      return null;
    }

    // Parse complete accumulated JSON
    const finalToolUse = this.parseToolCall({
      id: toolCall.id,
      name: toolCall.name as ToolName,
      arguments: toolCall.argumentsAccumulator,
    });

    // Clean up streaming state
    this.streamingToolCalls.delete(id);

    return finalToolUse;
  }

  /**
   * Convert a native tool call chunk to a ToolUse object.
   */
  public static parseToolCall<TName extends ToolName>(toolCall: {
    id: string;
    name: TName;
    arguments: string;
  }): any | null {
    // Check if this is a dynamic MCP tool (mcp_serverName_toolName)
    if (typeof toolCall.name === 'string' && toolCall.name.startsWith('mcp_')) {
      return this.parseDynamicMcpTool(toolCall);
    }

    // Validate tool name
    if (!toolNames.includes(toolCall.name as ToolName)) {
      console.error(`Invalid tool name: ${toolCall.name}`);
      console.error(`Valid tool names:`, toolNames);
      return null;
    }

    try {
      // Parse arguments JSON string
      const args = JSON.parse(toolCall.arguments);

      // Build legacy params object for backward compatibility
      const params: Partial<Record<ToolParamName, string>> = {};

      for (const [key, value] of Object.entries(args)) {
        // Validate parameter name
        if (!toolParamNames.includes(key as ToolParamName)) {
          console.warn(
            `Unknown parameter '${key}' for tool '${toolCall.name}'`,
          );
          console.warn(`Valid param names:`, toolParamNames);
          continue;
        }

        // Convert to string for legacy params format
        const stringValue =
          typeof value === 'string' ? value : JSON.stringify(value);
        params[key as ToolParamName] = stringValue;
      }

      // Build typed nativeArgs for tools that support it
      let nativeArgs: any = undefined;

      switch (toolCall.name) {
        case 'read_file':
          if (args.files && Array.isArray(args.files)) {
            nativeArgs = { files: this.convertFileEntries(args.files) };
          }
          break;

        case 'attempt_completion':
          if (args.result) {
            nativeArgs = { result: args.result };
          }
          break;

        case 'execute_command':
          if (args.command) {
            nativeArgs = {
              command: args.command,
              cwd: args.cwd,
            };
          }
          break;

        case 'write_to_file':
          if (args.path || args.content) {
            nativeArgs = {
              path: args.path,
              content: args.content,
            };
          }
          break;

        case 'ask_followup_question':
          if (
            args.question !== undefined ||
            args.follow_up !== undefined
          ) {
            nativeArgs = {
              question: args.question,
              follow_up: Array.isArray(args.follow_up)
                ? args.follow_up
                : undefined,
            };
          }
          break;

        case 'apply_diff':
          if (args.path !== undefined || args.diff !== undefined) {
            nativeArgs = {
              path: args.path,
              diff: args.diff,
            };
          }
          break;

        case 'browser_action':
          if (args.action !== undefined) {
            nativeArgs = {
              action: args.action,
              url: args.url,
              coordinate: args.coordinate,
              size: args.size,
              text: args.text,
            };
          }
          break;

        case 'codebase_search':
          if (args.query !== undefined) {
            nativeArgs = {
              query: args.query,
              path: args.path,
            };
          }
          break;

        case 'fetch_instructions':
          if (args.task !== undefined) {
            nativeArgs = {
              task: args.task,
            };
          }
          break;

        case 'generate_image':
          if (
            args.prompt !== undefined ||
            args.path !== undefined
          ) {
            nativeArgs = {
              prompt: args.prompt,
              path: args.path,
              image: args.image,
            };
          }
          break;

        case 'list_code_definition_names':
          if (args.path !== undefined) {
            nativeArgs = {
              path: args.path,
            };
          }
          break;

        case 'run_slash_command':
          if (args.command !== undefined) {
            nativeArgs = {
              command: args.command,
              args: args.args,
            };
          }
          break;

        case 'search_files':
          if (args.path !== undefined || args.regex !== undefined) {
            nativeArgs = {
              path: args.path,
              regex: args.regex,
              file_pattern: args.file_pattern,
            };
          }
          break;

        case 'switch_mode':
          if (
            args.mode_slug !== undefined ||
            args.reason !== undefined
          ) {
            nativeArgs = {
              mode_slug: args.mode_slug,
              reason: args.reason,
            };
          }
          break;

        case 'update_todo_list':
          if (args.todos !== undefined) {
            nativeArgs = {
              todos: args.todos,
            };
          }
          break;

        case 'use_mcp_tool':
          if (
            args.server_name !== undefined ||
            args.tool_name !== undefined
          ) {
            nativeArgs = {
              server_name: args.server_name,
              tool_name: args.tool_name,
              arguments: args.arguments,
            };
          }
          break;

        case 'apply_patch':
          if (args.patch !== undefined) {
            nativeArgs = {
              patch: args.patch,
            };
          }
          break;

        case 'search_replace':
          if (
            args.file_path !== undefined ||
            args.old_string !== undefined ||
            args.new_string !== undefined
          ) {
            nativeArgs = {
              file_path: args.file_path,
              old_string: args.old_string,
              new_string: args.new_string,
            };
          }
          break;

        // Add other tools as needed
        default:
          break;
      }

      return {
        type: 'tool_use' as const,
        name: toolCall.name,
        params,
        nativeArgs,
      };
    } catch (error) {
      console.error(`Error parsing tool call: ${error}`);
      return null;
    }
  }

  /**
   * Convert raw file entries from API to FileEntry objects
   */
  private static convertFileEntries(files: any[]): FileEntry[] {
    return files.map((file: any) => {
      const entry: FileEntry = { path: file.path };
      if (file.line_ranges && Array.isArray(file.line_ranges)) {
        entry.lineRanges = file.line_ranges
          .map((range: any) => {
            // Handle tuple format: [start, end]
            if (Array.isArray(range) && range.length >= 2) {
              return { start: Number(range[0]), end: Number(range[1]) };
            }
            // Handle object format: { start: number, end: number }
            if (
              typeof range === 'object' &&
              range !== null &&
              'start' in range &&
              'end' in range
            ) {
              return { start: Number(range.start), end: Number(range.end) };
            }
            // Handle legacy string format: "1-50"
            if (typeof range === 'string') {
              const match = range.match(/^(\d+)-(\d+)$/);
              if (match) {
                return {
                  start: parseInt(match[1], 10),
                  end: parseInt(match[2], 10),
                };
              }
            }
            return null;
          })
          .filter(Boolean);
      }
      return entry;
    });
  }

  /**
   * Create a partial ToolUse from currently parsed arguments.
   */
  private static createPartialToolUse(
    id: string,
    name: ToolName,
    partialArgs: Record<string, any>,
    partial: boolean,
  ): any | null {
    // Build legacy params for display
    const params: Partial<Record<ToolParamName, string>> = {};

    for (const [key, value] of Object.entries(partialArgs)) {
      if (toolParamNames.includes(key as ToolParamName)) {
        params[key as ToolParamName] =
          typeof value === 'string' ? value : JSON.stringify(value);
      }
    }

    // Build partial nativeArgs based on what we have so far
    let nativeArgs: any = undefined;

    switch (name) {
      case 'read_file':
        if (partialArgs['files'] && Array.isArray(partialArgs['files'])) {
          nativeArgs = { files: this.convertFileEntries(partialArgs['files']) };
        }
        break;

      case 'attempt_completion':
        if (partialArgs['result']) {
          nativeArgs = { result: partialArgs['result'] };
        }
        break;

      case 'execute_command':
        if (partialArgs['command']) {
          nativeArgs = {
            command: partialArgs['command'],
            cwd: partialArgs['cwd'],
          };
        }
        break;

      case 'write_to_file':
        if (partialArgs['path'] || partialArgs['content']) {
          nativeArgs = {
            path: partialArgs['path'],
            content: partialArgs['content'],
          };
        }
        break;

      case 'ask_followup_question':
        if (
          partialArgs['question'] !== undefined ||
          partialArgs['follow_up'] !== undefined
        ) {
          nativeArgs = {
            question: partialArgs['question'],
            follow_up: Array.isArray(partialArgs['follow_up'])
              ? partialArgs['follow_up']
              : undefined,
          };
        }
        break;

      case 'apply_diff':
        if (partialArgs['path'] !== undefined || partialArgs['diff'] !== undefined) {
          nativeArgs = {
            path: partialArgs['path'],
            diff: partialArgs['diff'],
          };
        }
        break;

      case 'browser_action':
        if (partialArgs['action'] !== undefined) {
          nativeArgs = {
            action: partialArgs['action'],
            url: partialArgs['url'],
            coordinate: partialArgs['coordinate'],
            size: partialArgs['size'],
            text: partialArgs['text'],
          };
        }
        break;

      case 'codebase_search':
        if (partialArgs['query'] !== undefined) {
          nativeArgs = {
            query: partialArgs['query'],
            path: partialArgs['path'],
          };
        }
        break;

      case 'fetch_instructions':
        if (partialArgs['task'] !== undefined) {
          nativeArgs = {
            task: partialArgs['task'],
          };
        }
        break;

      case 'generate_image':
        if (
          partialArgs['prompt'] !== undefined ||
          partialArgs['path'] !== undefined
        ) {
          nativeArgs = {
            prompt: partialArgs['prompt'],
            path: partialArgs['path'],
            image: partialArgs['image'],
          };
        }
        break;

      case 'list_code_definition_names':
        if (partialArgs['path'] !== undefined) {
          nativeArgs = {
            path: partialArgs['path'],
          };
        }
        break;

      case 'run_slash_command':
        if (partialArgs['command'] !== undefined) {
          nativeArgs = {
            command: partialArgs['command'],
            args: partialArgs['args'],
          };
        }
        break;

      case 'search_files':
        if (partialArgs['path'] !== undefined || partialArgs['regex'] !== undefined) {
          nativeArgs = {
            path: partialArgs['path'],
            regex: partialArgs['regex'],
            file_pattern: partialArgs['file_pattern'],
          };
        }
        break;

      case 'switch_mode':
        if (
          partialArgs['mode_slug'] !== undefined ||
          partialArgs['reason'] !== undefined
        ) {
          nativeArgs = {
            mode_slug: partialArgs['mode_slug'],
            reason: partialArgs['reason'],
          };
        }
        break;

      case 'update_todo_list':
        if (partialArgs['todos'] !== undefined) {
          nativeArgs = {
            todos: partialArgs['todos'],
          };
        }
        break;

      case 'use_mcp_tool':
        if (
          partialArgs['server_name'] !== undefined ||
          partialArgs['tool_name'] !== undefined
        ) {
          nativeArgs = {
            server_name: partialArgs['server_name'],
            tool_name: partialArgs['tool_name'],
            arguments: partialArgs['arguments'],
          };
        }
        break;

      case 'apply_patch':
        if (partialArgs['patch'] !== undefined) {
          nativeArgs = {
            patch: partialArgs['patch'],
          };
        }
        break;

      case 'search_replace':
        if (
          partialArgs['file_path'] !== undefined ||
          partialArgs['old_string'] !== undefined ||
          partialArgs['new_string'] !== undefined
        ) {
          nativeArgs = {
            file_path: partialArgs['file_path'],
            old_string: partialArgs['old_string'],
            new_string: partialArgs['new_string'],
          };
        }
        break;

      // Add other tools as needed
      default:
        break;
    }

    return {
      type: 'tool_use' as const,
      name,
      params,
      partial,
      nativeArgs,
    };
  }

  /**
   * Parse dynamic MCP tool call
   */
  private static parseDynamicMcpTool(toolCall: {
    id: string;
    name: string;
    arguments: string;
  }): any | null {
    try {
      const args = JSON.parse(toolCall.arguments);
      return {
        type: 'tool_use' as const,
        name: toolCall.name,
        params: args,
        nativeArgs: {
          server_name: args.server_name,
          tool_name: args.tool_name,
          arguments: args.arguments,
        },
      };
    } catch (error) {
      console.error(`Error parsing MCP tool call: ${error}`);
      return null;
    }
  }
}