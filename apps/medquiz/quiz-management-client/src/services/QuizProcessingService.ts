import { QuizWithoutId } from '../types/examPaper.types';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * 试卷处理结果
 */
export interface ProcessingResult {
  successCount: number;
  failureCount: number;
  errors: string[];
  processedAt: Date;
}

/**
 * 试卷数据处理服务
 * 负责将解析后的 quiz 数据发送到服务器，并处理失败重试逻辑
 */
export class QuizProcessingService {
  private readonly FAILED_QUIZZES_FILE = path.join(
    process.cwd(),
    'failed_quizzes.json',
  );

  /**
   * 处理单个 quiz 数据
   * @param quizData 要处理的 quiz 数据
   * @param maxRetries 最大重试次数
   * @param baseDelay 基础延迟时间（毫秒）
   * @returns Promise<ProcessingResult> 处理结果
   */
  async processSingleQuiz(
    quizData: QuizWithoutId,
    maxRetries: number = 3,
    baseDelay: number = 1000,
  ): Promise<ProcessingResult> {
    const errors: string[] = [];

    try {
      await this.sendQuizToServer(quizData, maxRetries, baseDelay);
      return {
        successCount: 1,
        failureCount: 0,
        errors: [],
        processedAt: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      return {
        successCount: 0,
        failureCount: 1,
        errors,
        processedAt: new Date(),
      };
    }
  }

  /**
   * 批量处理 quiz 数据
   * @param quizzes 要处理的 quiz 数据数组
   * @param maxRetries 最大重试次数
   * @param baseDelay 基础延迟时间（毫秒）
   * @param concurrency 并发处理数量
   * @returns Promise<ProcessingResult> 处理结果
   */
  async processBatchQuizzes(
    quizzes: QuizWithoutId[],
    maxRetries: number = 3,
    baseDelay: number = 1000,
    concurrency: number = 5,
  ): Promise<ProcessingResult> {
    const startTime = new Date();
    const errors: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    // 分批处理以控制并发
    for (let i = 0; i < quizzes.length; i += concurrency) {
      const batch = quizzes.slice(i, i + concurrency);

      const batchResults = await Promise.allSettled(
        batch.map((quiz) =>
          this.processSingleQuiz(quiz, maxRetries, baseDelay),
        ),
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount += result.value.successCount;
          failureCount += result.value.failureCount;
          errors.push(...result.value.errors);
        } else {
          failureCount++;
          const errorMessage =
            result.reason instanceof Error
              ? result.reason.message
              : 'Unknown error';
          errors.push(`Quiz ${i + index + 1}: ${errorMessage}`);
        }
      });

      // 在批次之间添加小延迟以避免过载
      if (i + concurrency < quizzes.length) {
        await this.sleep(500); // 默认延迟，可以通过配置覆盖
      }
    }

