/**
 * Stateful Context Library
 *
 * A state management framework for dynamic context rendering in agent systems.
 * Provides components for managing state, executing tools, and rendering
 * terminal UI elements.
 *
 * Note: Core types, ToolComponent, and TUI elements are now re-exported from agent-components
 * to avoid circular dependencies.
 */

// Re-export all types from agent-components
export type {
    Tool,
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
    SecurityConfig,
    DEFAULT_SECURITY_CONFIG,
    ValidationResult,
    ComponentRegistration,
    WorkspaceScriptExecutionResult,
    CompletionCallback
} from 'agent-components';

// Re-export tool component from agent-components
export { ToolComponent } from 'agent-components';

// Re-export virtual workspace
export { VirtualWorkspace } from './virtualWorkspace.js';

// Re-export TUI elements from agent-components
export {
    TUIElement,
    tdiv,
    tdivMetadata,
    th,
    thMetadata,
    tp,
    tpMetadata,
    ttext,
    ttextMetadata,
    renderInfoBox,
    prettifyCodeContext,
    MdElement,
    MdDiv,
    MdHeading,
    MdParagraph,
    MdText,
    IRenderer,
    TUIRenderer,
    MarkdownRenderer
} from 'agent-components';