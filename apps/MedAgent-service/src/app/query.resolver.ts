import { Resolver, Query, Context } from '@nestjs/graphql';
import { IQuery, TaskInfo, ApiMessage, TaskStatus } from '../graphql';
import { TaskService } from 'agent-lib';
import { GqlJwtAuthGuard } from 'auth-lib'
import { UseGuards } from '@nestjs/common';

@Resolver()
@UseGuards(GqlJwtAuthGuard)
export class QueryResolver {
    constructor(
        private taskService: TaskService
    ) { }

    @Query('listTaskInfo')
    async listTaskInfo(@Context() context: any): Promise<TaskInfo[]> {
        // Extract userId from the request context (set by GqlJwtAuthGuard)
        const userId = context.req?.user?.sub;

        if (!userId) {
            throw new Error('User not authenticated');
        }

        const tasks = await this.taskService.listTasksByUserId(userId);
        return tasks.map(task => ({
            id: task.id,
            taskInput: task.taskInput,
            taskStatus: task.status as TaskStatus,
            createdAt: task.createdAt.toISOString()
        }));
    }
    getTaskInfo(taskId: string): TaskInfo | Promise<TaskInfo> {
        throw new Error('Method not implemented.');
    }
    getTaskMessages(taskId: string): ApiMessage[] | Promise<ApiMessage[]> {
        throw new Error('Method not implemented.');
    }

}

