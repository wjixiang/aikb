import { Resolver, Query, Args, Context } from '@nestjs/graphql';
import { TaskInfo, ApiMessage } from '../graphql';
import { AppService } from './app.service';
import { GqlJwtAuthGuard } from 'auth-lib'
import { UseGuards } from '@nestjs/common';

@Resolver()
@UseGuards(GqlJwtAuthGuard)
export class QueryResolver {
    constructor(
        private appService: AppService
    ) { }

    @Query('listTaskInfo')
    async listTaskInfo(@Context() context: any): Promise<TaskInfo[]> {
        return this.appService.listTaskInfo(context);
    }

    @Query('getTaskInfo')
    async getTaskInfo(@Args('taskId') taskId: string, @Context() context: any): Promise<TaskInfo> {
        return this.appService.getTaskInfo(taskId, context);
    }

    @Query('getTaskMessages')
    async getTaskMessages(@Args('taskId') taskId: string, @Context() context: any): Promise<ApiMessage[]> {
        return this.appService.getTaskMessages(taskId, context);
    }
}
