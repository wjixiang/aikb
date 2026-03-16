/**
 * Core type definitions for agent-components library
 *
 * This module provides the foundational types for the TUI rendering system
 * and the Tool component system.
 */

import type * as z from 'zod';

/**
 * Interface for VirtualWorkspace
 * Defines the contract for workspace management and tool execution
 */
export interface IVirtualWorkspace {
    /**
     * Render the current workspace state as a string
     */
    render(): Promise<string>;

    /**
     * Handle a tool call by name with given parameters
     */
    handleToolCall(name: string, params: any): Promise<any>;

    /**
     * Get all registered tools
     */
    getAllTools(): Array<{ componentKey: string | undefined; toolName: string; tool: Tool; source: any; enabled: boolean }>;

    /**
     * Get the tool manager instance
     */
    getToolManager(): any;

    /**
     * Register a component with an ID
     */
    registerComponent(id: string, component: any, priority?: number): void;

    /**
     * Get a registered component by ID
     */
    getComponent(id: string): any;

    /**
     * Get all registered component IDs
     */
    getComponentKeys(): string[];

    /**
     * Render tool box for LLM context
     */
    renderToolBox(): any;

    /**
     * Render component tools section for LLM context
     */
    renderComponentToolsSection(): Promise<any>;

    /**
     * Get workspace configuration
     */
    getConfig(): VirtualWorkspaceConfig;
}

/**
 * Base metadata for all TUI elements
 */
export interface ElementMetadata {
    /** Text content of the element */
    content?: string;
    /** Style properties */
    styles?: {
        /** Width of the element (0 for auto) */
        width?: number;
        /** Height of the element (0 for auto) */
        height?: number;
        /** Whether to render a border */
        showBorder?: boolean;
        border?: border;
        align?: 'left' | 'center' | 'right';
        padding?: PaddingStyle;
        margin?: MarginStyle;
    };
}

/**
 * Border style configuration
 */
export interface border {
    line: 'single' | 'double' | 'rounded' | 'dashed';
}

/**
 * Padding style configuration
 */
export interface PaddingStyle {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
    horizontal?: number;
    vertical?: number;
    all?: number;
}

/**
 * Margin style configuration
 */
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
 * Spacing values (4-tuple: top, right, bottom, left)
 */
export type Spacing = [number, number, number, number];

/**
 * Dimensions of an element
 */
export interface Dimensions {
    width: number;
    height: number;
}

/**
 * Computed styles for rendering
 */
export interface ComputedStyles {
    width: number;
    height: number;
    padding: Spacing;
    margin: Spacing;
    border: border | null;
    align: 'left' | 'center' | 'right';
}

/**
 * Text styling options
 */
export interface TextStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
}

/**
 * Color definitions (ANSI color codes)
 */
export type TextColor =
    | 'black' | 'red' | 'green' | 'yellow'
    | 'blue' | 'magenta' | 'cyan' | 'white'
    | 'brightBlack' | 'brightRed' | 'brightGreen' | 'brightYellow'
    | 'brightBlue' | 'brightMagenta' | 'brightCyan' | 'brightWhite';

/**
 * Heading levels
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Layout options for container elements
 */
export type LayoutType = 'block' | 'inline' | 'flex' | 'grid';

/**
 * Flex direction
 */
export type FlexDirection = 'row' | 'column';

/**
 * Justify content options
 */
export type JustifyContent =
    | 'flex-start' | 'center' | 'flex-end'
    | 'space-between' | 'space-around' | 'space-evenly';

/**
 * Align items options
 */
export type AlignItems =
    | 'flex-start' | 'center' | 'flex-end'
    | 'stretch' | 'baseline';

/**
 * Overflow handling
 */
export type Overflow = 'visible' | 'hidden' | 'scroll';

/**
 * Box border characters for different styles
 */
export interface BoxBorderChars {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
    horizontal: string;
    vertical: string;
}

/**
 * Box border characters mapping
 */
export const BoxBorders: Record<string, BoxBorderChars> = {
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
    },
    dashed: {
        topLeft: '┌',
        topRight: '┐',
        bottomLeft: '└',
        bottomRight: '┘',
        horizontal: '┄',
        vertical: '┆'
    }
};

/**
 * Permission levels for state access
 */
export enum Permission {
    r = 'READ_ONLY',
    w = 'WRITE_ONLY',
    rw = 'READ_AND_WRITE'
}

/**
 * State definition for components
 * All states are unified - no distinction between public and private
 */
