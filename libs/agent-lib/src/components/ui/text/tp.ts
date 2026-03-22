/**
 * tp (paragraph) element - similar to HTML <p>
 */

import { TUIElement } from '../TUIElement.js';
import { ElementMetadata } from '../../core/types.js';

/**
 * Metadata for tp (paragraph) element
 */
export interface tpMetadata extends ElementMetadata {
  /** Number of spaces to indent the paragraph */
  indent?: number;
  /** Line height multiplier */
  lineHeight?: number;
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
   * @param renderMode - Rendering mode: 'tui' for terminal UI with borders, 'markdown' for markdown format
   */
  render(renderMode?: 'tui' | 'markdown'): string {
    return this.renderWithWidth(undefined, renderMode);
  }

  /**
   * Render paragraph element with a specified available width
   * @param renderMode - Rendering mode: 'tui' for terminal UI with borders, 'markdown' for markdown format
   */
  override renderWithWidth(
    availableWidth: number | undefined,
    renderMode?: 'tui' | 'markdown',
  ): string {
    const styles = this.computeStyles(availableWidth, renderMode);
    const content = this.metadata.content;
    const indent = this.metadata.indent ?? 0;

    const finalContent = content ?? '';

    // Calculate inner content area dimensions
    const innerWidth =
      styles.width -
      styles.padding[1] -
      styles.padding[3] -
      (styles.border ? 2 : 0) -
      indent;
    const innerHeight =
      styles.height -
      styles.padding[0] -
      styles.padding[2] -
      (styles.border ? 2 : 0);

    let result = '';

    // Top margin
    for (let i = 0; i < styles.margin[0]; i++) {
      result += ' '.repeat(styles.margin[3]) + '\n';
    }

    // Top border
    if (styles.border) {
      result += ' '.repeat(styles.margin[3]);
      const borderChars = this.getBorderChars(styles.border);
      result +=
        borderChars.topLeft +
        borderChars.horizontal.repeat(styles.width - 2) +
        borderChars.topRight +
        '\n';
    }

    // Top padding
    for (let i = 0; i < styles.padding[0]; i++) {
      result += ' '.repeat(styles.margin[3]);
      if (styles.border) {
        const borderChars = this.getBorderChars(styles.border);
        result +=
          borderChars.vertical +
          ' '.repeat(styles.width - 2) +
          borderChars.vertical;
      } else {
        result += ' '.repeat(styles.width);
      }
      result += '\n';
    }

    // Split into lines and wrap content like tdiv does
    let contentLines: string[] = [];
    const rawLines = finalContent.split('\n');
    for (let index = 0; index < rawLines.length; index++) {
      let currentLine = rawLines[index];
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
    const indentedLines = contentLines.map((line) => indentStr + line);

    // Render content area
    const contentHeight = Math.max(innerHeight, indentedLines.length);
    for (let i = 0; i < contentHeight; i++) {
      const line = indentedLines[i] || '';
      result += ' '.repeat(styles.margin[3]);
      if (styles.border) {
        const borderChars = this.getBorderChars(styles.border);
        result +=
          borderChars.vertical +
          this.padLine(line, innerWidth + indent, styles.align) +
          borderChars.vertical;
      } else {
        result += this.padLine(
          line,
          styles.width - styles.padding[1] - styles.padding[3],
          styles.align,
        );
      }
      result += '\n';
    }

    // Bottom padding
    for (let i = 0; i < styles.padding[2]; i++) {
      result += ' '.repeat(styles.margin[3]);
      if (styles.border) {
        const borderChars = this.getBorderChars(styles.border);
        result +=
          borderChars.vertical +
          ' '.repeat(styles.width - 2) +
          borderChars.vertical;
      } else {
        result += ' '.repeat(styles.width);
      }
      result += '\n';
    }

    // Bottom border
    if (styles.border) {
      result += ' '.repeat(styles.margin[3]);
      const borderChars = this.getBorderChars(styles.border);
      result +=
        borderChars.bottomLeft +
        borderChars.horizontal.repeat(styles.width - 2) +
        borderChars.bottomRight +
        '\n';
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
   * Calculate content dimensions
   */
  protected override calculateContentDimensions(
    availableWidth?: number,
    renderMode?: 'tui' | 'markdown',
  ): { width: number; height: number } {
    const content = this.metadata.content;
    const indent = this.metadata.indent ?? 0;

    const finalContent = content ?? '';
    const lines = finalContent.split('\n');

    const maxWidth = Math.max(
      ...lines.map((line: string) => indent + line.length),
    );
    const height = lines.length;

    return {
      width: maxWidth,
      height,
    };
  }
}
