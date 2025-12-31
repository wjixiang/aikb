import { Resolver, Query } from '@nestjs/graphql';
import { IQuery, TaskInfo, ApiMessage, TaskStatus } from '../graphql';

@Resolver()
export class QueryResolver implements IQuery {

    @Query('listTaskInfo')
    listTaskInfo(): TaskInfo[] | Promise<TaskInfo[]> {
        return [{
            id: 'test',
            taskInput: 'test',
            taskStatus: TaskStatus.IDLE,
            createdAt: 'test'
        }]
    }
    getTaskInfo(taskId: string): TaskInfo | Promise<TaskInfo> {
        throw new Error('Method not implemented.');
    }
    getTaskMessages(taskId: string): ApiMessage[] | Promise<ApiMessage[]> {
        throw new Error('Method not implemented.');
    }

}

