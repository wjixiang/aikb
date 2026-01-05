/**
 * Component-based Workspace Architecture Types
 * React-like component model for LLM-Workspace interaction
 */

import { EditableProps } from './workspaceTypes';

/**
 * Component state - similar to React state
 * Can be any JSON-serializable value
 */
export type ComponentState = Record<string, any>;

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
 * Side effect function type
 * Called when dependencies change
 */
export type SideEffectFunction = (dependencies: ComponentState & ComponentProps) => void | Promise<void>;

/**
 * Side effect definition
 */
export interface SideEffect {
    /**
     * Unique identifier for this side effect
     */
    id: string;

    /**
     * State and props keys that this side effect depends on
     */
    dependencies: string[];

    /**
     * Function to execute when dependencies change
     */
    execute: SideEffectFunction;

    /**
     * Whether this side effect has been executed at least once
     */
    executed?: boolean;
}

/**
 * Workspace component abstract class
 * Similar to React components but for LLM interaction
 *
 * Features:
 * - Props are treated as part of component state
 * - Automatic side effect execution when dependencies change
 * - No need for manual onUpdate handling
 */
export abstract class WorkspaceComponent {
    // Component identification
    id: string;
    name: string;
    description: string;

    // Component state management
    state: ComponentState;
    editableProps: Record<string, EditableProps>;

    // Component props (treated as part of state)
    props: ComponentProps;

    // Component lifecycle
    lifecycle?: ComponentLifecycle;

    // Child components
    children?: WorkspaceComponent[];

    // Internal tracking (not exposed to LLM)
    _mounted?: boolean;
    _renderCache?: string;

    // Reference to registry for state updates
    protected _registry?: WorkspaceComponentRegistry;

    // Side effects to execute when dependencies change
    protected _sideEffects: SideEffect[] = [];

    // Track previous dependencies for change detection
    protected _previousDependencies: Map<string, any> = new Map();

    constructor(
        id: string,
        name: string,
        description: string,
        editableProps: Record<string, EditableProps>,
        props: ComponentProps
    ) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.state = {};
        this.editableProps = editableProps;
        this.props = props;
    }

    /**
     * Abstract render method - must be implemented by subclasses
     * No longer accepts props parameter - uses internal props instead
     */
    abstract render(): string;

    /**
     * Register a side effect that executes when dependencies change
     * @param id - Unique identifier for this side effect
     * @param dependencies - Array of state/props keys to watch
     * @param execute - Function to execute when dependencies change
     */
    protected useEffect(id: string, dependencies: string[], execute: SideEffectFunction): void {
        // Remove existing side effect with same id
        this._sideEffects = this._sideEffects.filter(se => se.id !== id);

        // Add new side effect
        this._sideEffects.push({
            id,
            dependencies,
            execute,
            executed: false
        });
    }

    /**
     * Update component state and trigger side effects
     * @internal
     */
    async _updateStateAndTriggerEffects(): Promise<void> {
        const currentDependencies = { ...this.state, ...this.props };
        const changedKeys: string[] = [];

        // Detect which dependencies changed
        for (const [key, value] of Object.entries(currentDependencies)) {
            const previousValue = this._previousDependencies.get(key);
            if (previousValue !== value) {
                changedKeys.push(key);
            }
        }

        // Update previous dependencies
        this._previousDependencies = new Map(Object.entries(currentDependencies));

        // Execute side effects whose dependencies changed
        for (const sideEffect of this._sideEffects) {
            const hasChangedDependency = sideEffect.dependencies.some(
                dep => changedKeys.includes(dep)
            );

            if (hasChangedDependency || !sideEffect.executed) {
                await sideEffect.execute(currentDependencies);
                sideEffect.executed = true;
            }
        }
    }

    /**
     * Update component state
     * Delegates to registry if available
     */
    async updateState(key: string, value: any): Promise<ComponentUpdateResult> {
        if (!this._registry) {
            return {
                success: false,
                error: 'Component not registered with a registry',
                componentId: this.id,
                updatedKey: key,
                previousValue: this.state[key],
                newValue: value,
                reRendered: false
            };
        }
        return await this._registry.updateComponentState(this.id, key, value);
    }

    /**
     * Update component props
     * Props are treated as part of state and trigger side effects
     * @internal
     */
    async _updateProps(newProps: ComponentProps): Promise<void> {
        this.props = { ...this.props, ...newProps };
        await this._updateStateAndTriggerEffects();
    }

    /**
     * Get component state (includes props)
     */
    getState(): ComponentState {
        return { ...this.state };
    }

    /**
     * Get component props
     */
    getProps(): ComponentProps {
        return { ...this.props };
    }

    /**
     * Set registry reference (called by ComponentRegistry during registration)
     * @internal
     */
    _setRegistry(registry: WorkspaceComponentRegistry): void {
        this._registry = registry;
    }
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
    register: (component: WorkspaceComponent) => Promise<void>;

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
