/**
 * tbr (horizontal rule) element - renders as a horizontal line
 */

import { TUIElement } from '../TUIElement.js';
import { ElementMetadata } from '../../core/types.js';

/**
 * Metadata for tbr element
 */
export interface tbrMetadata extends ElementMetadata {}

/**
 * tbr (horizontal rule) element - displays a horizontal line
 */
export class tbr extends TUIElement {
  constructor(metadata?: tbrMetadata) {
    super(metadata);
  }

  /**
   * Render the element
   * @param renderMode - Rendering mode: 'tui' for terminal UI with borders, 'markdown' for markdown format
   */
  render(renderMode?: 'tui' | 'markdown'): string {
    return this.renderWithWidth(undefined, renderMode);
  }

  /**
   * Render with specified width
   */
  override renderWithWidth(
    availableWidth: number | undefined,
    renderMode?: 'tui' | 'markdown',
  ): string {
    const styles = this.computeStyles(availableWidth, renderMode);

    if (renderMode === 'markdown') {
      return '---';
    }

    const lineWidth = styles.width - (styles.border ? 2 : 0);
    return '─'.repeat(Math.max(lineWidth, 0));
  }

  /**
   * Calculate content dimensions
   */
  protected override calculateContentDimensions(
    availableWidth?: number,
    renderMode?: 'tui' | 'markdown',
  ): { width: number; height: number } {
    if (renderMode === 'markdown') {
      return { width: 3, height: 1 };
    }
    return { width: availableWidth || 80, height: 1 };
  }
}
