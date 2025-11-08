#!/usr/bin/env tsx

/**
 * CLI script to use RAG for adding analysis content to quiz data
 * 使用RAG对quiz数据添加解析内容的CLI脚本
 */

import { Command } from 'commander';
import dotenv from 'dotenv';
import QuizStorage from '@/lib/quiz/QuizStorage';
import rag_workflow, {
  rag_workflow_sync,
} from '@/kgrag/lib/llm_workflow/rag_workflow';
import { quiz } from '@/types/quizData.types';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/db/mongodb';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import { SupportedLLM } from '@/lib/LLM/LLMProvider';
import { language } from '@/kgrag/type';

// Load environment variables
dotenv.config();

// Configuration
const CONCURRENCY_LIMIT = 5; // 并发限制
const BATCH_SIZE = 20; // 批量处理大小
const RETRY_ATTEMPTS = 3; // 重试次数
const RETRY_DELAY = 2000; // 重试延迟(ms)

interface CLIOptions {
  class?: string;
  mode?: string;
  unit?: string;
  source?: string;
  year?: string;
  limit?: number;
  concurrency?: number;
  dryRun?: boolean;
  force?: boolean;
  language?: string;
  model?: string;
}

interface QuizAnalysisResult {
  quizId: string;
  success: boolean;
  analysis?: string;
  error?: string;
  processingTime: number;
}

class QuizRAGAnalyzer {
  private storage: QuizStorage;
  private progressBar!: cliProgress.SingleBar;
  private limit: any;
  private options: CLIOptions;

  constructor(options: CLIOptions) {
    this.storage = new QuizStorage();
    this.options = options;
    this.limit = pLimit(
      parseInt(options.concurrency?.toString() || CONCURRENCY_LIMIT.toString()),
    );
  }

  /**
   * 直接查询数据库获取ai_analysis字段为空的记录
   */
  private async fetchQuizzesWithEmptyAIAnalysis(): Promise<quiz[]> {
    const { db } = await connectToDatabase();

    // 构建查询条件
    const query: any = {
      // 筛选ai_analysis字段为空的记录
      $or: [
        { 'analysis.ai_analysis': { $exists: false } },
        { 'analysis.ai_analysis': { $eq: null } },
        { 'analysis.ai_analysis': { $eq: '' } },
        { 'analysis.ai_analysis': { $regex: /^\s*$/ } },
      ],
    };

    // 添加可选的筛选条件
    if (this.options.class) {
      query.class = this.options.class;
    }
    if (this.options.mode) {
      query.type = this.options.mode;
    }
    if (this.options.unit) {
      query.unit = this.options.unit;
    }
    if (this.options.source) {
      query.source = this.options.source;
    }
    if (this.options.year) {
      query.extractedYear = parseInt(this.options.year);
    }

    // 限制查询结果数量
    const limit = parseInt(this.options.limit?.toString() || '100');

    // 执行查询
    const quizzes = await db
      .collection<quiz>('quiz')
      .find(query)
      .limit(limit)
      .toArray();

    return quizzes;
  }

  /**
   * 格式化quiz内容为查询文本
   */
  private formatQuizForRAG(quiz: quiz): string {
    let questionText = '';
    let optionsText = '';
    let answerText = '';

    if (quiz.type === 'A3') {
      questionText =
        quiz.mainQuestion +
        '\n' +
        quiz.subQuizs.map((sq) => `${sq.subQuizId}. ${sq.question}`).join('\n');
      optionsText = JSON.stringify(quiz.subQuizs[0].options.map((e) => e.text));
      answerText = quiz.subQuizs
        .map((sq) => `${sq.subQuizId}. ${sq.answer}`)
        .join('\n');
    } else if (quiz.type === 'B') {
      questionText = quiz.questions
        .map((q) => `${q.questionId}. ${q.questionText}`)
        .join('\n');
      optionsText = JSON.stringify(quiz.options.map((e) => e.text));
      answerText = quiz.questions
        .map((q) => `${q.questionId}. ${q.answer}`)
        .join('\n');
    } else {
      questionText = quiz.question;
      optionsText = JSON.stringify(quiz.options.map((e) => e.text));
      answerText = Array.isArray(quiz.answer)
        ? quiz.answer.join(', ')
        : quiz.answer.toString();
    }

    return `请分析以下医学题目并提供详细的解析：

# 题目
${questionText}

# 选项
${optionsText}

# 答案
${answerText}

# 现有解析
${quiz.analysis.discuss || '无'}
${quiz.analysis.point || '无'}

请基于医学知识库，提供更详细、准确的解析，包括：
1. 答案解析
2. 相关知识点
3. 临床意义
4. 鉴别诊断（如适用）`;
  }

  /**
   * 使用RAG生成解析内容
   */
  private async generateAnalysisWithRAG(quiz: quiz): Promise<string> {
    const query = this.formatQuizForRAG(quiz);

    const ragConfig = {
      useHyDE: false,
      useHybrid: true,
      useReasoning: true,
      topK: 10,
      language: (this.options.language || 'zh') as language,
      llm: (this.options.model || 'GLM45Flash') as SupportedLLM,
    };

    try {
      const result = await rag_workflow_sync(query, ragConfig);

      return result.rag_res;
    } catch (error) {
      console.error(`RAG analysis failed for quiz ${quiz._id}:`, error);
      throw error;
    }
  }

