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
 * Box border characters for different styles
 */
const BoxBorders = {
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

    const borders = BoxBorders[style];
    const innerWidth = width - 2; // Account for border characters
    const contentWidth = innerWidth - (padding * 2);
    const marginLine = margin > 0 ? '\n'.repeat(margin) : '';

    const lines: string[] = [];

    // Add top margin
    if (margin > 0) {
        lines.push(marginLine);
    }

    // Render top border
    lines.push(borders.topLeft + borders.horizontal.repeat(innerWidth) + borders.topRight);

    // Render title row
    const titlePadding = Math.max(0, contentWidth - title.length);
    const leftPadding = Math.floor(titlePadding / 2);
    const rightPadding = titlePadding - leftPadding;
    const titleRow = '│' +
        ' '.repeat(padding) +
        ' '.repeat(leftPadding) +
        title +
        ' '.repeat(rightPadding) +
        ' '.repeat(padding) +
        '│';
    lines.push(titleRow);

    // Render content rows
    if (content.length > 0) {
        for (const contentLine of content) {
            // Handle multi-line content by wrapping
            const wrappedLines = wrapText(contentLine, contentWidth);
            for (const wrappedLine of wrappedLines) {
                const contentRow = '│' +
                    ' '.repeat(padding) +
                    wrappedLine.padEnd(contentWidth) +
                    ' '.repeat(padding) +
                    '│';
                lines.push(contentRow);
            }
        }
    }

    // Render bottom border
    lines.push(borders.bottomLeft + borders.horizontal.repeat(innerWidth) + borders.bottomRight);

    // Add bottom margin
    if (margin > 0) {
        lines.push(marginLine);
    }

    return lines.join('\n');
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
