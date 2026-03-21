import type {
  RuntimeTask,
  RuntimeTaskResult,
  TaskListener,
  TaskQueryFilter,
  RuntimeTaskStatus,
} from './types.js';

export interface ITaskStorage {
  add(task: RuntimeTask): Promise<void>;

  get(taskId: string): Promise<RuntimeTask | undefined>;

  update(taskId: string, updates: Partial<RuntimeTask>): Promise<void>;

  delete(taskId: string): Promise<void>;

  query(filter: TaskQueryFilter): Promise<RuntimeTask[]>;

  getPending(receiver?: string): Promise<RuntimeTask[]>;

  getActive(receiver?: string): Promise<RuntimeTask[]>;

  saveResult(result: RuntimeTaskResult): Promise<void>;

  getResult(taskId: string): Promise<RuntimeTaskResult | undefined>;
}

export class InMemoryTaskStorage implements ITaskStorage {
  private tasks: Map<string, RuntimeTask> = new Map();

  private results: Map<string, RuntimeTaskResult> = new Map();

  async add(task: RuntimeTask): Promise<void> {
    this.tasks.set(task.taskId, task);
  }

  async get(taskId: string): Promise<RuntimeTask | undefined> {
    return this.tasks.get(taskId);
  }

  async update(taskId: string, updates: Partial<RuntimeTask>): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    this.tasks.set(taskId, { ...task, ...updates });
  }

  async delete(taskId: string): Promise<void> {
    this.tasks.delete(taskId);
    this.results.delete(taskId);
  }

  async query(filter: TaskQueryFilter): Promise<RuntimeTask[]> {
    let tasks = Array.from(this.tasks.values());

    if (filter.status) {
      tasks = tasks.filter((t) => t.status === filter.status);
    }
    if (filter.receiver) {
      tasks = tasks.filter((t) => t.receiver === filter.receiver);
    }
    if (filter.sender) {
      tasks = tasks.filter((t) => t.sender === filter.sender);
    }
    if (filter.limit) {
      tasks = tasks.slice(0, filter.limit);
    }

    return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getPending(receiver?: string): Promise<RuntimeTask[]> {
    return this.query({ status: 'pending', receiver });
  }

  async getActive(receiver?: string): Promise<RuntimeTask[]> {
    let tasks = Array.from(this.tasks.values());
    if (receiver) {
      tasks = tasks.filter(
        (t) =>
          t.receiver === receiver &&
          (t.status === 'pending' || t.status === 'processing'),
      );
    } else {
      tasks = tasks.filter(
        (t) => t.status === 'pending' || t.status === 'processing',
      );
    }
    return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async saveResult(result: RuntimeTaskResult): Promise<void> {
    this.results.set(result.taskId, result);
  }

  async getResult(taskId: string): Promise<RuntimeTaskResult | undefined> {
    return this.results.get(taskId);
  }
}
