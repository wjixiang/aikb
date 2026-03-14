/**
 * Expert Types - Multi-Agent Architecture
 *
 * Expert: Independent professional Agent with its own context, components, and task processing capabilities
 * Integrates original Skill functionality: prompt, components, lifecycle hooks
 */

import type { ToolComponent } from '../../components/index.js';
import type { ProviderSettings } from '../types/provider-settings.js';
import type { AgentConfig } from '../agent/agent.js';

/**
 * Component definition - for Expert
 * Supports three modes:
 * 1. Direct instance: ToolComponent
 * 2. Factory function: () => ToolComponent | Promise<ToolComponent>
 * 3. Async factory: async () => Promise<ToolComponent>
 */
export interface ExpertComponentDefinition {
    /** Unique identifier */
    componentId: string;
    /** Display name */
    displayName: string;
    /** Description */
    description: string;
    /** Instance or factory function */
    instance: ToolComponent | (() => ToolComponent) | (() => Promise<ToolComponent>);
    /** Whether it is a shared component (preserves state across Experts) */
    shared?: boolean;
    /** Priority for component registration (lower = earlier) */
    priority?: number;
}

/**
 * Expert Configuration - integrates all original Skill functionality
 */
export interface ExpertConfig {
    /** Expert unique identifier (original Skill name) */
    expertId: string;
    /** Expert display name (original Skill displayName) */
    displayName: string;
    /** Expert description (original Skill description) */
    description: string;
    /** When to use this Expert (original Skill whenToUse) */
    whenToUse?: string;
    /** Trigger keywords (original Skill triggers) */
    triggers?: string[];

    /** Responsibility description - when Controller should delegate to this Expert */
    responsibilities: string;

    /** Capability description */
    capabilities: string[];

    /** Component definitions (original Skill components) */
    components: ExpertComponentDefinition[];

    /** Prompt enhancement (original Skill prompt) */
    prompt: {
        /** Capability description */
        capability: string;
        /** Direction guidance */
        direction: string;
    };

    /** Additional system prompt */
    systemPrompt?: string;

    /** Whether to auto-activate */
    autoActivate?: boolean;

    /** Lifecycle hooks (original Skill onActivate/onDeactivate) */
    onActivate?: () => Promise<void>;
    onDeactivate?: () => Promise<void>;
    onComponentActivate?: (component: ToolComponent) => Promise<void>;
    onComponentDeactivate?: (component: ToolComponent) => Promise<void>;

    /**
     * Export configuration for workspace
     * Controls how Expert results are exported to storage
     */
    exportConfig?: ExpertExportConfig;

    /**
     * Input handler for task input processing
     * Validates, transforms input and loads external data
     */
    input?: InputHandler;

    /**
     * API configuration for the Expert's underlying Agent
     * Controls API provider, model, and related settings
     * 
     * @example
     * // Use OpenAI with specific model
     * apiConfiguration: {
     *   apiProvider: 'openai',
     *   apiModelId: 'gpt-4o'
     * }
     * 
     * @example
     * // Use Anthropic Claude
     * apiConfiguration: {
     *   apiProvider: 'anthropic',
     *   apiModelId: 'claude-sonnet-4-20250514'
     * }
     */
    apiConfiguration?: Partial<ProviderSettings>;

    /**
     * Agent configuration overrides
     * Controls agent behavior like timeout, retry, memory settings
     */
    config?: Partial<AgentConfig>;
}

/**
 * Export configuration for Expert results
 */
export interface ExpertExportConfig {
    /** Whether to auto-export after task completion */
    autoExport?: boolean;
    /** Default bucket for export */
    bucket?: string;
    /**
     * Default path template
     * Supports placeholders: {expertId}, {timestamp}, {taskId}
     * Note: Format extension should be included in the path
     */
    defaultPath?: string;
    /**
     * Custom export handler
     * Full control over:
     * - Export format (via file extension in path)
     * - Content type
     * - Export logic
     */
    exportHandler?: (
        workspace: any,
        config: ExportConfig
    ) => Promise<ExportResult>;
}

/**
 * Export configuration for a single export operation
 */
export interface ExportConfig {
    bucket: string;
    path: string;
}

/**
 * Export result
 */
export interface ExportResult {
    success: boolean;
    filePath?: string;
    url?: string;
    contentType?: string;
    error?: string;
}

/**
 * Expert Summary - for display and selection
 */
export interface ExpertSummary {
    expertId: string;
    displayName: string;
    description: string;
    whenToUse?: string;
    triggers?: string[];
    capabilities: string[];
}

