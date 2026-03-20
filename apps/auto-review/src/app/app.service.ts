import type { ProgressResponse } from './app.dto.js';
import type {
  ReviewSection,
  SearchResult,
} from '../article-search/base.engine.js';
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
  async createTask(task: {
    taskInput: string;
    section?: ReviewSection;
    embed?: boolean;
  }) {
    const section = task.section || 'epidemiology';
    const engine = this.getEngine(section);

    const result = await this.prisma.reviewTask.create({
      data: {
        taskInput: task.taskInput,
        section,
      },
    });

    const embed = task.embed !== false;

    engine
      .runWithSave(
        result.id,
        task.taskInput,
        this.onProgress.bind(this, result.id),
        embed,
      )
      .catch((err) => {
        this.logger.error(`Research failed for task ${result.id}:`, err);
      });

    return result;
  }

  /**
   * Create and run a review task for all sections
   */
  async createAllSectionsTask(task: { taskInput: string; embed?: boolean }) {
    const result = await this.prisma.reviewTask.create({
      data: {
        taskInput: task.taskInput,
        section: 'all',
      },
    });

    const embed = task.embed !== false;

    Promise.all([
      this.epidemiologyEngine.runWithSave(
        `${result.id}`,
        task.taskInput,
        this.onProgress.bind(this, `${result.id}-epidemiology`),
        embed,
      ),
      this.pathophysiologyEngine.runWithSave(
        `${result.id}`,
        task.taskInput,
        this.onProgress.bind(this, `${result.id}-pathophysiology`),
        embed,
      ),
      this.clinicalEngine.runWithSave(
        `${result.id}`,
        task.taskInput,
        this.onProgress.bind(this, `${result.id}-clinical`),
        embed,
      ),
      this.treatmentEngine.runWithSave(
        `${result.id}`,
        task.taskInput,
        this.onProgress.bind(this, `${result.id}-treatment`),
        embed,
      ),
    ]).catch((err) => {
      this.logger.error(
        `All sections research failed for task ${result.id}:`,
        err,
      );
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
