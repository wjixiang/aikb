import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { TaskService } from './task.service';
import {
    TaskInfo,
    TaskStatus,
    CreateTaskInput,
    StartTaskResult,
    StartTaskInput,
    TaskWhereInput,
} from '../graphql';

/**
 * GraphQL Resolver for Task operations
 * Handles queries and mutations for task management
 */
@Resolver()
export class TaskResolver {
    constructor(private taskService: TaskService) { }

    /**
     * Query to get a single task by filter criteria
     * @param where - Optional TaskWhereInput for filtering
     * @param context - GraphQL context containing request info
     * @returns TaskInfo or null
     */
    @Query(() => TaskInfo, { nullable: true })
    async task(
        @Args('where', { nullable: true }) where: TaskWhereInput | null,
        @Context() context: any,
    ): Promise<TaskInfo | null> {
        return this.taskService.queryTask(where, context);
    }

    /**
     * Query to get multiple tasks by filter criteria
     * @param where - Optional TaskWhereInput for filtering
     * @param context - GraphQL context containing request info
     * @returns Array of TaskInfo
     */
    @Query(() => [TaskInfo], { nullable: false })
    async tasks(
        @Args('where', { nullable: true }) where: TaskWhereInput | null,
        @Context() context: any,
    ): Promise<TaskInfo[]> {
        return this.taskService.queryTasks(where, context);
    }

    /**
     * Mutation to create a new task
     * @param input - CreateTaskInput containing taskInput
     * @param context - GraphQL context containing request info
     * @returns Created TaskInfo
     */
    @Mutation(() => TaskInfo)
    async createTask(
        @Args('input') input: CreateTaskInput,
        @Context() context: any,
    ): Promise<TaskInfo> {
        return this.taskService.createTask(input, context);
    }

    /**
     * Mutation to start a task
     * @param input - StartTaskInput containing taskId
     * @param context - GraphQL context containing request info
     * @returns StartTaskResult indicating success or failure
     */
    @Mutation(() => StartTaskResult)
    async startTask(
        @Args('input') input: StartTaskInput,
        @Context() context: any,
    ): Promise<StartTaskResult> {
        return this.taskService.startTask(input, context);
    }
}