/**
 * Expert status
 */
export type ExpertStatus = 'idle' | 'ready' | 'running' | 'completed' | 'failed' | 'suspended';

/**
 * Expert execution result
 */
export interface ExpertResult {
    expertId: string;
    success: boolean;
    output: any;
    summary: string;
    artifacts?: ExpertArtifact[];
    errors?: string[];
    duration: number;
}

/**
 * Expert artifact (can be passed to other Experts)
 */
export interface ExpertArtifact {
    /** Artifact type */
    type: 'data' | 'document' | 'model-output' | 'state';
    /** Artifact name */
    name: string;
    /** Artifact content */
    content: any;
    /** Metadata */
    metadata?: Record<string, any>;
    /** Whether it can be shared with other Experts */
    shareable: boolean;
}

/**
 * Expert task
 */
export interface ExpertTask {
    /** Task ID */
    taskId: string;
    /** Task description */
    description: string;
    /** Task input */
    input?: any;
    /** Dependencies on other Expert tasks */
    dependencies?: string[];
    /** Expected output types */
    expectedOutputs?: string[];
}

/**
 * Expert execution request
 */
export interface ExpertExecuteRequest {
    /** Expert ID or name */
    expertId: string;
    /** Task to execute */
    task: ExpertTask;
    /** Context (from Controller or other Experts) */
    context?: Record<string, any>;
    /** Timeout in milliseconds */
    timeout?: number;
}

/**
 * Expert lifecycle event
 */
export interface ExpertLifecycleEvent {
    type: 'created' | 'activated' | 'suspended' | 'resumed' | 'completed' | 'failed' | 'error';
    expertId: string;
    timestamp: number;
    data?: any;
}

/**
 * Expert Registry - for managing all Experts
 */
export interface IExpertRegistry {
    /** Register Expert */
    register(expert: ExpertConfig): void;
    /** Get Expert */
    get(expertId: string): ExpertConfig | undefined;
    /** Get all Experts */
    getAll(): ExpertConfig[];
    /** Find Experts by capability */
    findByCapability(capability: string): ExpertConfig[];
    /** Find Experts by trigger */
    findByTrigger(trigger: string): ExpertConfig[];
    /** List all available Experts */
    listExperts(): ExpertSummary[];
}

/**
 * Expert Executor - responsible for creating and managing Expert instances
 */
export interface IExpertExecutor {
    /** Register Expert */
    registerExpert(config: ExpertConfig): void;
    /** Create Expert instance */
    createExpert(expertId: string): Promise<IExpertInstance>;
    /** Get Expert instance */
    getExpert(expertId: string): IExpertInstance | undefined;
    /** Release Expert instance */
    releaseExpert(expertId: string): void;
    /** Execute Expert task */
    execute(request: ExpertExecuteRequest): Promise<ExpertResult>;
}

/**
 * Expert Instance - running Expert
 */
export interface IExpertInstance {
    /** Expert ID */
    expertId: string;
    /** Status */
    status: ExpertStatus;
    /** Activate Expert */
    activate(): Promise<void>;
    /** Suspend Expert */
    suspend(): Promise<void>;
    /** Resume Expert */
    resume(): Promise<void>;
    /** Execute task */
    execute(task: ExpertTask, context?: Record<string, any>): Promise<ExpertResult>;
    /** Get current state summary */
    getStateSummary(): Promise<string>;
    /** Get artifacts */
    getArtifacts(): ExpertArtifact[];
    /** Cleanup resources */
    dispose(): Promise<void>;
}

/**
 * Expert scheduling strategy
 */
export type ExpertSchedulingStrategy = 'sequential' | 'parallel' | 'dependency-ordered' | 'conditional';

/**
 * Expert orchestration request
 */
export interface ExpertOrchestrationRequest {
    /** Main task description */
    task: string;
    /** Task decomposition strategy */
    strategy: ExpertSchedulingStrategy;
    /** Expert task list */
    expertTasks: {
        expertId: string;
        task: ExpertTask;
        conditional?: boolean;
    }[];
    /** Global context */
    globalContext?: Record<string, any>;
    /** Timeout */
    timeout?: number;
}

/**
 * Expert orchestration result
 */
export interface ExpertOrchestrationResult {
    success: boolean;
    overallSummary: string;
    expertResults: Map<string, ExpertResult>;
    finalOutput: any;
    artifacts: ExpertArtifact[];
    totalDuration: number;
    errors?: string[];
}

