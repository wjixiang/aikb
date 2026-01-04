import { AssistantMessageContent, ToolName, toolNames, ToolParamName, toolParamNames, ToolUse } from '../../assistant-message/assistantMessageTypes';

export default class XMLToolCallingParser {
    private contentBlocks: AssistantMessageContent[] = [];
    private currentTextContent: string = '';
    private currentToolUse: ToolUse | null = null;
    private currentParamName: ToolParamName | null = null;
    private currentParamValue: string = '';
    private paramTagDepth: number = 0; // Track nesting depth of current parameter tag
    private inCodeBlock: boolean = false; // Track if we're inside a code block (```)
    private codeBlockDelimiter: string = ''; // Track the current code block delimiter (``` or ~~~)

    processMessage(assistantMessage: string): AssistantMessageContent[] {
        this.reset();
        this.parse(assistantMessage);
        this.finalize();
        return this.contentBlocks;
    }

    private reset(): void {
        this.contentBlocks = [];
        this.currentTextContent = '';
        this.currentToolUse = null;
        this.currentParamName = null;
        this.currentParamValue = '';
        this.paramTagDepth = 0;
    }

    private parse(message: string): void {
        let pos = 0;
        const length = message.length;

        while (pos < length) {
            // If we're inside a parameter value, accumulate until we find its closing tag
            if (this.currentParamName && this.currentToolUse) {
                const paramClosingTag = `</${this.currentParamName}>`;
                if (message.substring(pos).startsWith(paramClosingTag)) {
                    // Only close if we're at the correct nesting level
                    if (this.paramTagDepth === 0) {
                        // Store parameter value
                        if (!this.currentToolUse.params) {
                            this.currentToolUse.params = {};
                        }
                        // Trim content parameters differently to preserve newlines
                        this.currentToolUse.params[this.currentParamName] =
                            this.currentParamName === 'content'
                                ? this.currentParamValue.replace(/^\n/, '').replace(/\n$/, '')
                                : this.currentParamValue.trim();
                        this.currentParamName = null;
                        this.currentParamValue = '';
                        this.paramTagDepth = 0;
                        pos += paramClosingTag.length;
                        continue;
                    } else {
                        // This is a nested closing tag, accumulate it as part of value and decrement depth
                        this.currentParamValue += message[pos];
                        pos++;
                        continue;
                    }
                }
                // Check for opening tag of same type (nested)
                const paramOpeningTag = `<${this.currentParamName}>`;
                if (message.substring(pos).startsWith(paramOpeningTag)) {
                    this.paramTagDepth++;
                    pos += paramOpeningTag.length;
                    continue;
                }
                // Accumulate parameter value (including any characters that look like tags)
                this.currentParamValue += message[pos];
                pos++;
                continue;
            }

            // Check for tool opening tag (only if not inside a parameter)
            const toolMatch = this.findOpeningTag(message, pos, toolNames);
            if (toolMatch) {
                // Flush any pending text content
                this.flushTextContent();

                // Start new tool use
                this.currentToolUse = {
                    type: 'tool_use',
                    name: toolMatch.tagName as ToolName,
                    params: {},
                    partial: true,
                };
                pos = toolMatch.endPos;
                continue;
            }

            // Check for tool closing tag
            if (this.currentToolUse) {
                const toolClosingTag = `</${this.currentToolUse.name}>`;
                if (message.substring(pos).startsWith(toolClosingTag)) {
                    // End of tool use
                    this.currentToolUse.partial = false;
                    this.contentBlocks.push(this.currentToolUse);
                    this.currentToolUse = null;
                    pos += toolClosingTag.length;
                    continue;
                }
            }

            // Check for parameter opening tag
            if (this.currentToolUse) {
                const paramMatch = this.findOpeningTag(message, pos, toolParamNames);
                if (paramMatch) {
                    this.currentParamName = paramMatch.tagName as ToolParamName;
                    this.currentParamValue = '';
                    this.paramTagDepth = 0; // Start at depth 0
                    pos = paramMatch.endPos;
                    continue;
                }
            }

            // Accumulate text content (only if not inside a tool)
            if (!this.currentToolUse) {
                this.currentTextContent += message[pos];
            }

            pos++;
        }
    }

    private findOpeningTag(
        message: string,
        pos: number,
        validTags: readonly string[],
    ): { tagName: string; endPos: number } | null {
        if (message[pos] !== '<') {
            return null;
        }

        for (const tag of validTags) {
            const openingTag = `<${tag}>`;
            if (message.substring(pos).startsWith(openingTag)) {
                return { tagName: tag, endPos: pos + openingTag.length };
            }
        }

        return null;
    }

    private flushTextContent(): void {
        if (this.currentTextContent.trim()) {
            this.contentBlocks.push({
                type: 'text',
                content: this.currentTextContent.trim(),
            });
        }
        this.currentTextContent = '';
    }

    private finalize(): void {
        // Flush any remaining text content
        this.flushTextContent();

        // Handle any incomplete tool use
        if (this.currentToolUse) {
            this.contentBlocks.push(this.currentToolUse);
        }
    }
}
