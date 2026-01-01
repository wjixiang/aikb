import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { CreateTaskInput, IMutation, TaskInfo, TaskStatus } from '../graphql';
import { TaskService } from 'agent-lib'
import { GqlJwtAuthGuard } from 'auth-lib'
import { UseGuards } from '@nestjs/common';

@Resolver()
@UseGuards(GqlJwtAuthGuard)
export class MutationResolver {
    constructor(
        private taskService: TaskService
    ) { }

    @Mutation('createTask')
    async createTask(
        @Args('input') input: CreateTaskInput,
        @Context() context: any
    ): Promise<TaskInfo> {
        console.log('creating task', input)
        try {
            // Extract userId from the request context (set by GqlJwtAuthGuard)
            const userId = context.req?.user?.sub;

            if (!userId) {
                throw new Error('User not authenticated');
            }

            const task = await this.taskService.createTask(input.taskInput, userId)

            // Map lowercase status from agent-lib to uppercase GraphQL enum
            const statusMap: Record<string, TaskStatus> = {
                'idle': TaskStatus.IDLE,
                'running': TaskStatus.RUNNING,
                'completed': TaskStatus.COMPLETED,
                'aborted': TaskStatus.ABORTED
            };

            return {
                id: task.taskId,
                taskInput: task.taskInput,
                taskStatus: statusMap[task.status] || TaskStatus.IDLE,
                createdAt: new Date().toISOString()
            }
        } catch (error) {
            console.error('Error creating task:', error)
            throw new Error(`Failed to create task: ${error instanceof Error ? error.message : String(error)}`)
        }
    }
}
