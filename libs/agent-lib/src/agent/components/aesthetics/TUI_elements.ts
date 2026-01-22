export interface tdivMetadata {
    width?: number;
    height?: number;
    border?: boolean;
    content?: string;
    styles?: {
        borderStyle?: BorderStyle,
        align?: 'left' | 'center' | 'right',
        padding?: PaddingStyle,
        margin?: MarginStyle
    }
}

export interface BorderStyle {
    line: 'double' | 'single' | 'rounded';
}

export interface PaddingStyle {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
    horizontal?: number;
    vertical?: number;
    all?: number;
}

export interface MarginStyle {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
    horizontal?: number;
    vertical?: number;
    all?: number;
}

/**
 * Box border characters for different styles
 */
const BoxBorders: Record<string, {
    topLeft: string,
    topRight: string,
    bottomLeft: string,
    bottomRight: string,
    horizontal: string,
    vertical: string
}> = {
    single: {
        topLeft: '┌',
        topRight: '┐',
        bottomLeft: '└',
        bottomRight: '┘',
        horizontal: '─',
        vertical: '│'
    },
    double: {
        topLeft: '╔',
        topRight: '╗',
        bottomLeft: '╚',
        bottomRight: '╝',
        horizontal: '═',
        vertical: '║'
    },
    rounded: {
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
        horizontal: '─',
        vertical: '│'
    }
};

export class tdiv {
    constructor(public metadata: tdivMetadata, public children?: tdiv[]) { }

    render(): string {
        const { width, height, border, content, styles } = this.metadata;

        // Get padding and margin values
        const padding = this.getPaddingValues(styles?.padding);
        const margin = this.getMarginValues(styles?.margin);
        const hasBorder = border ?? false;
        const finalContent = content ?? '';

        // Calculate content dimensions (without padding, border, margin)
        const { contentWidth, contentHeight } = this.calculateContentDimensions();

        // Calculate final dimensions
        // If height is explicitly 0, use calculated height (treat 0 as auto-height)
        const useCalculatedHeight = height === 0;
        const finalWidth = width ?? (contentWidth + padding.left + padding.right + (hasBorder ? 2 : 0));
        const finalHeight = useCalculatedHeight
            ? (contentHeight + padding.top + padding.bottom + (hasBorder ? 2 : 0))
            : (height ?? (contentHeight + padding.top + padding.bottom + (hasBorder ? 2 : 0)));

        // Calculate inner content area dimensions
        const innerWidth = finalWidth - padding.left - padding.right - (hasBorder ? 2 : 0);
        const innerHeight = finalHeight - padding.top - padding.bottom - (hasBorder ? 2 : 0);

        let result = '';

        // Top margin
        for (let i = 0; i < margin.top; i++) {
            result += ' '.repeat(margin.left) + '\n';
        }

        // Top border
        const borderChars = styles?.borderStyle
            ? BoxBorders[styles.borderStyle.line]
            : BoxBorders['single'];

        if (hasBorder) {
            result += ' '.repeat(margin.left);
            result += borderChars.topLeft + borderChars.horizontal.repeat(finalWidth - 2) + borderChars.topRight + '\n';
        }

        // Top padding
        for (let i = 0; i < padding.top; i++) {
            result += ' '.repeat(margin.left);
            if (hasBorder) {
                result += borderChars.vertical + ' '.repeat(finalWidth - 2) + borderChars.vertical;
            } else {
                result += ' '.repeat(finalWidth);
            }
            result += '\n';
        }

        // Content lines
        let contentLines: string[];
        // If content already contains newlines (pre-formatted), use it directly
        // Also check if content contains box border characters (from renderInfoBox)
        const hasBoxBorders = /[┌┐└┘─│╔╗╚╝╭╮╰╯║═]/.test(finalContent);
        if (finalContent.includes('\n') || hasBoxBorders) {
            contentLines = finalContent.split('\n');
        } else {
            contentLines = this.wrapContent(finalContent, innerWidth);
        }
        const renderedChildren = this.renderChildren(innerWidth);
        const allContentLines = [...contentLines, ...renderedChildren];

        // Render content area
        for (let i = 0; i < innerHeight; i++) {
            const line = allContentLines[i] || '';
            result += ' '.repeat(margin.left);
            if (hasBorder) {
                result += borderChars.vertical + this.padLine(line, innerWidth, styles?.align) + borderChars.vertical;
            } else {
                result += this.padLine(line, finalWidth - padding.left - padding.right, styles?.align);
            }
            result += '\n';
        }

        // Bottom padding
        for (let i = 0; i < padding.bottom; i++) {
            result += ' '.repeat(margin.left);
            if (hasBorder) {
                result += borderChars.vertical + ' '.repeat(finalWidth - 2) + borderChars.vertical;
            } else {
                result += ' '.repeat(finalWidth);
            }
            result += '\n';
        }

        // Bottom border
        if (hasBorder) {
            result += ' '.repeat(margin.left);
            result += borderChars.bottomLeft + borderChars.horizontal.repeat(finalWidth - 2) + borderChars.bottomRight + '\n';
        }

        // Bottom margin
        for (let i = 0; i < margin.bottom; i++) {
            result += ' '.repeat(margin.left) + '\n';
        }

        // Trim trailing newlines only if no bottom margin
        if (margin.bottom === 0) {
            result = result.trimEnd();
        }

        return result;
    }

