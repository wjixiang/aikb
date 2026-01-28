/**
 * Core type definitions for TUI elements system
 */

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
