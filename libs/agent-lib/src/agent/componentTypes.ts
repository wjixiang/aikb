/**
 * Component-based Workspace Architecture Types
 * React-like component model for LLM-Workspace interaction
 */

import { EditableProps, renderEditablePropsAsPrompt } from './workspaceTypes';

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
    /**
     * Results from side effect executions
     */
    sideEffectResults?: SideEffectExecutionResult[];
}

/**
 * Side effect function type
 * Called when dependencies change
 */
export type SideEffectFunction = (dependencies: ComponentState & ComponentProps) => void | Promise<void>;

/**
 * Error details for a failed side effect
 */
export interface SideEffectError {
    /**
     * The side effect ID that failed
     */
    sideEffectId: string;

    /**
     * Error message
     */
    message: string;

    /**
     * Stack trace if available
     */
    stack?: string;

    /**
     * The dependencies that triggered the error
     */
    dependencies?: ComponentState & ComponentProps;

    /**
     * Timestamp when the error occurred
     */
    timestamp: Date;

    /**
     * Whether this is a retryable error
     */
    retryable?: boolean;
}

/**
 * Result of side effect execution
 */
export interface SideEffectExecutionResult {
    /**
     * The side effect ID
     */
    sideEffectId: string;

    /**
     * Whether execution was successful
     */
    success: boolean;

    /**
     * Error details if execution failed
     */
    error?: SideEffectError;

    /**
     * Execution duration in milliseconds
     */
    duration?: number;
}

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

    /**
     * Whether this side effect should stop execution on error
     * If false, other side effects will continue even if this one fails
     */
    stopOnError?: boolean;

    /**
     * Maximum retry attempts for this side effect
     */
    maxRetries?: number;

    /**
     * Current retry count
     */
    retryCount?: number;

    /**
     * Last error encountered
     */
    lastError?: SideEffectError;

    /**
     * Whether this side effect should be retried on failure
     */
    retryable?: boolean;
}

/**
 * Internal helper to wrap render output with component description and editable state
 * This is automatically called by the abstract render() method in WorkspaceComponent
 *
 * @param component - The component instance
 * @param result - The original render result from the subclass
 * @returns The wrapped render output
 */
function wrapRenderOutput(component: WorkspaceComponent, result: string): string {
    // Build the editable state section
    let editableStateSection = '';
    if (component.editableProps && Object.keys(component.editableProps).length > 0) {
        const editableFields = Object.entries(component.editableProps).map(([fieldName, editableProp]) => {
            return renderEditablePropsAsPrompt(fieldName, editableProp);
        }).join('\n');

        editableStateSection = `
Editable State:
---------------
${editableFields}
`;
    }

    // Build the final output with description and editable state
    const modifiedResult = `
*************************************
${component.description}
*************************************
${editableStateSection}
${result}
`;

    return modifiedResult;
}

/**
 * Decorator factory for component render method
 * Wraps the render output with component description and editable state
 *
 * Note: This decorator is optional. The WorkspaceComponent abstract class
 * automatically wraps render output, so you don't need to apply this decorator
 * to each component's render method.
 *
 * @example
 * ```typescript
 * class MyComponent extends WorkspaceComponent {
 *     @componentRender()  // Optional - automatic wrapping is enabled
 *     render(): string {
 *         return 'My content';
 *     }
 * }
 * ```
 */
