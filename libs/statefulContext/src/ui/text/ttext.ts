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
        const { content } = this.metadata;
        const finalContent = content ?? '';

        // If availableWidth is specified and content is longer, wrap the content
        if (availableWidth && finalContent.length > availableWidth) {
            const wrappedLines = this.wrapContent(finalContent, availableWidth);
            return wrappedLines.map(line => this.applyTextStyle(line)).join('\n');
        }

        return this.applyTextStyle(finalContent);
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
    protected override calculateContentDimensions(): { width: number; height: number } {
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
