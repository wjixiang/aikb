/**
 * TUI (Terminal UI) Elements System
 * HTML-like component system for terminal rendering
 *
 * This module provides HTML-like elements for rendering terminal UI.
 * It maintains backward compatibility with the original tdiv implementation.
 */

// Re-export types for convenience
export * from '../core/types.js';

// Re-export ToolComponent
export { ToolComponent } from '../core/toolComponent.js';

// Re-export base class
export { TUIElement } from './TUIElement.js';

// Re-export container elements
export { tdiv } from './tdiv.js';
export type { tdivMetadata } from './tdiv.js';

// Re-export text elements
export { th } from './text/th.js';
export type { thMetadata } from './text/th.js';

export { tp } from './text/tp.js';
export type { tpMetadata } from './text/tp.js';

export { tbr } from './text/tbr.js';
export type { tbrMetadata } from './text/tbr.js';

export { ttext } from './text/ttext.js';
export type { ttextMetadata } from './text/ttext.js';

// Re-export utility functions
export { renderInfoBox, prettifyCodeContext } from './componentUtils.js';

// Re-export BoxBorders for backward compatibility
export { BoxBorders } from '../core/types.js';

// Re-export Markdown elements
export { MdElement } from './markdown/MdElement.js';
export { MdDiv } from './markdown/MdDiv.js';
export { MdHeading } from './markdown/MdHeading.js';
export { MdParagraph } from './markdown/MdParagraph.js';
export { MdText } from './markdown/MdText.js';

// Re-export Renderer classes
export type { IRenderer } from './Renderer.js';
export { TUIRenderer, MarkdownRenderer } from './Renderer.js';
