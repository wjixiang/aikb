import { Resolver } from '@nestjs/graphql';
import { CreateTaskInput, IMutation, TaskInfo } from '../graphql';

@Resolver()
export class MutationResolver implements IMutation {
    createTask(input: CreateTaskInput): TaskInfo | Promise<TaskInfo> {
        throw new Error('Method not implemented.');
    }
}