    private calculateContentDimensions(): { contentWidth: number; contentHeight: number } {
        const { content } = this.metadata;
        const finalContent = content ?? '';

        let maxContentWidth = 0;
        let maxContentHeight = 0;

        // Calculate content width from text
        if (finalContent) {
            const lines = finalContent.split('\n');
            maxContentWidth = Math.max(...lines.map(line => line.length));
            maxContentHeight = lines.length;
        }

        // Calculate dimensions from children
        if (this.children && this.children.length > 0) {
            for (const child of this.children) {
                const childContent = child.render();
                const childLines = childContent.split('\n');
                maxContentWidth = Math.max(maxContentWidth, ...childLines.map(line => line.length));
                maxContentHeight += childLines.length;
            }
        }

        // Ensure minimum dimensions
        maxContentWidth = Math.max(maxContentWidth, 10);
        maxContentHeight = Math.max(maxContentHeight, 1);

        return {
            contentWidth: maxContentWidth,
            contentHeight: maxContentHeight
        };
    }

    private renderChildren(availableWidth: number): string[] {
        if (!this.children || this.children.length === 0) {
            return [];
        }

        const result: string[] = [];

        for (const child of this.children) {
            const childRender = child.render();
            const childLines = childRender.split('\n');
            result.push(...childLines);
        }

        return result;
    }

    private getPaddingValues(padding?: PaddingStyle): { top: number; right: number; bottom: number; left: number } {
        if (!padding) {
            return { top: 0, right: 0, bottom: 0, left: 0 };
        }

        const all = padding.all ?? 0;
        const horizontal = padding.horizontal ?? all;
        const vertical = padding.vertical ?? all;

        return {
            top: padding.top ?? vertical,
            right: padding.right ?? horizontal,
            bottom: padding.bottom ?? vertical,
            left: padding.left ?? horizontal
        };
    }

    private getMarginValues(margin?: MarginStyle): { top: number; right: number; bottom: number; left: number } {
        if (!margin) {
            return { top: 0, right: 0, bottom: 0, left: 0 };
        }

        const all = margin.all ?? 0;
        const horizontal = margin.horizontal ?? all;
        const vertical = margin.vertical ?? all;

        return {
            top: margin.top ?? vertical,
            right: margin.right ?? horizontal,
            bottom: margin.bottom ?? vertical,
            left: margin.left ?? horizontal
        };
    }

    private wrapContent(content: string, maxWidth: number): string[] {
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

    private padLine(line: string, width: number, align: 'left' | 'center' | 'right' = 'left'): string {
        if (line.length >= width) {
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
}