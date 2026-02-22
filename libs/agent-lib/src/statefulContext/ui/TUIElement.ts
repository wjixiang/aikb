/**
 * Base class for all TUI elements
 * Provides common functionality and rendering infrastructure
 */

import {
    ElementMetadata,
    ComputedStyles,
    Spacing,
    PaddingStyle,
    MarginStyle,
    border,
    BoxBorders,
    BoxBorderChars
} from '../types.js';

/**
 * Abstract base class for all TUI elements
 */
export abstract class TUIElement {
    protected metadata: ElementMetadata;
    protected children: TUIElement[];
    /** Default terminal width when no width is specified */
    protected static readonly DEFAULT_TERMINAL_WIDTH = 120;

    constructor(metadata?: ElementMetadata, children?: TUIElement[]) {
        this.metadata = metadata || {};
        this.children = children || [];
    }

    /**
     * Render the element to a string
     * Must be implemented by subclasses
     */
    abstract render(): string;

    /**
     * Get the element's children
     */
    getChildren(): TUIElement[] {
        return this.children;
    }

    /**
     * Add a child element
     */
    addChild(child: TUIElement): void {
        this.children.push(child);
    }

    /**
     * Calculate computed styles for the element
     */
    protected computeStyles(availableWidth?: number): ComputedStyles {
        const { styles } = this.metadata;
        const width = styles?.width;
        const height = styles?.height;
        const showBorder = styles?.showBorder;
        const padding = this.resolvePadding(styles?.padding);
        const margin = this.resolveMargin(styles?.margin);
        const bordeStyle = this.resolveborder(styles?.border);
        const align = styles?.align || 'left';

        // Calculate dimensions
        const contentDims = this.calculateContentDimensions();
        const finalWidth = width ?? availableWidth ?? TUIElement.DEFAULT_TERMINAL_WIDTH;
        const finalHeight = height === 0
            ? (contentDims.height + padding[0] + padding[2] + (showBorder ? 2 : 0))
            : (height ?? (contentDims.height + padding[0] + padding[2] + (showBorder ? 2 : 0)));

        return {
            width: finalWidth,
            height: finalHeight,
            padding,
            margin,
            border: showBorder ? bordeStyle : null,
            align
        };
    }

    /**
     * Calculate the dimensions of the content (without padding/border/margin)
     */
    protected calculateContentDimensions(): { width: number; height: number } {
        const { content } = this.metadata;
        const finalContent = content ?? '';

        let maxContentWidth = 0;
        let maxContentHeight = 0;

        // Calculate from text content
        if (finalContent) {
            const lines = finalContent.split('\n');
            maxContentWidth = Math.max(...lines.map(line => line.length));
            maxContentHeight = lines.length;
        }

        // Calculate from children
        if (this.children.length > 0) {
            for (const child of this.children) {
                const childRender = child.render();
                const childLines = childRender.split('\n');
                maxContentWidth = Math.max(maxContentWidth, ...childLines.map(line => line.length));
                maxContentHeight += childLines.length;
            }
        }

        // Ensure minimum dimensions
        maxContentWidth = Math.max(maxContentWidth, 10);
        maxContentHeight = Math.max(maxContentHeight, 1);

        return {
            width: maxContentWidth,
            height: maxContentHeight
        };
    }

    /**
     * Resolve padding values to a 4-tuple [top, right, bottom, left]
     */
    protected resolvePadding(padding?: PaddingStyle): Spacing {
        if (!padding) {
            return [0, 0, 0, 0];
        }

        const all = padding.all ?? 0;
        const horizontal = padding.horizontal ?? all;
        const vertical = padding.vertical ?? all;

        return [
            padding.top ?? vertical,
            padding.right ?? horizontal,
            padding.bottom ?? vertical,
            padding.left ?? horizontal
        ];
    }

    /**
     * Resolve margin values to a 4-tuple [top, right, bottom, left]
     */
    protected resolveMargin(margin?: MarginStyle): Spacing {
        if (!margin) {
            return [0, 0, 0, 0];
        }

        const all = margin.all ?? 0;
        const horizontal = margin.horizontal ?? all;
        const vertical = margin.vertical ?? all;

        return [
            margin.top ?? vertical,
            margin.right ?? horizontal,
            margin.bottom ?? vertical,
            margin.left ?? horizontal
        ];
    }

    /**
     * Resolve border style
     */
    protected resolveborder(border?: border): border {
        return border || { line: 'single' };
    }

    /**
     * Get border characters for the specified style
     */
    protected getBorderChars(style: border): BoxBorderChars {
        return BoxBorders[style.line] || BoxBorders['single'];
    }

    /**
     * Wrap text to fit within a specified width
     */
    protected wrapContent(content: string, maxWidth: number): string[] {
        if (maxWidth <= 0) return [];
        const lines: string[] = [];
        const words = content.split(' ');
        let currentLine = '';

        for (const word of words) {
            if (currentLine.length === 0) {
                currentLine = word;
            } else if (currentLine.length + 1 + word.length <= maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }

        if (currentLine.length > 0) {
            lines.push(currentLine);
        }

        return lines;
    }

    /**
     * Pad a line to the specified width with alignment
     */
    protected padLine(line: string, width: number, align: 'left' | 'center' | 'right' = 'left'): string {
        if (line.length > width) {
            return line.substring(0, width);
        }

        const padding = width - line.length;

        switch (align) {
            case 'center':
                const leftPad = Math.floor(padding / 2);
                const rightPad = padding - leftPad;
                return ' '.repeat(leftPad) + line + ' '.repeat(rightPad);
            case 'right':
                return ' '.repeat(padding) + line;
            case 'left':
            default:
                return line + ' '.repeat(padding);
        }
    }

    /**
     * Render all children elements
     */
    protected renderChildren(availableWidth?: number): string[] {
        if (this.children.length === 0) {
            return [];
        }

        const result: string[] = [];

        for (const child of this.children) {
            const childRender = child.renderWithWidth(availableWidth);
            const childLines = childRender.split('\n');
            result.push(...childLines);
        }

        return result;
    }

    /**
     * Render the element with a specified available width
     * This is used by parent elements to constrain child width
     */
    renderWithWidth(availableWidth?: number): string {
        return this.render();
    }

    /**
     * Check if content contains box border characters
     */
    protected hasBoxBorders(content: string): boolean {
        return /[┌┐└┘─│╔╗╚╝╭╮╰╯║═┄┆]/.test(content);
    }
}
