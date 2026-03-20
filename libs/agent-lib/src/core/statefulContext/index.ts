/**
 * Stateful Context Library
 *
 * A state management framework for dynamic context rendering in agent systems.
 * Provides components for managing state, executing tools, and rendering
 * terminal UI elements.
 *
 * Note: Core types, ToolComponent, and TUI elements are now re-exported from components
 * to avoid circular dependencies.
 */

// Re-export all types from components
export type {
  Tool,
  ToolCallResult,
  IVirtualWorkspace,
  RenderMode,
  VirtualWorkspaceConfig,
  ElementMetadata,
  border,
  PaddingStyle,
  MarginStyle,
  Spacing,
  Dimensions,
  ComputedStyles,
  TextStyle,
  TextColor,
  HeadingLevel,
  LayoutType,
  FlexDirection,
  JustifyContent,
  AlignItems,
  Overflow,
  BoxBorderChars,
  BoxBorders,
  Permission,
  State,
  ScriptExecutionResult,
  ScriptValidationResult,
  SecurityConfig,
  DEFAULT_SECURITY_CONFIG,
  ComponentRegistration,
  WorkspaceScriptExecutionResult,
  CompletionCallback,
} from '../../components/index.js';

// Re-export tool component from components
export { ToolComponent } from '../../components/index.js';
export type { ComponentStateBase } from '../../components/index.js';

// Re-export virtual workspace
export { VirtualWorkspace, type ToolCallSummary } from './virtualWorkspace.js';

// Re-export workspace hooks
export { createWorkspaceHooks, isHookableComponent } from './workspaceHooks.js';

// Re-export TUI elements from components
export {
  TUIElement,
  tdiv,
  th,
  tp,
  ttext,
  renderInfoBox,
  prettifyCodeContext,
  MdElement,
  MdDiv,
  MdHeading,
  MdParagraph,
  MdText,
  TUIRenderer,
  MarkdownRenderer,
} from '../../components/index.js';

// Re-export type-only exports
export type {
  tdivMetadata,
  thMetadata,
  tpMetadata,
  ttextMetadata,
  IRenderer,
} from '../../components/index.js';
