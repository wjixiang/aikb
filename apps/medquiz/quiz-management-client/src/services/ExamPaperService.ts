import { v4 as uuidv4 } from 'uuid';
import {
  ExamPaper,
  ExamPaperConfig,
  ExamPaperProcessResult,
  IExamPaperService,
  IExamPaperStorage,
  QuizWithoutId,
} from '../types/examPaper.types';
import { QuizParser } from '../QuizParser';
import { quiz, analysis } from '../types/quizData.types';

/**
 * 试卷管理服务实现
 */
export class ExamPaperService implements IExamPaperService {
  private storage: IExamPaperStorage;

  constructor(storage?: IExamPaperStorage) {
    this.storage = storage || this.createDefaultStorage();
  }

  /**
   * 创建默认存储实现
   */
  private createDefaultStorage(): IExamPaperStorage {
    // 动态导入以避免循环依赖
    const { FileExamPaperStorage } = require('./ExamPaperStorage');
    return new FileExamPaperStorage();
  }

  /**
   * 加载试卷
   */
  async loadExamPaper(id: string): Promise<ExamPaper | null> {
    return this.storage.findById(id);
  }

  /**
   * 创建新试卷
   */
  async createExamPaper(
    data: Omit<ExamPaper, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ExamPaper> {
    const examPaper: ExamPaper = {
      ...data,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.storage.save(examPaper);
  }

  /**
   * 处理试卷，解析为结构化题目
   */
  async processExamPaper(
    id: string,
    config?: Partial<ExamPaperConfig>,
    chunkNum: number = 1,
  ): Promise<ExamPaperProcessResult> {
    const examPaper = await this.loadExamPaper(id);
    if (!examPaper) {
      throw new Error(`Exam paper with id ${id} not found`);
    }

    const startTime = new Date();
    const errors: string[] = [];
    let successCount = 0;
    let failureCount = 0;
    let quizzes: QuizWithoutId[] = [];

    try {
      // 创建QuizParser实例，使用配置中的并发限制
      const parser = new QuizParser(
        examPaper.questionsText,
        examPaper.answersText,
        config?.concurrencyLimit,
      );

      // 合并配置
      const analysisObj: analysis | undefined = config?.analysis
        ? {
            point: config.analysis.point ?? null,
            discuss: config.analysis.discuss ?? null,
            ai_analysis: config.analysis.ai_analysis,
            link: config.analysis.link ?? [],
          }
        : undefined;

      const finalConfig: Partial<quiz> = {
        source: config?.source || examPaper.source,
        tags: config?.tags || examPaper.tags,
        class: config?.class,
        unit: config?.unit,
        analysis: analysisObj,
      };

      // 解析试卷
      if (chunkNum > 1) {
        console.log(`Splitting input into ${chunkNum} chunks...`);
        const chunks = await parser.chunkInput(chunkNum);
        console.log(`Successfully created ${chunks.length} chunks.`);

        quizzes = [];
        for (let i = 0; i < chunks.length; i++) {
          console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
          try {
            const chunkResult = await chunks[i].parse(
              finalConfig,
              config?.withExp ?? false,
            );

            quizzes.push(...chunkResult);
            console.log(
              `Chunk ${i + 1} processed: ${chunkResult.length} quizzes`,
            );
          } catch (error) {
            console.error(`Error processing chunk ${i + 1}:`, error);
            errors.push(
              `Error processing chunk ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            failureCount++;
          }
        }
      } else {
        console.log('Processing without chunking...');
        quizzes = await parser.parse(finalConfig, config?.withExp ?? false);
      }

      successCount = quizzes.length;

      console.log(
        `Successfully processed ${successCount} quizzes from exam paper ${id}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      failureCount = 1;
      console.error(`Failed to process exam paper ${id}:`, errorMessage);
    }

    const result: ExamPaperProcessResult = {
      examPaperId: id,
      quizzes: quizzes,
      successCount,
      failureCount,
      processedAt: startTime,
      errors: errors.length > 0 ? errors : undefined,
    };

    return result;
  }

  /**
   * 列出所有试卷
   */
  async listExamPapers(): Promise<ExamPaper[]> {
    return this.storage.findAll();
  }

  /**
   * 更新试卷
   */
  async updateExamPaper(
    id: string,
    updates: Partial<ExamPaper>,
  ): Promise<ExamPaper> {
    return this.storage.update(id, updates);
  }

  /**
   * 删除试卷
   */
  async deleteExamPaper(id: string): Promise<boolean> {
    return this.storage.delete(id);
  }

  /**
   * 从现有的问题和答案文本创建试卷
   */
  async createExamPaperFromText(
    title: string,
    questionsText: string,
    answersText: string,
    source: string,
    options: {
      year?: string;
      subject?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    } = {},
  ): Promise<ExamPaper> {
    return this.createExamPaper({
      title,
      source,
      year: options.year,
      subject: options.subject,
      tags: options.tags || [],
      questionsText,
      answersText,
      metadata: options.metadata,
    });
  }

  /**
   * 批量处理试卷
   */
  async batchProcessExamPapers(
    ids: string[],
    config?: Partial<ExamPaperConfig>,
  ): Promise<ExamPaperProcessResult[]> {
    const results: ExamPaperProcessResult[] = [];

    for (const id of ids) {
      try {
        const result = await this.processExamPaper(id, config);
        results.push(result);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.push({
          examPaperId: id,
          quizzes: [],
          successCount: 0,
          failureCount: 1,
          processedAt: new Date(),
          errors: [errorMessage],
        });
      }
    }

    return results;
  }

  /**
   * 搜索试卷
   */
  async searchExamPapers(query: {
    title?: string;
    source?: string;
    subject?: string;
    year?: string;
    tags?: string[];
  }): Promise<ExamPaper[]> {
    const allPapers = await this.listExamPapers();

    return allPapers.filter((paper) => {
      if (
        query.title &&
        !paper.title.toLowerCase().includes(query.title.toLowerCase())
      ) {
        return false;
      }
      if (
        query.source &&
        !paper.source.toLowerCase().includes(query.source.toLowerCase())
      ) {
        return false;
      }
      if (query.subject && paper.subject !== query.subject) {
        return false;
      }
      if (query.year && paper.year !== query.year) {
        return false;
      }
      if (query.tags && query.tags.length > 0) {
        const hasAllTags = query.tags.every((tag) => paper.tags.includes(tag));
        if (!hasAllTags) return false;
      }
      return true;
    });
  }
}
