/**
 * Enhanced tdiv (div-like container) element
 * Supports border, padding, margin, alignment, and children
 */

import { TUIElement } from './TUIElement.js';
import {
    ElementMetadata,
    ComputedStyles
} from '../types.js';

/**
 * Enhanced metadata for tdiv element
 */
export interface tdivMetadata extends ElementMetadata {
    /** Layout type (future: flex/grid support) */
    layout?: 'block' | 'inline' | 'flex' | 'grid';
    /** Gap between children (for flex/grid) */
    gap?: number;
}

/**
 * Enhanced tdiv element - container with border, padding, margin, and alignment
 */
export class tdiv extends TUIElement {
    declare metadata: tdivMetadata;

    constructor(metadata: tdivMetadata, children?: TUIElement[]) {
        super(metadata, children);
    }

    /**
     * Render the tdiv element
     */
    render(): string {
        return this.renderWithWidth(undefined);
    }

    /**
     * Render the tdiv element with a specified available width
     */
    override renderWithWidth(availableWidth: number | undefined): string {
        const styles = this.computeStyles(availableWidth);
        // console.debug(styles)
        const content = this.metadata.content;
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

        // Content lines
        let contentLines: string[] = [];

        const rawLines = finalContent.split('\n');
        for (let index = 0; index < rawLines.length; index++) {
            let currentLine = rawLines[index];
            while (currentLine.length > innerWidth) {
                contentLines.push(currentLine.slice(0, innerWidth));
                currentLine = currentLine.slice(innerWidth);
            }
            contentLines.push(currentLine)
        }

        const renderedChildren = this.renderChildren(innerWidth);
        const allContentLines = [...contentLines, ...renderedChildren];

        // Render content area
        const contentHeight = Math.max(innerHeight, allContentLines.length);
        for (let i = 0; i < contentHeight; i++) {
            const line = allContentLines[i] || '';
            result += ' '.repeat(styles.margin[3]);
            if (styles.border) {
                const borderChars = this.getBorderChars(styles.border);
                result += borderChars.vertical + this.padLine(line, innerWidth, styles.align) + borderChars.vertical;
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
     * Calculate content dimensions considering children
     */
    protected override calculateContentDimensions(availableWidth?: number): { width: number; height: number } {
        const content = this.metadata.content;
        const finalContent = content ?? '';

        let maxContentWidth = 0;
        let maxContentHeight = 0;

        // Calculate from text content
        if (finalContent) {
            const lines = finalContent.split('\n');
            maxContentWidth = Math.max(...lines.map((line: string) => line.length));
            maxContentHeight = lines.length;
        }

        // Calculate from children - pass available width to children
        if (this.children.length > 0) {
            for (const child of this.children) {
                const childRender = child.renderWithWidth(availableWidth);
                const childLines = childRender.split('\n');
                maxContentWidth = Math.max(maxContentWidth, ...childLines.map((line: string) => line.length));
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
}
