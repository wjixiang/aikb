/**
 * Component Registry Implementation
 * Manages component lifecycle and state updates
 */

import {
    WorkspaceComponent,
    WorkspaceComponentRegistry,
    ComponentUpdateResult,
    ComponentRegistryConfig,
    ComponentProps,
    SideEffectExecutionResult
} from './componentTypes';
import { EditableProps, EditablePropsValidationResult, validateEditableProps } from './workspaceTypes';

/**
 * Default configuration for component registry
 */
const DEFAULT_CONFIG: ComponentRegistryConfig = {
    enableRenderCache: true,
    enableLifecycle: true,
    maxComponents: 100
};

/**
 * Component Registry Implementation
 */
export class ComponentRegistry implements WorkspaceComponentRegistry {
    private components: Map<string, WorkspaceComponent> = new Map();
    private config: ComponentRegistryConfig;

    constructor(config: Partial<ComponentRegistryConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Register a component with the workspace
     */
    async register(component: WorkspaceComponent): Promise<void> {
        if (this.components.has(component.id)) {
            throw new Error(`Component with id '${component.id}' is already registered`);
        }

        if (this.components.size >= (this.config.maxComponents || 100)) {
            throw new Error(`Maximum number of components (${this.config.maxComponents}) reached`);
        }

        // Set registry reference on component
        component._setRegistry(this);

        // Initialize component methods
        this.initializeComponent(component);

        // Mount the component
        this.components.set(component.id, component);
        component._mounted = true;

        // Call onMount lifecycle hook
        if (this.config.enableLifecycle && component.lifecycle?.onMount) {
            const result = component.lifecycle.onMount();
            if (result instanceof Promise) {
                await result;
            }
        }

        // Trigger initial side effects
        await component._updateStateAndTriggerEffects();

        // Initial render
        this.invalidateRenderCache(component);
    }

    /**
     * Unregister a component from the workspace
     */
    unregister(componentId: string): void {
        const component = this.components.get(componentId);
        if (!component) {
            return;
        }

        // Call onUnmount lifecycle hook
        if (this.config.enableLifecycle && component.lifecycle?.onUnmount) {
            component.lifecycle.onUnmount();
        }

        component._mounted = false;
        this.components.delete(componentId);
    }

    /**
     * Get a component by ID
     */
    get(componentId: string): WorkspaceComponent | undefined {
        return this.components.get(componentId);
    }

    /**
     * Get all registered components
     */
    getAll(): WorkspaceComponent[] {
        return Array.from(this.components.values());
    }

    /**
     * Update a component's state
     */
    async updateComponentState(
        componentId: string,
        key: string,
        value: any
    ): Promise<ComponentUpdateResult> {
        const component = this.components.get(componentId);
        if (!component) {
            return {
                success: false,
                error: `Component '${componentId}' not found`,
                componentId,
                updatedKey: key,
                previousValue: undefined,
                newValue: value,
                reRendered: false
            };
        }

        // Check if key exists in editable props
        if (!(key in component.editableProps)) {
            return {
                success: false,
                error: `Field '${key}' is not editable in component '${componentId}'`,
                componentId,
                updatedKey: key,
                previousValue: undefined,
                newValue: value,
                reRendered: false
            };
        }

        const field = component.editableProps[key] as EditableProps;

        // Check if field is readonly
        if (field.readonly) {
            return {
                success: false,
                error: `Field '${key}' is read-only`,
                componentId,
                updatedKey: key,
                previousValue: component.state[key],
                newValue: value,
                reRendered: false
            };
        }

        // Validate the value
        const validationResult = this.validateFieldValue(field as EditableProps, value, component);
        if (!validationResult.valid) {
            return {
                success: false,
                error: validationResult.error,
                componentId,
                updatedKey: key,
                previousValue: component.state[key],
                newValue: value,
                reRendered: false
            };
        }

        // Store previous value
        const previousValue = component.state[key];

        // Update state with validated value
        component.state[key] = validationResult.data;

        // Update editable status
        field.value = validationResult.data === null ? null : validationResult.data;

        // Trigger side effects based on state changes
        const sideEffectResults = await component._updateStateAndTriggerEffects();

        // Call onUpdate lifecycle hook (backward compatibility)
        if (this.config.enableLifecycle && component.lifecycle?.onUpdate) {
            await component.lifecycle.onUpdate({ ...component.state, [key]: previousValue });
        }

        // Invalidate render cache
        this.invalidateRenderCache(component);

        return {
            success: true,
            componentId,
            updatedKey: key,
            previousValue,
            newValue: validationResult.data,
            reRendered: true,
            sideEffectResults
        };
    }

    /**
     * Find a component that owns a specific editable status field
     */
    findComponentByField(fieldName: string): WorkspaceComponent | undefined {
        for (const component of this.components.values()) {
            if (fieldName in component.editableProps) {
                return component;
            }
        }
        return undefined;
    }

    /**
     * Get all editable status fields across all components
     */
    getAllEditableFields(): Record<string, string> {
        const fields: Record<string, string> = {};
        for (const component of this.components.values()) {
            for (const fieldName of Object.keys(component.editableProps)) {
                fields[fieldName] = component.id;
            }
        }
        return fields;
    }

    /**
     * Initialize component with required methods
     */
    private initializeComponent(component: WorkspaceComponent): void {
        // Initialize state if not provided
        if (!component.state) {
            component.state = {};
        }

        // Initialize editable status values from state
        for (const [key, field] of Object.entries(component.editableProps)) {
            const editableField = field as EditableProps;
            if (editableField.value === null && key in component.state) {
                editableField.value = component.state[key] === null ? null : String(component.state[key]);
            }
        }

        // Note: updateState and getState are now implemented in the abstract class
    }

    /**
     * Validate a field value against its constraint
     */
    private validateFieldValue(
        field: EditableProps,
        value: any,
        component: WorkspaceComponent
    ): EditablePropsValidationResult {
        // Null is always valid (for clearing)
        if (value === null) {
            return { valid: true };
        }

        // Use Zod-based validation
        const result = validateEditableProps(field, value);
        return result;
    }

    /**
     * Invalidate render cache for a component
     */
    private invalidateRenderCache(component: WorkspaceComponent): void {
        if (this.config.enableRenderCache) {
            component._renderCache = undefined;
        }
    }
}

/**
 * Create a new component registry
 */
export function createComponentRegistry(
    config?: Partial<ComponentRegistryConfig>
): ComponentRegistry {
    return new ComponentRegistry(config);
}

// Re-export WorkspaceComponentRegistry for external use
export type { WorkspaceComponentRegistry } from './componentTypes';
