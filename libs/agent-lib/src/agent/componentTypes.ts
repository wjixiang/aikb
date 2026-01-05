/**
 * Component-based Workspace Architecture Types
 * React-like component model for LLM-Workspace interaction
 */

import { EditableStatus } from './workspaceTypes';

/**
 * Component state - similar to React state
 * Can be any JSON-serializable value
 */
export type ComponentState = Record<string, string | number | boolean | null | any>;

/**
 * Component props - passed from parent component or workspace
 */
export type ComponentProps = Record<string, any>;

/**
 * Component lifecycle hooks
 */
export interface ComponentLifecycle {
    /**
     * Called when component is mounted (registered with workspace)
     */
    onMount?: () => void | Promise<void>;

    /**
     * Called when component state is updated
     * @param prevState - The previous state before the update
     */
    onUpdate?: (prevState: ComponentState) => void | Promise<void>;

    /**
     * Called when component is unmounted (unregistered from workspace)
     */
    onUnmount?: () => void | Promise<void>;
}

/**
 * Result of component state update
 */
export interface ComponentUpdateResult {
    success: boolean;
    error?: string;
    componentId: string;
    updatedKey: string;
    previousValue: any;
    newValue: any;
    reRendered: boolean;
}

/**
 * Workspace component interface
 * Similar to React components but for LLM interaction
 */
export interface WorkspaceComponent {
    // Component identification
    id: string;
    name: string;
    description: string;

    // Component state management
    state: ComponentState;
    editableStatus: Record<string, EditableStatus>;

    // Component rendering
    render: (props?: ComponentProps) => string;

    // Component lifecycle
    lifecycle?: ComponentLifecycle;

    // Child components
    children?: WorkspaceComponent[];

    // Component methods
    updateState: (key: string, value: any) => Promise<ComponentUpdateResult>;
    getState: () => ComponentState;

    // Internal tracking (not exposed to LLM)
    _mounted?: boolean;
    _renderCache?: string;
}

/**
 * Workspace component registry interface
 * Manages component lifecycle and state updates
 */
export interface WorkspaceComponentRegistry {
    /**
     * Register a component with the workspace
     * @param component - The component to register
     */
    register: (component: WorkspaceComponent) => void;

    /**
     * Unregister a component from the workspace
     * @param componentId - The ID of the component to unregister
     */
    unregister: (componentId: string) => void;

    /**
     * Get a component by ID
     * @param componentId - The ID of the component
     * @returns The component or undefined if not found
     */
    get: (componentId: string) => WorkspaceComponent | undefined;

    /**
     * Get all registered components
     * @returns Array of all components
     */
    getAll: () => WorkspaceComponent[];

    /**
     * Update a component's state
     * @param componentId - The ID of the component
     * @param key - The state key to update
     * @param value - The new value
     * @returns Result of the update
     */
    updateComponentState: (
        componentId: string,
        key: string,
        value: any
    ) => Promise<ComponentUpdateResult>;

    /**
     * Find a component that owns a specific editable status field
     * @param fieldName - The name of the editable status field
     * @returns The component or undefined if not found
     */
    findComponentByField: (fieldName: string) => WorkspaceComponent | undefined;

    /**
     * Get all editable status fields across all components
     * @returns Record mapping field names to their component IDs
     */
    getAllEditableFields: () => Record<string, string>;
}

/**
 * Component registry configuration
 */
export interface ComponentRegistryConfig {
    /**
     * Enable render caching to avoid unnecessary re-renders
     */
    enableRenderCache?: boolean;

    /**
     * Enable lifecycle hooks
     */
    enableLifecycle?: boolean;

    /**
     * Maximum number of components allowed
     */
    maxComponents?: number;
}
