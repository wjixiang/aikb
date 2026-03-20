import type { ProgressResponse } from './app.dto.js';
import type { ReviewSection, SearchResult } from '../article-search/base.engine.js';
import type { BaseSearchEngine } from '../article-search/base.engine.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Logger } from '../utils/logger.js';

/**
 * AppService - Main application service for review tasks
 * Supports multiple review sections: epidemiology, pathophysiology, clinical, treatment
 */
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private prisma: PrismaService,
    private epidemiologyEngine: BaseSearchEngine,
    private pathophysiologyEngine: BaseSearchEngine,
    private clinicalEngine: BaseSearchEngine,
    private treatmentEngine: BaseSearchEngine,
  ) {}

  /**
   * Get engine for a specific section
   */
  private getEngine(section: ReviewSection): BaseSearchEngine {
    switch (section) {
      case 'epidemiology':
        return this.epidemiologyEngine;
      case 'pathophysiology':
        return this.pathophysiologyEngine;
      case 'clinical':
        return this.clinicalEngine;
      case 'treatment':
        return this.treatmentEngine;
      default:
        throw new Error(`Unknown section: ${section}`);
    }
  }

  /**
   * Create and run a review task for a specific section
   */
  async createTask(task: { taskInput: string; section?: ReviewSection }) {
    const section = task.section || 'epidemiology';
    const engine = this.getEngine(section);

    const result = await this.prisma.reviewTask.create({
      data: {
        taskInput: task.taskInput,
        section,
      },
    });

    // Fire and forget - research runs in background
    engine.run(result.id, this.onProgress.bind(this, result.id)).catch((err) => {
      this.logger.error(`Research failed for task ${result.id}:`, err);
    });

    return result;
  }

  /**
   * Create and run a review task for all sections
   */
  async createAllSectionsTask(task: { taskInput: string }) {
    const result = await this.prisma.reviewTask.create({
      data: {
        taskInput: task.taskInput,
        section: 'all',
      },
    });

    // Fire and forget - all sections run in background
    Promise.all([
      this.epidemiologyEngine.run(`${result.id}-epidemiology`, this.onProgress.bind(this, `${result.id}-epidemiology`)),
      this.pathophysiologyEngine.run(`${result.id}-pathophysiology`, this.onProgress.bind(this, `${result.id}-pathophysiology`)),
      this.clinicalEngine.run(`${result.id}-clinical`, this.onProgress.bind(this, `${result.id}-clinical`)),
      this.treatmentEngine.run(`${result.id}-treatment`, this.onProgress.bind(this, `${result.id}-treatment`)),
    ]).catch((err) => {
      this.logger.error(`All sections research failed for task ${result.id}:`, err);
    });

    return result;
  }

  /**
   * Get task progress
   */
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
      section: task.section || 'epidemiology',
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
