import { quiz } from "./quizData.types";

export type QuizWithoutId = Omit<quiz, '_id'>;

/**
 * 原始试卷数据结构
 */
export interface ExamPaper {
  id: string;
  title: string;
  source: string;
  year?: string;
  subject?: string;
  tags: string[];
  questionsText: string;
  answersText: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 试卷处理配置
 */
export interface ExamPaperConfig {
  source: string;
  tags: string[];
  class?: string;
  unit?: string;
  extractedYear?: string;
  withExp?: boolean;
  concurrencyLimit?: number;
  analysis?: {
    point?: string | null;
    discuss?: string | null;
    ai_analysis?: string;
    link?: string[];
  };
}

/**
 * 试卷处理结果
 */
export interface ExamPaperProcessResult {
  examPaperId: string;
  quizzes: QuizWithoutId[];
  successCount: number;
  failureCount: number;
  processedAt: Date;
  errors?: string[];
}

/**
 * 试卷存储接口
 */
export interface IExamPaperStorage {
  save(examPaper: ExamPaper): Promise<ExamPaper>;
  findById(id: string): Promise<ExamPaper | null>;
  findAll(): Promise<ExamPaper[]>;
  update(id: string, updates: Partial<ExamPaper>): Promise<ExamPaper>;
  delete(id: string): Promise<boolean>;
}

/**
 * 试卷服务接口
 */
export interface IExamPaperService {
  loadExamPaper(id: string): Promise<ExamPaper | null>;
  createExamPaper(data: Omit<ExamPaper, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExamPaper>;
  processExamPaper(id: string, config?: Partial<ExamPaperConfig>, chunkNum?: number): Promise<ExamPaperProcessResult>;
  listExamPapers(): Promise<ExamPaper[]>;
  updateExamPaper(id: string, updates: Partial<ExamPaper>): Promise<ExamPaper>;
  deleteExamPaper(id: string): Promise<boolean>;
}