export function componentRender(component?: WorkspaceComponent) {
    return (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) => {
        const originalMethod = descriptor.value;
        descriptor.value = function (this: WorkspaceComponent): string {
            // Get the original render result
            const result = originalMethod.apply(this) as string;
            // Wrap it with description and editable state
            return wrapRenderOutput(this, result);
        };

        return descriptor;
    };
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

    // Track side effect errors
    protected _sideEffectErrors: Map<string, SideEffectError[]> = new Map();

    // Track execution results
    protected _lastExecutionResults: SideEffectExecutionResult[] = [];

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
     *
     * Note: The render output is automatically wrapped with component description
     * and editable state. You don't need to manually apply the @componentRender decorator.
     */
    abstract render(): string;

    /**
     * Internal method to wrap render output with description and editable state
     * This is called automatically by the component registry when rendering
     * @internal
     */
    _wrapRender(result: string): string {
        return wrapRenderOutput(this, result);
    }

    /**
     * Register a side effect that executes when dependencies change
     * @param id - Unique identifier for this side effect
     * @param dependencies - Array of state/props keys to watch
     * @param execute - Function to execute when dependencies change
     * @param options - Optional configuration for the side effect
     */
    protected useEffect(
        id: string,
        dependencies: string[],
        execute: SideEffectFunction,
        options?: {
            stopOnError?: boolean;
            maxRetries?: number;
            retryable?: boolean;
        }
    ): void {
        // Remove existing side effect with same id
        this._sideEffects = this._sideEffects.filter(se => se.id !== id);

        // Add new side effect
        this._sideEffects.push({
            id,
            dependencies,
            execute,
            executed: false,
            stopOnError: options?.stopOnError ?? false,
            maxRetries: options?.maxRetries ?? 0,
            retryCount: 0,
            retryable: options?.retryable ?? false
        });
    }

    /**
     * Update component state and trigger side effects
     * @internal
     */
    async _updateStateAndTriggerEffects(): Promise<SideEffectExecutionResult[]> {
        const currentDependencies = { ...this.state, ...this.props };
        const changedKeys: string[] = [];
        const executionResults: SideEffectExecutionResult[] = [];

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
                const startTime = Date.now();
                let result: SideEffectExecutionResult;

                try {
                    await sideEffect.execute(currentDependencies);
                    sideEffect.executed = true;
                    sideEffect.lastError = undefined;
                    sideEffect.retryCount = 0;

                    result = {
                        sideEffectId: sideEffect.id,
                        success: true,
                        duration: Date.now() - startTime
                    };
                } catch (error) {
                    const errorDetails: SideEffectError = {
                        sideEffectId: sideEffect.id,
                        message: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                        dependencies: { ...currentDependencies },
                        timestamp: new Date(),
                        retryable: sideEffect.retryable
                    };

                    // Store error details
                    sideEffect.lastError = errorDetails;
                    if (!this._sideEffectErrors.has(sideEffect.id)) {
                        this._sideEffectErrors.set(sideEffect.id, []);
                    }
                    this._sideEffectErrors.get(sideEffect.id)!.push(errorDetails);

                    // Log detailed error
                    console.error(`[${this.id}] Error in side effect '${sideEffect.id}':`, {
                        message: errorDetails.message,
                        dependencies: errorDetails.dependencies,
                        timestamp: errorDetails.timestamp,
                        stack: errorDetails.stack
                    });

                    result = {
                        sideEffectId: sideEffect.id,
                        success: false,
                        error: errorDetails,
                        duration: Date.now() - startTime
                    };

                    // Stop execution if configured to do so
                    if (sideEffect.stopOnError) {
                        console.error(`[${this.id}] Stopping side effect execution due to error in '${sideEffect.id}'`);
                        executionResults.push(result);
                        break;
                    }
                }

                executionResults.push(result);
            }
        }

        // Store last execution results
        this._lastExecutionResults = executionResults;

        return executionResults;
    }

    /**
     * Get all side effect errors for this component
     */
    getSideEffectErrors(): Map<string, SideEffectError[]> {
        return new Map(this._sideEffectErrors);
    }

    /**
     * Get errors for a specific side effect
     */
    getSideEffectErrorsById(sideEffectId: string): SideEffectError[] {
        return this._sideEffectErrors.get(sideEffectId) || [];
    }

    /**
     * Clear all side effect errors
     */
    clearSideEffectErrors(): void {
        this._sideEffectErrors.clear();
    }

    /**
     * Clear errors for a specific side effect
     */
    clearSideEffectErrorsById(sideEffectId: string): void {
        this._sideEffectErrors.delete(sideEffectId);
    }

    /**
     * Get the last execution results
     */
    getLastExecutionResults(): SideEffectExecutionResult[] {
        return [...this._lastExecutionResults];
    }

    /**
     * Retry a failed side effect
     */
    async retrySideEffect(sideEffectId: string): Promise<SideEffectExecutionResult> {
        const sideEffect = this._sideEffects.find(se => se.id === sideEffectId);
        if (!sideEffect) {
            return {
                sideEffectId,
                success: false,
                error: {
                    sideEffectId,
                    message: `Side effect '${sideEffectId}' not found`,
                    timestamp: new Date()
                }
            };
        }

        if (!sideEffect.retryable) {
            return {
                sideEffectId,
                success: false,
                error: {
                    sideEffectId,
                    message: `Side effect '${sideEffectId}' is not retryable`,
                    timestamp: new Date()
                }
            };
        }

        const maxRetries = sideEffect.maxRetries ?? 0;
        if (sideEffect.retryCount && sideEffect.retryCount >= maxRetries) {
            return {
                sideEffectId,
                success: false,
                error: {
                    sideEffectId,
                    message: `Maximum retry attempts (${maxRetries}) exceeded`,
                    timestamp: new Date()
                }
            };
        }

        const startTime = Date.now();
        const currentDependencies = { ...this.state, ...this.props };

        try {
            sideEffect.retryCount = (sideEffect.retryCount || 0) + 1;
            await sideEffect.execute(currentDependencies);
            sideEffect.executed = true;
            sideEffect.lastError = undefined;

            // Clear errors for this side effect on successful retry
            this.clearSideEffectErrorsById(sideEffectId);

            return {
                sideEffectId,
                success: true,
                duration: Date.now() - startTime
            };
        } catch (error) {
            const errorDetails: SideEffectError = {
                sideEffectId,
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                dependencies: { ...currentDependencies },
                timestamp: new Date(),
                retryable: sideEffect.retryable
            };

            sideEffect.lastError = errorDetails;
            if (!this._sideEffectErrors.has(sideEffectId)) {
                this._sideEffectErrors.set(sideEffectId, []);
            }
            this._sideEffectErrors.get(sideEffectId)!.push(errorDetails);

            console.error(`[${this.id}] Retry ${sideEffect.retryCount} failed for side effect '${sideEffectId}':`, errorDetails);

            return {
                sideEffectId,
                success: false,
                error: errorDetails,
                duration: Date.now() - startTime
            };
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
