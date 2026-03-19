import { injectable, inject, optional } from 'inversify';
import type { Tool } from '../../../components/core/types.js';
import type { IToolProvider } from '../IToolProvider.js';
import { ToolSource, BaseToolProvider } from '../IToolProvider.js';
import type { ToolExecutedCallback } from './ComponentToolProvider.js';

// Import global tools
import {
    attempt_completion,
} from '../../statefulContext/globalTools.js';

/**
 * Callback types for mail reply tracking
 */
export type ReplySentCallback = (mailId: string) => void;
export type GetUnrepliedMailIdsCallback = () => string[];
export type GetCurrentUnrepliedMailIdsCallback = () => Promise<string[]>;

/**
 * Options for configuring reply tracking in GlobalToolProvider
 */
export interface ReplyTrackingOptions {
    onReplySent?: ReplySentCallback;
    getUnrepliedMailIds?: GetUnrepliedMailIdsCallback;
    getCurrentUnrepliedMailIds?: GetCurrentUnrepliedMailIdsCallback;
}

/**
 * Global tool provider
 *
 * Provides always-available global tools:
 * - attempt_completion
 *
 * Note: Skill-related tools (get_skill, list_skills, deactivate_skill) have been
 * removed as part of the VirtualWorkspace refactoring. Components are now
 * registered directly without requiring skill activation.
 */
@injectable()
export class GlobalToolProvider extends BaseToolProvider implements IToolProvider {
    readonly id = 'global-tools';
    readonly priority = 100; // Highest priority for global tools

    private tools: Map<string, Tool>;

    /**
     * Optional callback for tool execution notifications
     * Used to notify VirtualWorkspace of tool results in real-time
     */
    private onToolExecuted?: ToolExecutedCallback;

    /**
     * Callbacks for mail reply tracking
     */
    private onReplySent?: ReplySentCallback;
    private getUnrepliedMailIds?: GetUnrepliedMailIdsCallback;
    private getCurrentUnrepliedMailIds?: GetCurrentUnrepliedMailIdsCallback;

    constructor(onToolExecuted?: ToolExecutedCallback) {
        super();
        this.tools = new Map();
        this.onToolExecuted = onToolExecuted;
        this.initializeTools();
    }

    /**
     * Set the tool executed callback
     */
    setOnToolExecuted(callback: ToolExecutedCallback): void {
        this.onToolExecuted = callback;
    }

    /**
     * Set callbacks for mail reply tracking
     * Used by Agent to track replies and check for unreplied emails
     */
    setReplyTrackingCallbacks(callbacks: ReplyTrackingOptions): void {
        this.onReplySent = callbacks.onReplySent;
        this.getUnrepliedMailIds = callbacks.getUnrepliedMailIds;
        this.getCurrentUnrepliedMailIds = callbacks.getCurrentUnrepliedMailIds;
    }

    /**
     * Initialize global tools
     */
    private initializeTools(): void {
        const globalTools: Tool[] = [
            attempt_completion,
        ];

        for (const tool of globalTools) {
            this.tools.set(tool.toolName, tool);
        }
    }

    /**
     * Get all global tools
     */
    getTools(): Tool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Get a specific global tool by name
     */
    getTool(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    /**
     * Execute a global tool
     */
    async executeTool(name: string, params: any): Promise<any> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Global tool not found: ${name}`);
        }

        try {
            // Execute the appropriate global tool
            let result: any;
            switch (name) {
                case 'attempt_completion': {
                    // Check for unreplied emails BEFORE allowing completion
                    // Use async callback to get real-time state from mailbox
                    let unrepliedIds: string[] = [];
                    if (this.getCurrentUnrepliedMailIds) {
                        unrepliedIds = await this.getCurrentUnrepliedMailIds();
                    } else {
                        // Fallback to synchronous cache-based check
                        unrepliedIds = this.getUnrepliedMailIds?.() || [];
                    }

                    if (unrepliedIds.length > 0) {
                        result = {
                            success: false,
                            completed: false,
                            result: JSON.stringify({
                                error: 'UnrepliedMailError',
                                unrepliedMailIds: unrepliedIds,
                                message: `Cannot complete: ${unrepliedIds.length} unreplied email(s) remaining. Reply to all emails before completing.`,
                            }),
                        };
                        // Notify callback
                        if (this.onToolExecuted) {
                            this.onToolExecuted(name, params, result, false, 'global');
                        }
                        return result;
                    }
                    result = this.handleAttemptCompletion(params);
                    break;
                }
                default:
                    throw new Error(`Unknown global tool: ${name}`);
            }

            // Note: replyToMessage and sendMail tracking is handled by ComponentToolProvider
            // The Agent tracks replies via memoryModule analysis after each requestLoop

            // Notify callback if registered (for real-time tool result updates)
            if (this.onToolExecuted) {
                this.onToolExecuted(name, params, result, true, 'global');
            }

            return result;
        } catch (error) {
            // Notify callback of failure
            if (this.onToolExecuted) {
                this.onToolExecuted(
                    name,
                    params,
                    error instanceof Error ? error.message : String(error),
                    false,
                    'global'
                );
            }

            throw error;
        }
    }

    /**
     * Handle attempt_completion tool call
     */
    private handleAttemptCompletion(params: any): { success: boolean; completed: boolean; result: string } {
        const result = typeof params?.result === 'string' ? params.result : '';
        return {
            success: true,
            completed: true,
            result
        };
    }

    /**
     * Check if a tool is a global tool
     */
    hasTool(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * Get all global tool names
     */
    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }
}
