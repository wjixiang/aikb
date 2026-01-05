import Anthropic from "@anthropic-ai/sdk";
import {
    ApiMessage,
    TaskStatus,
    MessageAddedCallback,
    TaskStatusChangedCallback,
    TaskCompletedCallback,
    TaskAbortedCallback,
} from "../task/task.type";
import { ProviderSettings } from "../types/provider-settings";
import { ToolName, TokenUsage, ToolUsage } from "../types";
import { IWorkspace } from "./agentWorkspace";
import { ToolCallingHandler, ToolContext } from "../tools";
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from "../types";
import { TextBlockParam } from "@anthropic-ai/sdk/resources";

// Import TaskExecutor and related types
import {
    TaskExecutor,
    TaskExecutorConfig,
} from "../task/execution/TaskExecutor";
import { ToolExecutorConfig } from "../task/tool-execution/ToolExecutor";

export interface AgentConfig {
    apiRequestTimeout: number;
    maxRetryAttempts: number;
    consecutiveMistakeLimit: number;
}

export const defaultAgentConfig: AgentConfig = {
    apiRequestTimeout: 60000,
    maxRetryAttempts: 3,
    consecutiveMistakeLimit: DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
};

export const defaultApiConfig: ProviderSettings = {
    apiProvider: 'zai',
    apiKey: process.env['GLM_API_KEY'],
    apiModelId: 'glm-4.7',
    toolProtocol: 'xml',
    zaiApiLine: 'china_coding',
};

/**
 * Agent class that uses TaskExecutor for task execution logic
 * Agent focuses on workspace/context management while delegating
 * task execution to TaskExecutor
 */
export abstract class Agent {
    private taskExecutor: TaskExecutor;
    private toolCallingHandler: ToolCallingHandler;
    private workspace: IWorkspace;

    constructor(
        protected config: AgentConfig = defaultAgentConfig,
        private apiConfiguration: ProviderSettings = defaultApiConfig,
        workspace: IWorkspace,
        taskId?: string,
    ) {
        this.workspace = workspace;
        const finalTaskId = taskId || crypto.randomUUID();

        // Initialize TaskExecutor with configuration
        const taskExecutorConfig: TaskExecutorConfig = {
            apiRequestTimeout: this.config.apiRequestTimeout,
            maxRetryAttempts: this.config.maxRetryAttempts,
            consecutiveMistakeLimit: this.config.consecutiveMistakeLimit,
        };

        // Initialize ToolExecutor config with workspace context
        const toolExecutorConfig: ToolExecutorConfig = {
            context: { workspace: this.workspace },
        };

        this.taskExecutor = new TaskExecutor(
            finalTaskId,
            this.apiConfiguration,
            taskExecutorConfig,
            toolExecutorConfig,
        );

        // Initialize tool calling handler and set it in TaskExecutor
        this.toolCallingHandler = new ToolCallingHandler();
        this.taskExecutor.setToolCallingHandler(this.toolCallingHandler);
    }

    // ==================== Public API (Delegated to TaskExecutor) ====================

    /**
     * Getter for task status
     */
    public get status(): TaskStatus {
        return this.taskExecutor.status;
    }

    /**
     * Getter for task ID
     */
    public get getTaskId(): string {
        return this.taskExecutor.getTaskId;
    }

    /**
     * Getter for token usage
     */
    public get tokenUsage(): TokenUsage {
        return this.taskExecutor.tokenUsage;
    }

    /**
     * Getter for tool usage
     */
    public get toolUsage(): ToolUsage {
        return this.taskExecutor.toolUsage;
    }

    /**
     * Getter for conversation history
     */
    public get conversationHistory(): ApiMessage[] {
        return this.taskExecutor.conversationHistoryRef;
    }

    /**
     * Setter for conversation history (for restoring state)
     */
    public set conversationHistory(history: ApiMessage[]) {
        this.taskExecutor.conversationHistoryRef = history;
    }

    /**
     * Getter for consecutive mistake count
     */
    public get consecutiveMistakeCount(): number {
        return this.taskExecutor['consecutiveMistakeCount'];
    }

    /**
     * Setter for consecutive mistake count
     */
    public set consecutiveMistakeCount(count: number) {
        this.taskExecutor['consecutiveMistakeCount'] = count;
    }

    /**
     * Getter for consecutive mistake count for apply diff
     */
    public get consecutiveMistakeCountForApplyDiff(): Map<string, number> {
        return this.taskExecutor['consecutiveMistakeCountForApplyDiff'];
    }

    /**
     * Setter for consecutive mistake count for apply diff
     */
    public set consecutiveMistakeCountForApplyDiff(map: Map<string, number>) {
        this.taskExecutor['consecutiveMistakeCountForApplyDiff'] = map;
    }

    // ==================== Observer Registration (Delegated to TaskExecutor) ====================

    /**
     * Register message added observer
     */
    onMessageAdded(callback: MessageAddedCallback): () => void {
        return this.taskExecutor.onMessageAdded(callback);
    }

    /**
     * Register status changed observer
     */
    onStatusChanged(callback: TaskStatusChangedCallback): () => void {
        return this.taskExecutor.onStatusChanged(callback);
    }

    /**
     * Register task completed observer
     */
    onTaskCompleted(callback: TaskCompletedCallback): () => void {
        return this.taskExecutor.onTaskCompleted(callback);
    }

    /**
     * Register task aborted observer
     */
    onTaskAborted(callback: TaskAbortedCallback): () => void {
        return this.taskExecutor.onTaskAborted(callback);
    }

    // ==================== Lifecycle Methods (Delegated to TaskExecutor) ====================

    /**
     * Start the agent with a user query
     */
    async start(query: string): Promise<Agent> {
        this.taskExecutor.execute([
            {
                type: 'text',
                text: `<task>${query}</task>`,
            },
        ]);
        return this;
    }

    /**
     * Complete the agent task
     */
    complete(tokenUsage?: TokenUsage, toolUsage?: ToolUsage): void {
        this.taskExecutor.complete();
    }

    /**
     * Abort the agent task
     */
    abort(abortReason?: string): void {
        this.taskExecutor.abort(abortReason);
    }

    // ==================== Error Handling (Delegated to TaskExecutor) ====================

    /**
     * Get collected errors for debugging
     */
    public getCollectedErrors() {
        return this.taskExecutor.getCollectedErrors();
    }

    /**
     * Reset collected errors
     */
    public resetCollectedErrors(): void {
        this.taskExecutor.resetCollectedErrors();
    }

    // ==================== Agent-Specific Methods ====================

    /**
     * Get tool context with workspace
     */
    private getToolContext(): ToolContext {
        return { workspace: this.workspace };
    }

    /**
     * Execute a tool call with workspace context
     */
    protected async executeToolCall(toolName: string, params: any): Promise<any> {
        return this.toolCallingHandler.handleToolCalling(
            toolName as ToolName,
            params,
            { context: this.getToolContext() }
        );
    }

    /**
     * Get system prompt for the agent
     * This method is kept in Agent as it may need workspace-specific customization
     */
    async getSystemPrompt() {
        const { SYSTEM_PROMPT } = await import("../prompts/system.js");
        return `
${await SYSTEM_PROMPT()}

${await this.workspace.renderContext()}
        `;
    }

    /**
     * Get the API handler (for advanced use cases)
     */
    protected get api() {
        return this.taskExecutor['api'];
    }

    /**
     * Get the task executor (for advanced use cases)
     */
    protected get taskExecutorRef(): TaskExecutor {
        return this.taskExecutor;
    }
}
