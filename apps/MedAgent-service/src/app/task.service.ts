import { Injectable } from '@nestjs/common';
import { AgentDBPrismaService } from 'agent-db';
import { AgentV2, defaultAgentConfig, defaultApiConfig } from 'agent-lib';
import { VirtualWorkspace } from 'agent-lib';
import {
    TaskInfo,
    TaskStatus,
    CreateTaskInput,
    StartTaskResult,
    StartTaskInput,
    TaskWhereInput,
} from '../graphql';
import { ApiMessage } from 'agent-lib';

// Map lowercase status from database to uppercase GraphQL enum
const statusMap: Record<string, TaskStatus> = {
    idle: TaskStatus.IDLE,
    running: TaskStatus.RUNNING,
    completed: TaskStatus.COMPLETED,
    aborted: TaskStatus.ABORTED,
};

/**
 * TaskService using AgentV2 for task management
 * Replaces the deprecated TaskService from agent-lib
 */
@Injectable()
export class TaskService {
    // Store active agents in memory
    private agents = new Map<string, AgentV2>();

    constructor(private db: AgentDBPrismaService) { }

    /**
     * Get user ID from request context
     * @param context - GraphQL context object
     * @returns User ID
     * @throws Error if user is not authenticated
     */
    private getUserId(context: any): string {
        const userId = context.req?.user?.sub;
        if (!userId) {
            throw new Error('User not authenticated');
        }
        return userId;
    }

