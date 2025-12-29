import { Resolver, Query, Mutation, Args, ResolveField } from '@nestjs/graphql';
import { IQuery, TaskInfo } from '../graphql';

@Resolver()
export class MedAgentResolver implements IQuery {
    listTaskInfo(): (TaskInfo | null)[] | Promise<(TaskInfo | null)[]> {
        throw new Error('Method not implemented.');
    }

}