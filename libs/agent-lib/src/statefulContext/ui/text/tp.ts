/**
 * tp (paragraph) element - similar to HTML <p>
 */

import { TUIElement } from '../TUIElement.js';
import { ElementMetadata, TextStyle } from '../../types.js';

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
    declare metadata: tpMetadata;

    constructor(metadata: tpMetadata) {
        super(metadata);
    }

    /**
     * Render paragraph element
     */
    render(): string {
        return this.renderWithWidth(undefined);
    }

    /**
     * Render paragraph element with a specified available width
     */
    override renderWithWidth(availableWidth: number | undefined): string {
        const styles = this.computeStyles(availableWidth);
        const content = this.metadata.content;
        const indent = this.metadata.indent ?? 0;
        const lineHeight = this.metadata.lineHeight ?? 1;
        const textStyle = this.metadata.textStyle ?? {};

        const finalContent = content ?? '';

        // Calculate inner content area dimensions
        const innerWidth = styles.width - styles.padding[1] - styles.padding[3] - (styles.border ? 2 : 0) - indent;
        const innerHeight = styles.height - styles.padding[0] - styles.padding[2] - (styles.border ? 2 : 0);

        let result = '';

        // Top margin
        for (let i = 0; i < styles.margin[0]; i++) {
            result += ' '.repeat(styles.margin[3]) + '\n';
        }

        // Top border
        if (styles.border) {
            result += ' '.repeat(styles.margin[3]);
            const borderChars = this.getBorderChars(styles.border);
            result += borderChars.topLeft + borderChars.horizontal.repeat(styles.width - 2) + borderChars.topRight + '\n';
        }

        // Top padding
        for (let i = 0; i < styles.padding[0]; i++) {
            result += ' '.repeat(styles.margin[3]);
            if (styles.border) {
                const borderChars = this.getBorderChars(styles.border);
                result += borderChars.vertical + ' '.repeat(styles.width - 2) + borderChars.vertical;
            } else {
                result += ' '.repeat(styles.width);
            }
            result += '\n';
        }

        // Apply text styling
        const styledContent = this.applyTextStyle(finalContent, textStyle);

        // Split into lines and wrap content like tdiv does
        let contentLines: string[] = [];
        const rawLines = styledContent.split('\n');
        for (let index = 0; index < rawLines.length; index++) {
            let currentLine = rawLines[index];
            // If innerWidth is available, wrap the content
            if (innerWidth > 0) {
                while (currentLine.length > innerWidth) {
                    contentLines.push(currentLine.slice(0, innerWidth));
                    currentLine = currentLine.slice(innerWidth);
                }
            }
            contentLines.push(currentLine);
        }

        // Apply indent to each line
        const indentStr = ' '.repeat(indent);
        const indentedLines = contentLines.map(line => indentStr + line);

        // Render content area
        const contentHeight = Math.max(innerHeight, indentedLines.length);
        for (let i = 0; i < contentHeight; i++) {
            const line = indentedLines[i] || '';
            result += ' '.repeat(styles.margin[3]);
            if (styles.border) {
                const borderChars = this.getBorderChars(styles.border);
                // Use innerWidth which already accounts for indent
                result += borderChars.vertical + this.padLine(line, innerWidth + indent, styles.align) + borderChars.vertical;
            } else {
                // Don't subtract indent because line already has indent added
                result += this.padLine(line, styles.width - styles.padding[1] - styles.padding[3], styles.align);
            }
            result += '\n';
        }

        // Bottom padding
        for (let i = 0; i < styles.padding[2]; i++) {
            result += ' '.repeat(styles.margin[3]);
            if (styles.border) {
                const borderChars = this.getBorderChars(styles.border);
                result += borderChars.vertical + ' '.repeat(styles.width - 2) + borderChars.vertical;
            } else {
                result += ' '.repeat(styles.width);
            }
            result += '\n';
        }

        // Bottom border
        if (styles.border) {
            result += ' '.repeat(styles.margin[3]);
            const borderChars = this.getBorderChars(styles.border);
            result += borderChars.bottomLeft + borderChars.horizontal.repeat(styles.width - 2) + borderChars.bottomRight + '\n';
        }

        // Bottom margin
        for (let i = 0; i < styles.margin[2]; i++) {
            result += ' '.repeat(styles.margin[3]) + '\n';
        }

        // Trim trailing newlines only if no bottom margin
        if (styles.margin[2] === 0) {
            result = result.trimEnd();
        }

        return result;
    }

    /**
     * Apply text styling to content
     */
    private applyTextStyle(content: string, style: TextStyle): string {
        let result = content;

        if (style.bold) {
            // Terminal doesn't support bold, but we can use uppercase for emphasis
            // result = result.toUpperCase();
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
    protected override calculateContentDimensions(availableWidth?: number): { width: number; height: number } {
        const content = this.metadata.content;
        const indent = this.metadata.indent ?? 0;

        const finalContent = content ?? '';
        const lines = finalContent.split('\n');

        const maxWidth = Math.max(...lines.map((line: string) => indent + line.length));
        const height = lines.length;

        return {
            width: maxWidth,
            height
        };
    }
}
