import { Resolver } from '@nestjs/graphql';
import { IQuery, TaskInfo, ApiMessage } from '../graphql';

@Resolver()
export class QueryResolver implements IQuery {
    listTaskInfo(): (TaskInfo | null)[] | Promise<(TaskInfo | null)[]> {
        throw new Error('Method not implemented.');
    }
    getTaskInfo(taskId: string): TaskInfo | Promise<TaskInfo> {
        throw new Error('Method not implemented.');
    }
    getTaskMessages(taskId: string): (ApiMessage | null)[] | Promise<(ApiMessage | null)[]> {
        throw new Error('Method not implemented.');
    }
}

