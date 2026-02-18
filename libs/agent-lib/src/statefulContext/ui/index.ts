/**
 * TUI (Terminal UI) Elements System
 * HTML-like component system for terminal rendering
 *
 * This module provides HTML-like elements for rendering terminal UI.
 * It maintains backward compatibility with the original tdiv implementation.
 */

// Re-export types for convenience
export * from '../types';

// Re-export base class
export { TUIElement } from './TUIElement';

// Re-export container elements
export { tdiv } from './tdiv';
export type { tdivMetadata } from './tdiv';

// Re-export text elements
export { th } from './text/th';
export type { thMetadata } from './text/th';

export { tp } from './text/tp';
export type { tpMetadata } from './text/tp';

export { ttext } from './text/ttext';
export type { ttextMetadata } from './text/ttext';

// Re-export utility functions
export { renderInfoBox, prettifyCodeContext } from './componentUtils';

// Re-export BoxBorders for backward compatibility
export { BoxBorders } from '../types';
