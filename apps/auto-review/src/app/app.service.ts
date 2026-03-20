import type { ProgressResponse } from './app.dto.js';
import { EpidemiologyResearchEngine } from './task.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Logger } from '../utils/logger.js';

/**
 * AppService - Main application service for review tasks
 */
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private prisma: PrismaService,
    private researchEngine: EpidemiologyResearchEngine,
  ) {}

  async createTask(task: { taskInput: string }) {
    const result = await this.prisma.reviewTask.create({ data: task });
    // Fire and forget - research runs in background
    this.researchEngine.runByTaskId(result.id, this.onProgress.bind(this, result.id)).catch((err) => {
      this.logger.error(`Research failed for task ${result.id}:`, err);
    });
    return result;
  }

  async getTaskProgress(taskInput: string): Promise<ProgressResponse | null> {
    const task = await this.prisma.reviewTask.findFirst({
      where: { taskInput },
      include: { progress: { orderBy: { ts: 'desc' } } },
    });

    if (!task) {
      return null;
    }

    return {
      taskId: task.id,
      taskInput: task.taskInput,
      progress: task.progress.map((p) => ({
        id: p.id,
        done: p.done,
        log: p.log,
        ts: p.ts,
      })),
    };
  }

  /**
   * Progress callback for research engine
   */
  private async onProgress(taskId: string, state: any): Promise<void> {
    try {
      await this.prisma.progress.create({
        data: {
          taskId,
          done: state.result ? 'completed' : 'in_progress',
          log: JSON.stringify(state),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to save progress for task ${taskId}:`, error);
    }
  }
}
