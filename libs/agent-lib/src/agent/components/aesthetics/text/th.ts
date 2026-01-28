/**
 * th (heading) element - similar to HTML <h1>-<h6>
 */

import { TUIElement } from '../TUIElement';
import { ElementMetadata, HeadingLevel, TextStyle } from '../types';

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
        const { content } = this.metadata;
        const level = this.metadata.level ?? 1;
        const underline = this.metadata.underline ?? false;
        const textStyle = this.metadata.textStyle ?? {};

        const finalContent = content ?? '';
        const styledContent = this.applyTextStyle(finalContent, textStyle);

        // Calculate width based on content
        const contentWidth = styledContent.length;

        // Add underline if specified
        let result = styledContent;
        if (underline) {
            result += '\n' + '─'.repeat(contentWidth);
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
    protected override calculateContentDimensions(): { width: number; height: number } {
        const { content } = this.metadata;
        const finalContent = content ?? '';
        const underline = this.metadata.underline ?? false;

        const lines = finalContent.split('\n');
        const maxWidth = Math.max(...lines.map(line => line.length));
        const height = lines.length + (underline ? 1 : 0);

        return {
            width: maxWidth,
            height
        };
    }
}
