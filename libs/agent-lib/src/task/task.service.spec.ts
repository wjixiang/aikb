import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { AgentDBPrismaService } from 'agent-db';
import { vi } from 'vitest';

// Create a mock class that extends the structure of AgentDBPrismaService
class MockAgentDBPrismaService {
  task = {
    create: vi.fn().mockResolvedValue({
      id: 'test-task-id',
      taskInput: 'hypertension',
      createdAt: new Date()
    }),
    update: vi.fn().mockResolvedValue({})
  };
  conversationMessage = {
    create: vi.fn().mockResolvedValue({})
  };
}

describe('TaskService', () => {
  let service: TaskService;
  let mockDbService: MockAgentDBPrismaService;

  beforeEach(async () => {
    mockDbService = new MockAgentDBPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: AgentDBPrismaService,
          useClass: MockAgentDBPrismaService
        }
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  it('should create a new task', async () => {
    const task = await service.createTask("hypertension");
    expect(task.taskId).toBe('test-task-id');
    expect(mockDbService.task.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        taskInput: 'hypertension',
        createdAt: expect.any(Date)
      }
    });
  });
});
