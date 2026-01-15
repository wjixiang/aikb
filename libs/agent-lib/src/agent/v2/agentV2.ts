import Anthropic from "@anthropic-ai/sdk";
import {
    ApiMessage,
    TaskStatus,
    MessageAddedCallback,
    TaskStatusChangedCallback,
    TaskCompletedCallback,
    TaskAbortedCallback,
} from "../../task/task.type";
import { ProviderSettings } from "../../types/provider-settings";
import { ToolName, TokenUsage, ToolUsage } from "../../types";
import { VirtualWorkspace } from "./virtualWorkspace";
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from "../../types";
import { TextBlockParam } from "@anthropic-ai/sdk/resources";

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
 * AgentV2 class that uses VirtualWorkspace for context management
 * 
 * Key features:
 * - Uses VirtualWorkspace instead of WorkspaceBase
 * - Uses script execution (execute_script, attempt_completion) instead of editable props
 * - States are merged from all components in the workspace
 * - Simpler architecture without complex TaskExecutor dependency
 */
export abstract class AgentV2 {
    workspace: VirtualWorkspace;
    private _status: TaskStatus = 'idle';
    private _taskId: string;
    private _conversationHistory: ApiMessage[] = [];
    private _tokenUsage: TokenUsage = {
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCost: 0,
        contextTokens: 0,
    };
    private _toolUsage: ToolUsage = {};
    private _consecutiveMistakeCount: number = 0;
    private _consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map();
    private _collectedErrors: string[] = [];

    // Observer callbacks
    private messageAddedCallbacks: MessageAddedCallback[] = [];
    private statusChangedCallbacks: TaskStatusChangedCallback[] = [];
    private taskCompletedCallbacks: TaskCompletedCallback[] = [];
    private taskAbortedCallbacks: TaskAbortedCallback[] = [];

    constructor(
        public config: AgentConfig = defaultAgentConfig,
        public apiConfiguration: ProviderSettings = defaultApiConfig,
        workspace: VirtualWorkspace,
        taskId?: string,
    ) {
        this.workspace = workspace;
        this._taskId = taskId || crypto.randomUUID();

        // Set completion callback for script execution
        workspace.setCompletionCallback(async (result: string) => {
            this.complete();
        });
    }

    // ==================== Public API ====================

    /**
     * Getter for task status
     */
    public get status(): TaskStatus {
        return this._status;
    }

    /**
     * Getter for task ID
     */
    public get getTaskId(): string {
        return this._taskId;
    }

    /**
     * Getter for token usage
     */
    public get tokenUsage(): TokenUsage {
        return this._tokenUsage;
    }

    /**
     * Getter for tool usage
     */
    public get toolUsage(): ToolUsage {
        return this._toolUsage;
    }

    /**
     * Getter for conversation history
     */
    public get conversationHistory(): ApiMessage[] {
        return this._conversationHistory;
    }

    /**
     * Setter for conversation history (for restoring state)
     */
    public set conversationHistory(history: ApiMessage[]) {
        this._conversationHistory = history;
    }

    /**
     * Getter for consecutive mistake count
     */
    public get consecutiveMistakeCount(): number {
        return this._consecutiveMistakeCount;
    }

    /**
     * Setter for consecutive mistake count
     */
    public set consecutiveMistakeCount(count: number) {
        this._consecutiveMistakeCount = count;
    }

    /**
     * Getter for consecutive mistake count for apply diff
     */
    public get consecutiveMistakeCountForApplyDiff(): Map<string, number> {
        return this._consecutiveMistakeCountForApplyDiff;
    }

    /**
     * Setter for consecutive mistake count for apply diff
     */
    public set consecutiveMistakeCountForApplyDiff(map: Map<string, number>) {
        this._consecutiveMistakeCountForApplyDiff = map;
    }

    // ==================== Observer Registration ====================

    /**
     * Register message added observer
     */
    onMessageAdded(callback: MessageAddedCallback): () => void {
        this.messageAddedCallbacks.push(callback);
        return () => {
            const index = this.messageAddedCallbacks.indexOf(callback);
            if (index > -1) {
                this.messageAddedCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * Register status changed observer
     */
    onStatusChanged(callback: TaskStatusChangedCallback): () => void {
        this.statusChangedCallbacks.push(callback);
        return () => {
            const index = this.statusChangedCallbacks.indexOf(callback);
            if (index > -1) {
                this.statusChangedCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * Register task completed observer
     */
    onTaskCompleted(callback: TaskCompletedCallback): () => void {
        this.taskCompletedCallbacks.push(callback);
        return () => {
            const index = this.taskCompletedCallbacks.indexOf(callback);
            if (index > -1) {
                this.taskCompletedCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * Register task aborted observer
     */
    onTaskAborted(callback: TaskAbortedCallback): () => void {
        this.taskAbortedCallbacks.push(callback);
        return () => {
            const index = this.taskAbortedCallbacks.indexOf(callback);
            if (index > -1) {
                this.taskAbortedCallbacks.splice(index, 1);
            }
        };
    }

    // ==================== Lifecycle Methods ====================

    /**
     * Start agent with a user query
     */
    async start(query: string): Promise<AgentV2> {
        this._status = 'running';
        this.notifyStatusChanged('running');

        // Add initial user message to history
        this._conversationHistory.push({
            role: 'user',
            content: `<task>${query}</task>`,
        });

        // Start request loop
        await this.requestLoop(query);
        return this;
    }

    /**
     * Complete agent task
     */
    complete(tokenUsage?: TokenUsage, toolUsage?: ToolUsage): void {
        this._status = 'completed';
        this.notifyStatusChanged('completed');
        this.notifyTaskCompleted();
    }

    /**
     * Abort agent task
     */
    abort(abortReason?: string): void {
        this._status = 'aborted';
        this.notifyStatusChanged('aborted');
        this.notifyTaskAborted(abortReason);
    }

    // ==================== Error Handling ====================

    /**
     * Get collected errors for debugging
     */
    public getCollectedErrors() {
        return this._collectedErrors;
    }

    /**
     * Reset collected errors
     */
    public resetCollectedErrors(): void {
        this._collectedErrors = [];
    }

    // ==================== AgentV2-Specific Methods ====================

    /**
     * Get system prompt for agent
     * Uses VirtualWorkspace's renderWithScriptSection for context
     */
    async getSystemPrompt() {
        const { SYSTEM_PROMPT } = await import("../../prompts/system.js");
        return `
${await SYSTEM_PROMPT()}

${await this.workspace.renderWithScriptSection()}
        `;
    }
}
