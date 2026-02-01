/**
 * th (heading) element - similar to HTML <h1>-<h6>
 */

import { TUIElement } from '../TUIElement';
import { ElementMetadata, HeadingLevel, TextStyle } from '../../types';

/**
 * Metadata for th (heading) element
 */
export interface thMetadata extends ElementMetadata {
    /** Heading level (1-6) */
    level?: HeadingLevel;
    /** Whether to underline the heading */
    underline?: boolean;
    /** Text styling options */
    textStyle?: TextStyle;
}

/**
 * th (heading) element - displays text as a heading
 */
export class th extends TUIElement {
    constructor(public override metadata: thMetadata) {
        super(metadata);
    }

    /**
     * Render heading element
     */
    render(): string {
        return this.renderWithWidth(undefined);
    }

    /**
     * Render heading element with a specified available width
     */
    override renderWithWidth(availableWidth: number | undefined): string {
        const styles = this.computeStyles(availableWidth);
        const { content } = this.metadata;
        const level = this.metadata.level ?? 1;
        const underline = this.metadata.underline ?? false;
        const textStyle = this.metadata.textStyle ?? {};

        const finalContent = content ?? '';
        const styledContent = this.applyTextStyle(finalContent, textStyle);

        // Calculate inner content area dimensions
        const innerWidth = styles.width - styles.padding[1] - styles.padding[3] - (styles.border ? 2 : 0);
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

        // Wrap content to fit inner width
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

        // Render content area
        const contentHeight = Math.max(innerHeight, contentLines.length + (underline ? contentLines.length : 0));
        for (let i = 0; i < contentLines.length; i++) {
            const line = contentLines[i];
            result += ' '.repeat(styles.margin[3]);
            if (styles.border) {
                const borderChars = this.getBorderChars(styles.border);
                result += borderChars.vertical + this.padLine(line, styles.width - 2, styles.align) + borderChars.vertical;
            } else {
                result += this.padLine(line, styles.width - styles.padding[1] - styles.padding[3], styles.align);
            }
            result += '\n';

            // Add underline after each line if specified
            if (underline) {
                const underlineLine = '─'.repeat(Math.min(line.length, styles.width - styles.padding[1] - styles.padding[3] - (styles.border ? 2 : 0)));
                result += ' '.repeat(styles.margin[3]);
                if (styles.border) {
                    const borderChars = this.getBorderChars(styles.border);
                    result += borderChars.vertical + this.padLine(underlineLine, styles.width - 2, styles.align) + borderChars.vertical;
                } else {
                    result += this.padLine(underlineLine, styles.width - styles.padding[1] - styles.padding[3], styles.align);
                }
                result += '\n';
            }
        }

        // Fill remaining content height with empty lines
        const remainingHeight = contentHeight - contentLines.length - (underline ? contentLines.length : 0);
        for (let i = 0; i < remainingHeight; i++) {
            result += ' '.repeat(styles.margin[3]);
            if (styles.border) {
                const borderChars = this.getBorderChars(styles.border);
                result += borderChars.vertical + ' '.repeat(styles.width - 2) + borderChars.vertical;
            } else {
                result += ' '.repeat(styles.width);
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
    protected override calculateContentDimensions(availableWidth?: number): { width: number; height: number } {
        const { content } = this.metadata;
        const finalContent = content ?? '';
        const underline = this.metadata.underline ?? false;

        const lines = finalContent.split('\n');
        const maxWidth = Math.max(...lines.map(line => line.length));
        const height = lines.length + (underline ? lines.length : 0);

        return {
            width: maxWidth,
            height
        };
    }
}
