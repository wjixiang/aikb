import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { CreateTaskInput, StartTaskInput, IMutation, TaskInfo, StartTaskResult } from '../graphql';
import { AppService } from './app.service';
import { GqlJwtAuthGuard } from 'auth-lib'
import { UseGuards } from '@nestjs/common';

@Resolver()
@UseGuards(GqlJwtAuthGuard)
export class MutationResolver {
    constructor(
        private appService: AppService
    ) { }

    @Mutation('createTask')
    async createTask(
        @Args('input') input: CreateTaskInput,
        @Context() context: any
    ): Promise<TaskInfo> {
        return this.appService.createTask(input, context);
    }

    @Mutation('startTask')
    async startTask(
        @Args('input') input: StartTaskInput,
        @Context() context: any
    ): Promise<StartTaskResult> {
        return this.appService.startTask(input, context);
    }
}