export interface State {
    /**
     * Schema defining the structure of the state
     */
    schema: z.Schema;
    /**
     * The actual state data (using valtio proxy for reactivity)
     */
    state: object;
    /**
     * Permission level for script execution
     */
    permission: Permission;
    /**
     * Describe what will happen if state being changed
     */
    sideEffectsDesc?: string;
}

/**
 * Result of script execution
 */
export interface ScriptExecutionResult {
    success: boolean;
    message: string;
    output?: any;
    error?: string;
}

/**
 * Tool definition for components
 */
export interface Tool {
    toolName: string;
    paramsSchema: z.ZodTypeAny;
    desc: string;
}

/**
 * Result returned by ToolComponent.handleToolCall()
 * This allows components to provide custom summaries for the LOG section
 */
export interface ToolCallResult {
    /**
     * The actual result data to return to the caller
     */
    data: any;
    /**
     * Optional custom summary for the LOG section
     * If not provided, a default summary will be generated
     */
    summary?: string;
}

/**
 * Security configuration options
 */
export interface SecurityConfig {
    /**
     * Maximum execution time in milliseconds
     */
    maxExecutionTime?: number;

    /**
     * Maximum memory usage in MB
     */
    maxMemoryUsage?: number;

    /**
     * Maximum number of loop iterations
     */
    maxIterations?: number;

    /**
     * Whether to allow network requests
     */
    allowNetwork?: boolean;

    /**
     * Whether to allow file system access
     */
    allowFileSystem?: boolean;

    /**
     * Whether to allow process access
     */
    allowProcess?: boolean;

    /**
     * List of allowed global objects
     */
    allowedGlobals?: string[];

    /**
     * List of blocked patterns (regex)
     */
    blockedPatterns?: RegExp[];

    /**
     * Custom validation function
     */
    customValidator?: (script: string) => boolean | Promise<boolean>;
}

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
    maxExecutionTime: 5000, // 5 seconds
    maxMemoryUsage: 100, // 100 MB
    maxIterations: 100000,
    allowNetwork: false,
    allowFileSystem: false,
    allowProcess: false,
    allowedGlobals: [
        'Math',
        'Date',
        'JSON',
        'Array',
        'Object',
        'String',
        'Number',
        'Boolean',
        'Promise',
        'console',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
    ],
    blockedPatterns: [
        /require\s*\(/,
        /import\s*\(/,
        /eval\s*\(/,
        /Function\s*\(/,
        /process\./,
        /global\./,
        /__dirname/,
        /__filename/,
        /Buffer\./,
        /child_process/,
        /fs\./,
        /http\./,
        /https\./,
        /net\./,
        /dgram\./,
        /cluster/,
        /vm\./,
        /worker_threads/,
    ],
};

/**
 * Script validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Rendering mode for workspace context
 */
export type RenderMode = 'tui' | 'markdown';

/**
 * Configuration options for VirtualWorkspace
 */
export interface VirtualWorkspaceConfig {
    /**
     * Unique identifier for this workspace
     */
    id: string;
    /**
     * Human-readable name for this workspace
     */
    name: string;
    /**
     * Description of the workspace's purpose
     */
    description?: string;
    /**
     * Security configuration for script execution
     */
    securityConfig?: SecurityConfig;
    /**
     * Whether to always render ALL registered components
     * When true, all components will be rendered regardless of any activation state
     */
    alwaysRenderAllComponents?: boolean;
    /**
     * Expert mode - recommended mode for Expert framework
     * When true:
     * - Components are registered directly without skill wrapping
     */
    expertMode?: boolean;
    /**
     * Rendering mode for workspace context
     * - 'tui': Terminal UI with ASCII borders (default)
     * - 'markdown': Markdown format with headlines and separators
     */
    renderMode?: RenderMode;
    /**
     * Components to register directly with the workspace
     */
    components?: any[];
    /**
     * Number of recent tool calls to show in the LOG section (default: 3)
     * Set to 0 to disable the LOG section
     */
    toolCallLogCount?: number;
}

/**
 * Component registration in the workspace
 */
export interface ComponentRegistration {
    /**
     * Unique key for accessing this component
     */
    key: string;
    /**
     * The tool component instance
     */
    component: any;
    /**
     * Optional priority for rendering (lower = earlier)
     */
    priority?: number;
}

/**
 * Result of script execution with workspace context
 */
export interface WorkspaceScriptExecutionResult extends ScriptExecutionResult {
    /**
     * Execution metadata
     */
    metadata?: {
        executionTime: number;
        componentCount: number;
        stateCount: number;
    };
}

/**
 * Callback for task completion
 */
export type CompletionCallback = (result: string) => Promise<void>;
