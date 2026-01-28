/**
 * tp (paragraph) element - similar to HTML <p>
 */

import { TUIElement } from '../TUIElement';
import { ElementMetadata, TextStyle } from '../types';

/**
 * Metadata for tp (paragraph) element
 */
export interface tpMetadata extends ElementMetadata {
    /** Number of spaces to indent the paragraph */
    indent?: number;
    /** Line height multiplier */
    lineHeight?: number;
    /** Text styling options */
    textStyle?: TextStyle;
}

/**
 * tp (paragraph) element - displays text as a paragraph
 */
export class tp extends TUIElement {
    constructor(public override metadata: tpMetadata) {
        super(metadata);
    }

    /**
     * Render paragraph element
     */
    render(): string {
        const { content } = this.metadata;
        const indent = this.metadata.indent ?? 0;
        const lineHeight = this.metadata.lineHeight ?? 1;
        const textStyle = this.metadata.textStyle ?? {};

        const finalContent = content ?? '';

        // Apply text styling
        const styledContent = this.applyTextStyle(finalContent, textStyle);

        // Split into lines
        const lines = styledContent.split('\n');

        // Apply indent to each line
        const indentStr = ' '.repeat(indent);
        const indentedLines = lines.map(line => indentStr + line);

        return indentedLines.join('\n');
    }

    /**
     * Apply text styling to content
     */
    private applyTextStyle(content: string, style: TextStyle): string {
        let result = content;

        if (style.bold) {
            // Terminal doesn't support bold, but we can use uppercase for emphasis
            result = result.toUpperCase();
        }

        if (style.italic) {
            // Terminal doesn't support italic, skip
        }

        if (style.strikethrough) {
            // Terminal doesn't support strikethrough, skip
        }

        return result;
    }

    /**
     * Calculate content dimensions
     */
    protected override calculateContentDimensions(): { width: number; height: number } {
        const { content } = this.metadata;
        const indent = this.metadata.indent ?? 0;

        const finalContent = content ?? '';
        const lines = finalContent.split('\n');

        const maxWidth = Math.max(...lines.map(line => indent + line.length));
        const height = lines.length;

        return {
            width: maxWidth,
            height
        };
    }
}
