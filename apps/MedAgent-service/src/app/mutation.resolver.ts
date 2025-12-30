import { Resolver } from '@nestjs/graphql';
import { CreateTaskInput, IMutation, TaskInfo, TaskStatus } from '../graphql';
import { TaskService } from 'agent-lib'

@Resolver()
export class MutationResolver implements IMutation {
    constructor(
        private taskService: TaskService
    ) { }

    async createTask(input: CreateTaskInput): Promise<TaskInfo> {
        const task = await this.taskService.createTask(input.taskInput)

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
    }
}