// =============================================================================
// Expert Definition Framework - Declarative Expert Development
// =============================================================================

/**
 * Parameter definition for SOP
 */
export interface ParameterDefinition {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 's3Key[]';
    required: boolean;
    description: string;
    default?: any;
    validation?: (value: any) => boolean;
}

/**
 * Step definition in SOP workflow
 */
export interface StepDefinition {
    phase: string;
    description: string;
    details?: string;
}

/**
 * Example for SOP documentation
 */
export interface Example {
    input: string;
    output: string;
    description?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors?: string[];
    warnings?: string[];
}

/**
 * External data loaded during input processing (e.g., from S3)
 */
export interface ExternalData {
    /** S3 file paths list, loaded and merged into context */
    s3Keys?: string[];
    /** Other external data sources */
    [key: string]: any;
}

/**
 * Execution context for input handler
 */
export interface ExecutionContext {
    /** Virtual workspace */
    workspace: any;
    /** Expert ID */
    expertId: string;
    /** Task information */
    task: ExpertTask;
    /** Additional context */
    context?: Record<string, any>;
}

/**
 * Input handler for task input processing
 */
export interface InputHandler {
    /** Validate input parameters */
    validate?: (input: any) => ValidationResult;
    /** Transform input before processing */
    transform?: (input: any) => any;
    /** Load external data (e.g., S3 files) */
    loadExternalData?: (input: any, context: ExecutionContext) => Promise<ExternalData>;
}

/**
 * Output handler for result export
 */
export interface OutputHandler {
    /** Default export format */
    format: 'json' | 'csv' | 'xml' | 'custom';
    /** Custom export function */
    export?: (workspace: any, config: ExportConfig) => Promise<ExportResult>;
    /** Post-process output */
    postprocess?: (output: any) => any;
}

/**
 * SOP definition structure
 */
export interface SOPDefinition {
    /** Capability overview */
    overview: string;
    /** Responsibilities */
    responsibilities: string[];
    /** Constraints */
    constraints?: string[];
    /** Parameter definitions */
    parameters?: ParameterDefinition[];
    /** Workflow steps */
    steps: StepDefinition[];
    /** Examples */
    examples?: Example[];
}

/**
 * Component state validation
 */
export interface ComponentStateValidation {
    /** Validate component state */
    validate: (state: any) => ValidationResult;
}

/**
 * Component definition with state validation
 */
export interface ComponentDefinition {
    componentId: string;
    displayName: string;
    description: string;
    /** Instance, factory function, or DI Token */
    instance: ToolComponent | (() => ToolComponent) | (() => Promise<ToolComponent>) | symbol;
    /** Component state validation */
    stateValidation?: (state: any) => ValidationResult;
    /** Component configuration */
    config?: Record<string, any>;
    /** Whether it is a shared component */
    shared?: boolean;
}

/**
 * Lifecycle hooks for Expert
 */
export interface LifecycleHooks {
    /** Called when Expert is created */
    onCreate?: () => Promise<void>;
    /** Called when Expert is activated */
    onActivate?: () => Promise<void>;
    /** Called when Expert is deactivated */
    onDeactivate?: () => Promise<void>;
    /** Called when Expert is disposed */
    onDispose?: () => Promise<void>;
    /** Called when a component is activated */
    onComponentActivate?: (component: ToolComponent) => Promise<void>;
    /** Called when a component is deactivated */
    onComponentDeactivate?: (component: ToolComponent) => Promise<void>;
}

/**
 * Expert metadata
 */
export interface ExpertMetadata {
    /** Unique identifier */
    id: string;
    /** Display name */
    displayName: string;
    /** Description */
    description?: string;
    /** Category */
    category?: string;
    /** Tags for discovery */
    tags?: string[];
    /** Trigger keywords */
    triggers?: string[];
    /** When to use this Expert */
    whenToUse?: string;
}

/**
 * Unified Expert Schema interface
 * Provides a declarative way to define an Expert with all components
 * (Named ExpertSchema to avoid conflict with the existing ExpertDefinition class)
 */
export interface ExpertSchema {
    /** Metadata */
    metadata: ExpertMetadata;
    /** SOP definition */
    sop: SOPDefinition;
    /** Component definitions */
    components: ComponentDefinition[];
    /** Input handler */
    input?: InputHandler;
    /** Output handler */
    output: OutputHandler;
    /** Lifecycle hooks */
    lifecycle?: LifecycleHooks;
}
