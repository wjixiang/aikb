import { tdiv } from './index.js';

export function prettifyCodeContext(codeContext: string) {
    const lines = codeContext.split('\n')
    const lineNum = lines.length + 1
    const numSpace = String(lineNum).length

    return lines.map((e, index) => `  ${' '.repeat(numSpace - String(index).length)}${index + 1} | ${e}`).join('\n')
}

/**
 * Configuration for info box rendering
 */
export interface InfoBoxConfig {
    /**
     * Title text to display in the box header
     */
    title: string;
    /**
     * Optional content lines to display inside the box
     */
    content?: string[];
    /**
     * Optional width of the box (default: 80 characters)
     */
    width?: number;
    /**
     * Optional padding inside the box (default: 1 space on each side)
     */
    padding?: number;
    /**
     * Optional margin around the box (default: 0)
     */
    margin?: number;
    /**
     * Optional box style (default: 'double')
     */
    style?: 'single' | 'double' | 'rounded';
}

/**
 * Render an info box with dynamic content and margin adjustment
 * @param config - Configuration for the info box
 * @returns Formatted info box as a string
 */
export function renderInfoBox(config: InfoBoxConfig): string {
    const {
        title,
        content = [],
        width = 80,
        padding = 1,
        margin = 0,
        style = 'double'
    } = config;

    const contentWidth = width - (padding * 2);
    const innerWidth = width - 2; // Account for border characters

    // Build content string with title and content
    const lines: string[] = [];

    // Add title with padding
    const titlePadding = Math.max(0, contentWidth - title.length);
    const leftPadding = Math.floor(titlePadding / 2);
    const rightPadding = titlePadding - leftPadding;
    lines.push(' '.repeat(padding) + ' '.repeat(leftPadding) + title + ' '.repeat(rightPadding) + ' '.repeat(padding));

    // Add content lines with padding
    if (content.length > 0) {
        for (const contentLine of content) {
            const wrappedLines = wrapText(contentLine, contentWidth);
            for (const wrappedLine of wrappedLines) {
                lines.push(' '.repeat(padding) + wrappedLine.padEnd(contentWidth) + ' '.repeat(padding));
            }
        }
    }

    const contentStr = lines.join('\n');

    // Create tdiv with the content
    const box = new tdiv({
        content: contentStr,
        styles: {
            width: width,
            height: 0, // Auto-height based on content
            showBorder: true,
            border: { line: style },
            align: 'left'
        }
    });

    let result = box.render();

    // Add margin
    if (margin > 0) {
        const marginLine = '\n'.repeat(margin);
        result = marginLine + result + marginLine;
    }

    return result;
}

/**
 * Wrap text to fit within a specified width
 * @param text - Text to wrap
 * @param width - Maximum width for each line
 * @returns Array of wrapped lines
 */
function wrapText(text: string, width: number): string[] {
    if (text.length <= width) {
        return [text];
    }

    const lines: string[] = [];
    let currentLine = '';

    for (const char of text) {
        if (currentLine.length >= width) {
            lines.push(currentLine);
            currentLine = '';
        }
        currentLine += char;
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
}
