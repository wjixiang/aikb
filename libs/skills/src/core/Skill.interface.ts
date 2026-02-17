import { VirtualWorkspace } from 'stateful-context';
import { z } from 'zod';

/**
 * Tool Registry - Workspace provides this to Skills
 */
export interface ToolRegistry {
  call(toolName: string, params: any): Promise<any>;
  has(toolName: string): boolean;
  get(toolName: string): any;
  list(): any[];
}

/**
 * Skill execution context
 */
export interface SkillContext {
  workspace: VirtualWorkspace;
  tools: ToolRegistry;
  state: Record<string, any>;
}

/**
 * Skill tool function definition
 */
export interface SkillToolFunction {
  description: string;
  paramsSchema: z.ZodSchema;
  handler: (params: any, context?: SkillContext) => Promise<any>;
}

/**
 * Unified Skill interface
 */
export interface Skill {
  name: string;
  version: string;
  description: string;

  // Required external tools
  requiredTools?: string[];

  // Prompt fragments
  promptFragments?: {
    capability?: string;
    direction?: string;
    systemPrompt?: string;
  };

  // Tools provided by this skill
  tools?: Record<string, SkillToolFunction>;

  // Orchestration function
  orchestrate?: (
    tools: ToolRegistry,
    params: any,
    context?: SkillContext
  ) => Promise<any>;

  // Helper functions (internal use only)
  helpers?: Record<string, (...args: any[]) => any>;

  // Lifecycle hooks
  onActivate?: (workspace: VirtualWorkspace) => Promise<void>;
  onDeactivate?: (workspace: VirtualWorkspace) => Promise<void>;

  // Metadata
  metadata?: {
    category?: string;
    tags?: string[];
    author?: string;
    created?: string;
    lastUpdated?: string;
    complexity?: 'low' | 'medium' | 'high';
  };
}