    return {
      successCount,
      failureCount,
      errors,
      processedAt: startTime,
    };
  }

  /**
   * 重试所有失败的 quiz
   * @param maxRetries 最大重试次数
   * @param baseDelay 基础延迟时间（毫秒）
   * @returns Promise<number> 成功重试的数量
   */
  async retryFailedQuizzes(
    maxRetries: number = 3,
    baseDelay: number = 1000,
    retryConcurrency: number = 3,
  ): Promise<number> {
    try {
      const failedQuizzes = this.loadFailedQuizzes();
      if (failedQuizzes.length === 0) {
        console.log('No failed quizzes found to retry.');
        return 0;
      }

      console.log(`Retrying ${failedQuizzes.length} failed quizzes...`);

      const result = await this.processBatchQuizzes(
        failedQuizzes.map((fq) => fq.quiz),
        maxRetries,
        baseDelay,
        retryConcurrency, // 使用配置的重试并发数
      );

      // 清空失败列表（无论成功与否）
      this.clearFailedQuizzes();

      console.log(
        `Retry complete: ${result.successCount} successful, ${result.failureCount} failed`,
      );

      if (result.errors.length > 0) {
        console.log('Errors during retry:');
        result.errors.forEach((error) => console.log(`  - ${error}`));
      }

      return result.successCount;
    } catch (error) {
      console.error('Error during quiz retry:', error);
      return 0;
    }
  }

  /**
   * 获取失败 quiz 的数量
   * @returns number 失败 quiz 的数量
   */
  getFailedQuizzesCount(): number {
    try {
      const failedQuizzes = this.loadFailedQuizzes();
      return failedQuizzes.length;
    } catch (error) {
      console.error('Error checking failed quizzes count:', error);
      return 0;
    }
  }

  /**
   * 加载失败的 quiz 数据
   * @returns Array<{quiz: QuizWithoutId, error: string, timestamp: string}> 失败的 quiz 数组
   */
  private loadFailedQuizzes(): Array<{
    quiz: QuizWithoutId;
    error: string;
    timestamp: string;
  }> {
    try {
      if (!fs.existsSync(this.FAILED_QUIZZES_FILE)) {
        return [];
      }
      const data = fs.readFileSync(this.FAILED_QUIZZES_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading failed quizzes:', error);
      return [];
    }
  }

  /**
   * 清空失败 quiz 列表
   */
  private clearFailedQuizzes(): void {
    try {
      if (fs.existsSync(this.FAILED_QUIZZES_FILE)) {
        fs.unlinkSync(this.FAILED_QUIZZES_FILE);
      }
    } catch (error) {
      console.error('Error clearing failed quizzes file:', error);
    }
  }

  /**
   * 保存失败的 quiz 到本地文件
   * @param quizData 失败的 quiz 数据
   * @param errorMessage 错误信息
   */
  private async saveFailedQuiz(
    quizData: QuizWithoutId,
    errorMessage: string,
  ): Promise<void> {
    try {
      let failedQuizzes: Array<{
        quiz: QuizWithoutId;
        error: string;
        timestamp: string;
      }> = [];

      // 加载现有的失败 quiz
      if (fs.existsSync(this.FAILED_QUIZZES_FILE)) {
        const data = fs.readFileSync(this.FAILED_QUIZZES_FILE, 'utf8');
        failedQuizzes = JSON.parse(data);
      }

      // 添加新的失败 quiz
      failedQuizzes.push({
        quiz: quizData,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      // 保存到文件
      fs.writeFileSync(
        this.FAILED_QUIZZES_FILE,
        JSON.stringify(failedQuizzes, null, 2),
      );
      console.log(`Saved failed quiz to ${this.FAILED_QUIZZES_FILE}`);
    } catch (error) {
      console.error('Failed to save quiz to local storage:', error);
    }
  }

  /**
   * Send quiz data to the server with retry mechanism
   * @param quizData The quiz data to send
   * @param maxRetries Maximum number of retry attempts (default: 3)
   * @param baseDelay Base delay in milliseconds for exponential backoff (default: 1000)
   * @returns Promise with the server response
   * @throws Error if all retry attempts fail
   */
  private async sendQuizToServer(
    quizData: QuizWithoutId,
    maxRetries: number = 3,
    baseDelay: number = 1000,
  ): Promise<any> {
    const apiUrl = process.env['QUIZ_SERVICE_ENDPOINT'] || 'http://localhost:3000';
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${apiUrl}/api/addQuiz`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(quizData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.log(`failed quiz: ${JSON.stringify(quizData)}`);
          throw new Error(errorData.message || 'Failed to add quiz');
        }
        const data = await response.json();
        console.log(`send quiz success: ${JSON.stringify(data)}`);

        // Success - return the response
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `Attempt ${attempt + 1}/${maxRetries + 1} failed:`,
          lastError.message,
        );

        // If this is the last attempt, don't wait anymore
        if (attempt === maxRetries) {
          break;
        }

        // Calculate exponential backoff delay with jitter
        const jitter = Math.random() * 0.1; // Add 0-10% jitter
        const delay = baseDelay * Math.pow(2, attempt) * (1 + jitter);

        console.log(`Retrying in ${Math.round(delay)}ms...`);
        await this.sleep(delay);
      }
    }

    // All attempts failed - save to local storage
    console.error(
      `Failed to send quiz after ${maxRetries + 1} attempts. Saving to local storage.`,
    );
    await this.saveFailedQuiz(quizData, lastError?.message || 'Unknown error');

    throw (
      lastError ||
      new Error('Failed to send quiz to server after multiple attempts')
    );
  }

  /**
   * 延迟函数
   * @param ms 延迟毫秒数
   * @returns Promise<void>
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 处理试卷数据并发送到服务器
   * @param quizzes 要处理的 quiz 数据数组
   * @param options 处理选项
   * @returns Promise<ProcessingResult> 处理结果
   */
  async processAndSendQuizzes(
    quizzes: QuizWithoutId[],
    options: {
      maxRetries?: number;
      baseDelay?: number;
      concurrency?: number;
      onProgress?: (
        processed: number,
        total: number,
        current: ProcessingResult,
      ) => void;
    } = {},
  ): Promise<ProcessingResult> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      concurrency = 5,
      onProgress,
    } = options;

    const startTime = new Date();
    const errors: string[] = [];
    let totalSuccessCount = 0;
    let totalFailureCount = 0;

    console.log(
      `Starting to process ${quizzes.length} quizzes with concurrency ${concurrency}...`,
    );

    // 分批处理
    for (let i = 0; i < quizzes.length; i += concurrency) {
      const batch = quizzes.slice(i, i + concurrency);
      console.log(
        `Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(quizzes.length / concurrency)} (${batch.length} quizzes)...`,
      );

      const batchResult = await this.processBatchQuizzes(
        batch,
        maxRetries,
        baseDelay,
        concurrency,
      );

      totalSuccessCount += batchResult.successCount;
      totalFailureCount += batchResult.failureCount;
      errors.push(...batchResult.errors);

      // 调用进度回调
      if (onProgress) {
        const processed = Math.min(i + concurrency, quizzes.length);
        onProgress(processed, quizzes.length, {
          successCount: totalSuccessCount,
          failureCount: totalFailureCount,
          errors: [],
          processedAt: new Date(),
        });
      }

      // 显示批次结果
      console.log(
        `Batch complete: ${batchResult.successCount} successful, ${batchResult.failureCount} failed`,
      );
    }

    const finalResult: ProcessingResult = {
      successCount: totalSuccessCount,
      failureCount: totalFailureCount,
      errors,
      processedAt: startTime,
    };

    console.log(
      `Processing complete: ${totalSuccessCount} successful, ${totalFailureCount} failed`,
    );

    if (totalFailureCount > 0) {
      console.log(
        `Run with --retry-failed to retry the ${totalFailureCount} failed quizzes.`,
      );
    }

    return finalResult;
  }
}
