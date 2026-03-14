import { AssistantMessageContent, ToolUse } from '../../assistant-message/assistantMessageTypes';

export default class XMLToolCallingParser {
    private contentBlocks: AssistantMessageContent[] = [];
    private currentTextContent: string = '';
    private currentToolUse: ToolUse | null = null;
    private currentParamName: string | null = null;
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

            // Check for parameter opening tag (any tag inside a tool use)
            if (this.currentToolUse) {
                const paramMatch = this.findAnyOpeningTag(message, pos);
                if (paramMatch) {
                    this.currentParamName = paramMatch.tagName;
                    this.currentParamValue = '';
                    this.paramTagDepth = 0; // Start at depth 0
                    pos = paramMatch.endPos;
                    continue;
                }
            }

            // Check for any opening tag (only if not inside a parameter or tool use)
            if (!this.currentToolUse) {
                const tagMatch = this.findAnyOpeningTag(message, pos);
                if (tagMatch) {
                    // Flush any pending text content
                    this.flushTextContent();

                    // Start new tool use
                    this.currentToolUse = {
                        type: 'tool_use',
                        name: tagMatch.tagName,
                        params: {},
                        partial: true,
                    };
                    pos = tagMatch.endPos;
                    continue;
                }
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

            // Accumulate text content (only if not inside a tool)
            if (!this.currentToolUse) {
                this.currentTextContent += message[pos];
            }

            pos++;
        }
    }

    private findAnyOpeningTag(message: string, pos: number): { tagName: string; endPos: number } | null {
        if (message[pos] !== '<') {
            return null;
        }

        // Find closing '>' for the opening tag
        const tagEndIndex = message.indexOf('>', pos);
        if (tagEndIndex === -1) {
            return null;
        }

        // Extract tag name (between < and >, excluding the < and >)
        const tagName = message.substring(pos + 1, tagEndIndex);

        // Validate tag name: must be alphanumeric with underscores, hyphens, or colons
        if (!/^[a-zA-Z_][a-zA-Z0-9_:-]*$/.test(tagName)) {
            return null;
        }

        return { tagName, endPos: tagEndIndex + 1 };
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
