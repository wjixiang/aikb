/**
 * ttext (text) element - basic styled text
 */

import { TUIElement } from '../TUIElement';
import { ElementMetadata, TextStyle, TextColor } from '../../types';

/**
 * Metadata for ttext (text) element
 */
export interface ttextMetadata extends ElementMetadata {
    /** Whether text should be bold */
    bold?: boolean;
    /** Whether text should be italic */
    italic?: boolean;
    /** Whether text should be underlined */
    underline?: boolean;
    /** Whether text should have strikethrough */
    strikethrough?: boolean;
    /** Text color */
    color?: TextColor;
    /** Background color */
    backgroundColor?: TextColor;
}

/**
 * ttext (text) element - displays styled text
 */
export class ttext extends TUIElement {
    constructor(public override metadata: ttextMetadata) {
        super(metadata);
    }

    /**
     * Render text element
     */
    render(): string {
        return this.renderWithWidth(undefined);
    }

    /**
     * Render text element with a specified available width
     */
    override renderWithWidth(availableWidth: number | undefined): string {
        const styles = this.computeStyles(availableWidth);
        const { content } = this.metadata;
        const finalContent = content ?? '';

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
        const rawLines = finalContent.split('\n');
        for (let index = 0; index < rawLines.length; index++) {
            let currentLine = rawLines[index];
            // If innerWidth is available, wrap the content
            if (innerWidth > 0) {
                while (currentLine.length > innerWidth) {
                    contentLines.push(currentLine.slice(0, innerWidth));
                    currentLine = currentLine.slice(innerWidth + 1);
                }
            }
            contentLines.push(currentLine);
        }

        // Apply text styling to each line and handle underline/strikethrough
        const styledLines: string[] = [];
        for (const line of contentLines) {
            styledLines.push(line);
            if (this.metadata.underline || this.metadata.strikethrough) {
                styledLines.push('─'.repeat(line.length));
            }
        }

        // Render content area
        const contentHeight = Math.max(innerHeight, styledLines.length);
        for (let i = 0; i < contentHeight; i++) {
            const line = styledLines[i] || '';
            result += ' '.repeat(styles.margin[3]);
            if (styles.border) {
                const borderChars = this.getBorderChars(styles.border);
                result += borderChars.vertical + this.padLine(line, styles.width - 2, styles.align) + borderChars.vertical;
            } else {
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
    private applyTextStyle(content: string): string {
        let result = content;

        // Apply bold (uppercase for terminal)
        if (this.metadata.bold) {
            result = result.toUpperCase();
        }

        // Apply underline
        if (this.metadata.underline) {
            result = this.addUnderline(result);
        }

        // Apply strikethrough
        if (this.metadata.strikethrough) {
            result = this.addStrikethrough(result);
        }

        // Note: italic and colors are not supported in basic terminal
        // They would require ANSI escape codes which may not work in all terminals

        return result;
    }

    /**
     * Add underline to text
     */
    private addUnderline(text: string): string {
        const lines = text.split('\n');
        const result: string[] = [];

        for (const line of lines) {
            result.push(line);
            result.push(' '.repeat(line.length).replace(/ /g, '─'));
        }

        return result.join('\n');
    }

    /**
     * Add strikethrough to text
     */
    private addStrikethrough(text: string): string {
        const lines = text.split('\n');
        const result: string[] = [];

        for (const line of lines) {
            result.push(line);
            result.push(' '.repeat(line.length).replace(/ /g, '─'));
        }

        return result.join('\n');
    }

    /**
     * Calculate content dimensions
     */
    protected override calculateContentDimensions(availableWidth?: number): { width: number; height: number } {
        const { content } = this.metadata;
        const finalContent = content ?? '';

        const lines = finalContent.split('\n');
        const maxWidth = Math.max(...lines.map(line => line.length));

        // Add extra height for underline or strikethrough
        let extraHeight = 0;
        if (this.metadata.underline || this.metadata.strikethrough) {
            extraHeight = lines.length;
        }

        return {
            width: maxWidth,
            height: lines.length + extraHeight
        };
    }
}