  /**
   * 更新quiz的解析内容
   */
  private async updateQuizAnalysis(
    quizId: string,
    analysis: string,
  ): Promise<void> {
    const { db } = await connectToDatabase();
    const quizCollection = db.collection<quiz>('quiz');

    await quizCollection.updateOne(
      { _id: new ObjectId(quizId) as unknown as string },
      {
        $set: {
          'analysis.ai_analysis': analysis,
        },
      },
    );
  }

  /**
   * 处理单个quiz，包含重试逻辑
   */
  private async processQuizWithRetry(
    quiz: quiz,
    attempts = 0,
  ): Promise<QuizAnalysisResult> {
    const startTime = Date.now();

    try {
      if (this.options.dryRun) {
        console.log(`[DRY RUN] Processing quiz ${quiz._id}`);
        return {
          quizId: quiz._id.toString(),
          success: true,
          processingTime: Date.now() - startTime,
        };
      }

      // 检查是否已有AI解析，除非强制重新生成
      if (
        !this.options.force &&
        quiz.analysis.ai_analysis &&
        quiz.analysis.ai_analysis.trim() !== ''
      ) {
        return {
          quizId: quiz._id.toString(),
          success: true,
          analysis: quiz.analysis.ai_analysis,
          processingTime: Date.now() - startTime,
        };
      }

      // 生成RAG解析
      const analysis = await this.generateAnalysisWithRAG(quiz);

      // 更新数据库
      await this.updateQuizAnalysis(quiz._id.toString(), analysis);

      return {
        quizId: quiz._id.toString(),
        success: true,
        analysis: analysis.substring(0, 100) + '...', // 只返回前100个字符作为预览
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      if (attempts < RETRY_ATTEMPTS) {
        const delay = RETRY_DELAY * Math.pow(2, attempts);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.processQuizWithRetry(quiz, attempts + 1);
      } else {
        return {
          quizId: quiz._id.toString(),
          success: false,
          error: error instanceof Error ? error.message : String(error),
          processingTime: Date.now() - startTime,
        };
      }
    }
  }

  /**
   * 批量处理quizzes
   */
  async processQuizzes(): Promise<void> {
    console.log('开始RAG分析处理...');

    // 获取quiz数据 - 只获取没有AI分析或AI分析为空的题目
    const quizzes = await this.fetchQuizzesWithEmptyAIAnalysis();
    console.log(`找到 ${quizzes.length} 个需要处理的题目`);

    if (quizzes.length === 0) {
      console.log('没有找到匹配的题目，任务结束');
      return;
    }

    // 创建进度条
    this.progressBar = new cliProgress.SingleBar({
      format:
        '处理进度 |{bar}| {percentage}% | {value}/{total} | 成功: {success} | 失败: {failed} | 速度: {speed} 题/分钟',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    this.progressBar.start(quizzes.length, 0, {
      success: 0,
      failed: 0,
      speed: 'N/A',
    });

    let processed = 0;
    let successful = 0;
    let failed = 0;
    let startTime = Date.now();

    // 并发处理
    const promises = quizzes.map((quiz) =>
      this.limit(async () => {
        try {
          const result = await this.processQuizWithRetry(quiz);
          processed++;

          if (result.success) {
            successful++;
            console.log(`✅ Quiz ${result.quizId} 处理成功`);
          } else {
            failed++;
            console.error(`❌ Quiz ${result.quizId} 处理失败: ${result.error}`);
          }

          // 更新进度条
          const elapsedMinutes = (Date.now() - startTime) / 60000;
          const speed = processed / elapsedMinutes;

          this.progressBar.update(processed, {
            success: successful,
            failed: failed,
            speed: speed.toFixed(2),
          });
        } catch (error) {
          failed++;
          processed++;
          console.error(`❌ 处理quiz ${quiz._id} 时发生错误:`, error);
          this.progressBar.update(processed, {
            success: successful,
            failed: failed,
          });
        }
      }),
    );

    await Promise.all(promises);
    this.progressBar.stop();

    const totalTime = (Date.now() - startTime) / 60000;
    console.log(
      `\n处理完成！总计: ${processed}, 成功: ${successful}, 失败: ${failed}, 耗时: ${totalTime.toFixed(2)} 分钟`,
    );
  }
}

// CLI主函数
async function main() {
  const program = new Command();

  program
    .name('rag-quiz-analysis')
    .description('使用RAG对quiz数据添加解析内容')
    .version('1.0.0');

  program
    .option('-c, --class <className>', '题目分类，如: 内科学, 外科学等')
    .option('-m, --mode <mode>', '题目类型，如: A1, A2, A3, B, X')
    .option('-u, --unit <unit>', '题目单元')
    .option('-s, --source <source>', '题目来源')
    .option('-y, --year <year>', '年份，如: 2023')
    .option('-l, --limit <number>', '处理题目数量限制', '100')
    .option('--concurrency <number>', '并发处理数量', '5')
    .option('--dry-run', '试运行模式，不实际修改数据')
    .option('--force', '强制重新生成已有解析的内容')
    .option('--language <language>', '语言设置 (zh/en)', 'zh')
    .option(
      '--model <model>',
      '使用的LLM模型 (如: GLM45Flash, GLM4Plus, Gpt4o等)',
      'GLM45Flash',
    )
    .action(async (options: CLIOptions) => {
      try {
        console.log('🚀 开始RAG Quiz分析任务');
        console.log('参数:', JSON.stringify(options, null, 2));

        const analyzer = new QuizRAGAnalyzer(options);
        await analyzer.processQuizzes();

        console.log('✅ 任务完成');
      } catch (error) {
        console.error('❌ 任务执行失败:', error);
        process.exit(1);
      }
    });

  await program.parseAsync();
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}
