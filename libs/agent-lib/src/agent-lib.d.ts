/**
 * Agent Lib Type Declarations
 * 
 * This file provides type declarations for the agent-lib module.
 * It allows TypeScript to resolve types without requiring full declaration file generation.
 */

// Re-export types from internal modules
export abstract class ExpertWorkspaceBase {
    static getComponents(): any[] | Promise<any[]> {
        return [];
    }

    static getComponentsWithIds(): Array<{ id: string; component: any }> | Promise<Array<{ id: string; component: any }>> {
        return [];
    }

    static validateInput(input: Record<string, any>): ValidationResult {
        return { valid: true };
    }

    static transformInput(input: Record<string, any>): Record<string, any> {
        return input;
    }
}

export interface ValidationResult {
    valid: boolean;
    errors?: Array<{
        field: string;
        message: string;
    }>;
}

// Type re-exports from components
export type { ComponentDefinition, ComponentOptions } from './components/index.js';

// Additional types that may be imported
export interface ExpertConfig {
    id: string;
    name: string;
    description?: string;
    components?: ComponentDefinition[];
}

export interface ExpertComponentDefinition {
    id: string;
    component: any;
    options?: ComponentOptions;
}

export interface ExpertTask {
    id: string;
    input: Record<string, any>;
    context?: Record<string, any>;
}

export interface ExpertResult {
    success: boolean;
    output?: any;
    error?: Error;
}
