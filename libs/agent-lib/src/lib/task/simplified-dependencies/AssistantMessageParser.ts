import { AssistantMessageContent, TextContent, ToolUse } from './assistantMessageTypes';

/**
 * Simplified Assistant Message Parser
 * Extracted from core/assistant-message/AssistantMessageParser.ts
 */
export class AssistantMessageParser {
  private contentBlocks: AssistantMessageContent[] = [];
  private currentTextContent: TextContent | undefined = undefined;
  private currentToolUse: ToolUse | undefined = undefined;
  private currentTextContentStartIndex = 0;
  private currentToolUseStartIndex = 0;
  private currentParamName: any = undefined;
  private currentParamValueStartIndex = 0;
  private readonly MAX_ACCUMULATOR_SIZE = 1024 * 1024; // 1MB limit
  private readonly MAX_PARAM_LENGTH = 1024 * 100; // 100KB per parameter limit
  private accumulator = '';

  /**
   * Initialize a new AssistantMessageParser instance.
   */
  constructor() {
    this.reset();
  }

  /**
   * Reset the parser state.
   */
  public reset(): void {
    this.contentBlocks = [];
    this.currentTextContent = undefined;
    this.currentTextContentStartIndex = 0;
    this.currentToolUse = undefined;
    this.currentToolUseStartIndex = 0;
    this.currentParamName = undefined;
    this.currentParamValueStartIndex = 0;
    this.accumulator = '';
  }

  /**
   * Returns the current parsed content blocks.
   */
  public getContentBlocks(): AssistantMessageContent[] {
    // Return a shallow copy to prevent external mutation
    return this.contentBlocks.slice();
  }

  /**
   * Process a new chunk of text and update the parser state.
   */
  public processChunk(chunk: string): AssistantMessageContent[] {
    if (this.accumulator.length + chunk.length > this.MAX_ACCUMULATOR_SIZE) {
      throw new Error('Assistant message exceeds maximum allowed size');
    }

    // Store current length of accumulator before adding new chunk
    const accumulatorStartLength = this.accumulator.length;

    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];
      this.accumulator += char;
      const currentPosition = accumulatorStartLength + i;

      // There should not be a param without a tool use.
      if (this.currentToolUse && this.currentParamName) {
        const currentParamValue = this.accumulator.slice(
          this.currentParamValueStartIndex,
        );
        if (currentParamValue.length > this.MAX_PARAM_LENGTH) {
          // Reset to a safe state
          this.currentParamName = undefined;
          this.currentParamValueStartIndex = 0;
          continue;
        }
        const paramClosingTag = `</${this.currentParamName}>`;
        // Streamed param content: always write the currently accumulated value
        if (currentParamValue.endsWith(paramClosingTag)) {
          // End of param value.
          this.currentToolUse.params[this.currentParamName] =
            this.currentParamName === 'content'
              ? currentParamValue.replace(/^\n/, '').replace(/\n$/, '')
              : currentParamValue.trim();
          this.currentParamName = undefined;
          continue;
        }
      }

      // No currentParamName.
      if (this.currentToolUse) {
        const currentToolValue = this.accumulator.slice(
          this.currentToolUseStartIndex,
        );
        const toolUseClosingTag = `</${this.currentToolUse.name}>`;
        if (currentToolValue.endsWith(toolUseClosingTag)) {
          // End of a tool use.
          this.currentToolUse.partial = false;
          this.currentToolUse = undefined;
          continue;
        }
      }

      // No currentToolUse.
      let didStartToolUse = false;
      const possibleToolUseOpeningTags = ['<read_file>', '<attempt_completion>', '<execute_command>', '<write_to_file>', '<ask_followup_question>', '<apply_diff>', '<browser_action>', '<codebase_search>', '<fetch_instructions>', '<generate_image>', '<list_code_definition_names>', '<run_slash_command>', '<search_files>', '<switch_mode>', '<update_todo_list>', '<use_mcp_tool>', '<apply_patch>', '<search_replace>', '<access_mcp_resource>'];

      for (const toolUseOpeningTag of possibleToolUseOpeningTags) {
        if (this.accumulator.endsWith(toolUseOpeningTag)) {
          // Extract and validate the tool name
          const extractedToolName = toolUseOpeningTag.slice(1, -1);
          
          // Start of a new tool use.
          this.currentToolUse = {
            type: 'tool_use',
            name: extractedToolName,
            params: {},
            partial: true,
          };
          this.currentToolUseStartIndex = this.accumulator.length;
          didStartToolUse = true;
          break;
        }
      }

      // No currentToolUse.
      if (!didStartToolUse) {
        // If this is the first chunk and we're at the beginning of processing,
        // set start index to the current position in the accumulator
        this.currentTextContentStartIndex = this.accumulator.length;
        // Create a new text content block and add it to contentBlocks immediately
        // Ensures it appears in UI right away
        this.currentTextContent = {
          type: 'text',
          content: this.accumulator
            .slice(this.currentTextContentStartIndex)
            .trim(),
          partial: true,
        };
        this.contentBlocks.push(this.currentTextContent);
      }
    }

    // Do not call finalizeContentBlocks() here.
    // Instead, update any partial blocks in the array and add new ones as they're completed.
    // This matches the behavior of the original parseAssistantMessage function.
    return this.getContentBlocks();
  }

  /**
   * Finalize any partial content blocks.
   */
  public finalizeContentBlocks(): void {
    // Mark all partial blocks as complete
    for (const block of this.contentBlocks) {
      if (block.partial) {
        block.partial = false;
        if (block.type === 'text' && typeof block.content === 'string') {
          block.content = block.content.trim();
        }
      }
    }
  }
}