    /**
     * List all tasks for the authenticated user
     * @param context - GraphQL context object
     * @returns Array of TaskInfo
     */
    async listTaskInfo(context: any): Promise<TaskInfo[]> {
        const userId = this.getUserId(context);

        const tasks = await this.db.task.findMany({
            where: {
                userId: userId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return tasks.map((task) => ({
            id: task.id,
            taskInput: task.taskInput,
            taskStatus: statusMap[task.status] || TaskStatus.IDLE,
            createdAt: task.createdAt.toISOString(),
        }));
    }

    /**
     * Build Prisma where clause from TaskWhereInput
     * Supports AND, OR, NOT logical operators
     */
    private buildWhereClause(where: TaskWhereInput | null | undefined): any {
        if (!where) {
            return {};
        }

        const prismaWhere: any = {};

        // Handle basic fields
        if (where.id) {
            prismaWhere.id = where.id;
        }
        if (where.id_in) {
            prismaWhere.id = { in: where.id_in };
        }
        if (where.userId) {
            prismaWhere.userId = where.userId;
        }
        if (where.userId_in) {
            prismaWhere.userId = { in: where.userId_in };
        }
        if (where.status) {
            // Convert uppercase GraphQL enum to lowercase database status
            prismaWhere.status = where.status.toLowerCase();
        }
        if (where.status_in) {
            prismaWhere.status = { in: where.status_in.map(s => s.toLowerCase()) };
        }

        // Handle date comparisons
        if (where.createdAt_gt) {
            prismaWhere.createdAt = { ...prismaWhere.createdAt, gt: new Date(where.createdAt_gt) };
        }
        if (where.createdAt_lt) {
            prismaWhere.createdAt = { ...prismaWhere.createdAt, lt: new Date(where.createdAt_lt) };
        }
        if (where.createdAt_gte) {
            prismaWhere.createdAt = { ...prismaWhere.createdAt, gte: new Date(where.createdAt_gte) };
        }
        if (where.createdAt_lte) {
            prismaWhere.createdAt = { ...prismaWhere.createdAt, lte: new Date(where.createdAt_lte) };
        }

        // Handle string filters
        if (where.taskInput_contains) {
            prismaWhere.taskInput = { contains: where.taskInput_contains };
        }
        if (where.taskInput_starts_with) {
            prismaWhere.taskInput = { startsWith: where.taskInput_starts_with };
        }

        // Handle logical operators
        if (where.AND && where.AND.length > 0) {
            prismaWhere.AND = where.AND.map(w => this.buildWhereClause(w));
        }
        if (where.OR && where.OR.length > 0) {
            prismaWhere.OR = where.OR.map(w => this.buildWhereClause(w));
        }
        if (where.NOT && where.NOT.length > 0) {
            prismaWhere.NOT = where.NOT.map(w => this.buildWhereClause(w));
        }

        return prismaWhere;
    }

    /**
     * Query tasks with filtering support
     * @param where - Optional TaskWhereInput for filtering
     * @param context - GraphQL context object
     * @returns Array of TaskInfo
     */
    async queryTasks(where: TaskWhereInput | null | undefined, context: any): Promise<TaskInfo[]> {
        const userId = this.getUserId(context);

        // Always filter by userId for security
        const prismaWhere = this.buildWhereClause(where);
        prismaWhere.userId = userId;

        const tasks = await this.db.task.findMany({
            where: prismaWhere,
            orderBy: {
                createdAt: 'desc',
            },
        });
        return tasks.map((task) => ({
            id: task.id,
            taskInput: task.taskInput,
            taskStatus: statusMap[task.status] || TaskStatus.IDLE,
            createdAt: task.createdAt.toISOString(),
        }));
    }

    /**
     * Query a single task with filtering support
     * @param where - Optional TaskWhereInput for filtering
     * @param context - GraphQL context object
     * @returns TaskInfo or null
     */
    async queryTask(where: TaskWhereInput | null | undefined, context: any): Promise<TaskInfo | null> {
        const userId = this.getUserId(context);

        // Always filter by userId for security
        const prismaWhere = this.buildWhereClause(where);
        prismaWhere.userId = userId;

        const task = await this.db.task.findFirst({
            where: prismaWhere,
        });

        if (!task) {
            return null;
        }

        return {
            id: task.id,
            taskInput: task.taskInput,
            taskStatus: statusMap[task.status] || TaskStatus.IDLE,
            createdAt: task.createdAt.toISOString(),
        };
    }

    /**
     * Get a single task by ID for the authenticated user
     * @param taskId - The ID of the task to retrieve
     * @param context - GraphQL context object
     * @returns TaskInfo
     * @throws Error if task not found or user not authorized
     */
    async getTaskInfo(taskId: string, context: any): Promise<TaskInfo> {
        const userId = this.getUserId(context);

        const task = await this.db.task.findUnique({
            where: { id: taskId },
        });

        if (!task) {
            throw new Error('Task not found');
        }

        if (task.userId !== userId) {
            throw new Error('User not authorized to access this task');
        }

        return {
            id: task.id,
            taskInput: task.taskInput,
            taskStatus: statusMap[task.status] || TaskStatus.IDLE,
            createdAt: task.createdAt.toISOString(),
        };
    }

    /**
     * Get all messages for a task for the authenticated user
     * @param taskId - The ID of the task
     * @param context - GraphQL context object
     * @returns Array of ApiMessage
     * @throws Error if task not found or user not authorized
     */
    async getTaskMessages(taskId: string, context: any): Promise<ApiMessage[]> {
        const userId = this.getUserId(context);

        const task = await this.db.task.findUnique({
            where: { id: taskId },
        });

        if (!task) {
            throw new Error('Task not found');
        }

        if (task.userId !== userId) {
            throw new Error('User not authorized to access this task');
        }

        const messages = await this.db.conversationMessage.findMany({
            where: { taskId: taskId },
            orderBy: { timestamp: 'asc' },
        });
        return messages.map((msg) => this.mapConversationMessageToApiMessage(msg));
    }

    /**
     * Map database ConversationMessage to ApiMessage
     * Restores the message format from database storage
     */
    private mapConversationMessageToApiMessage(msg: any): ApiMessage {
        const apiMessage: ApiMessage = {
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content as any,
            ts: Number(msg.timestamp),
        };

        // If reasoning exists and role is assistant, prepend thinking block
        if (msg.reasoning && msg.role === 'assistant') {
            const thinkingBlock = {
                type: 'thinking' as const,
                thinking: msg.reasoning,
            };

            // If content is already an array, prepend thinking block
            if (Array.isArray(apiMessage.content)) {
                apiMessage.content = [thinkingBlock, ...apiMessage.content];
            } else if (typeof apiMessage.content === 'string') {
                // If content is a string, convert to array with thinking block and text block
                apiMessage.content = [
                    thinkingBlock,
                    {
                        type: 'text' as const,
                        text: apiMessage.content,
                    },
                ];
            }
        }

        return apiMessage;
    }

    /**
     * Create a new task for the authenticated user
     * @param input - CreateTaskInput containing taskInput
     * @param context - GraphQL context object
     * @returns TaskInfo of the created task
     */
    async createTask(input: CreateTaskInput, context: any): Promise<TaskInfo> {
        console.log('creating task', input);
        try {
            const userId = this.getUserId(context);

            // Create task in database
            const task = await this.db.task.create({
                data: {
                    userId: userId,
                    taskInput: input.taskInput,
                    createdAt: new Date(),
                    status: 'idle',
                },
            });

            // Create and initialize AgentV2 instance
            const agent = this.initializeAgent(task.id, input.taskInput);
            this.agents.set(task.id, agent);

            return {
                id: task.id,
                taskInput: task.taskInput,
                taskStatus: statusMap[task.status] || TaskStatus.IDLE,
                createdAt: task.createdAt.toISOString(),
            };
        } catch (error) {
            console.error('Error creating task:', error);
            throw new Error(
                `Failed to create task: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Initialize an AgentV2 instance with observers for message and status changes
     */
    private initializeAgent(taskId: string, taskInput: string): AgentV2 {
        // Create a simple VirtualWorkspace for the agent
        const workspace = new VirtualWorkspace({
            id: taskId,
            name: `Task-${taskId}`,
            description: 'Workspace for task execution',
        });

        // Create AgentV2 instance
        const agent = new AgentV2(
            defaultAgentConfig,
            defaultApiConfig,
            workspace,
            taskId,
        );

        // Register observer for LLM messages
        agent.onMessageAdded(
            async (taskId: string, message: ApiMessage) => {
                // Extract reasoning from assistant messages (thinking blocks)
                let reasoning: string | undefined;
                let contentToStore = message.content;

                if (message.role === 'assistant' && Array.isArray(message.content)) {
                    const thinkingBlock = message.content.find(
                        (block: any) => block.type === 'thinking',
                    );
                    if (thinkingBlock) {
                        reasoning = (thinkingBlock as any).thinking;
                        // Remove thinking block from content for storage
                        contentToStore = message.content.filter(
                            (block: any) => block.type !== 'thinking',
                        );
                    }
                }

                // Store the message to database
                await this.db.conversationMessage.create({
                    data: {
                        taskId: taskId,
                        role: message.role,
                        content: contentToStore as any,
                        reasoning: reasoning,
                        timestamp: message.ts || Date.now(),
                    },
                });
            },
        );

        // Register observer for task status changed
        agent.onStatusChanged(
            async (taskId: string, changedStatus: string) => {
                await this.db.task.update({
                    where: {
                        id: taskId,
                    },
                    data: {
                        status: changedStatus as any,
                    },
                });
            },
        );

        return agent;
    }

    /**
     * Start a task by its ID
     * @param input - StartTaskInput containing taskId
     * @param context - GraphQL context object
     * @returns StartTaskResult indicating success or failure
     */
    async startTask(
        input: StartTaskInput,
        context: any,
    ): Promise<StartTaskResult> {
        console.log('start task', input);
        try {
            const userId = this.getUserId(context);

            // Check if task exists in database
            const taskRecord = await this.db.task.findUnique({
                where: { id: input.taskId },
                include: {
                    conversationMessages: {
                        orderBy: { timestamp: 'asc' },
                    },
                },
            });

            if (!taskRecord) {
                return { isSuccess: false, failedReason: 'Task not found' };
            }

            if (taskRecord.userId !== userId) {
                return { isSuccess: false, failedReason: 'User not authorized' };
            }

            // Restore task status
            if (
                taskRecord.status === 'completed' ||
                taskRecord.status === 'aborted'
            ) {
                return {
                    isSuccess: false,
                    failedReason: 'Task already completed or aborted',
                };
            }

            // Get or create agent instance
            let agent = this.agents.get(input.taskId);

            if (!agent) {
                // Reinitialize the agent from database record
                agent = this.initializeAgent(taskRecord.id, taskRecord.taskInput);

                // Restore conversation history
                agent.conversationHistory = taskRecord.conversationMessages.map((msg) => ({
                    role: msg.role as 'user' | 'assistant' | 'system',
                    content: msg.content as any,
                    ts: Number(msg.timestamp),
                }));

                this.agents.set(input.taskId, agent);
            }

            // Start the agent (non-blocking)
            agent.start(taskRecord.taskInput).catch((error) => {
                console.error(`Error starting agent for task ${input.taskId}:`, error);
            });

            return { isSuccess: true };
        } catch (error) {
            console.error('Error starting task:', error);
            return {
                isSuccess: false,
                failedReason: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
