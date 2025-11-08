import { quiz } from '@/types/quizData.types';
import ChainManager from '../langchain/chainManager';
import pLimit from 'p-limit';
import { ObjectId } from 'mongodb';
import cliProgress from 'cli-progress';
import { QuizAnalysisChain } from '../langchain/chains/quizAnalysis.chain';
import { Document } from '@langchain/core/documents';
import { connectToDatabase } from '../db/mongodb';
import { ChatMessage } from '@/lib/agents/agent.types';

// 可配置的并发数
const CONCURRENCY = 100; // 调整为适合你系统的并发数
const BATCH_SIZE = 20; // 批量获取文档的大小
const RETRY_ATTEMPTS = 3; // 失败重试次数
const RETRY_DELAY = 2000; // 重试延迟(ms)

/**
 *
 */
export class quizAI extends ChainManager {
  private progressBar: any;
  private limit: any;

  private quizAnalysisChain: QuizAnalysisChain;

  constructor(concurrency = CONCURRENCY) {
    super();
    this.limit = pLimit(concurrency);
    this.quizAnalysisChain = new QuizAnalysisChain({});
    console.log(`初始化 quizAI，并发数: ${concurrency}`);
  }

  /**
   * 目前先测试内科学的A2型题的自动链接
   * @returns
   */
  async getQuizes() {
    const { db, client } = await connectToDatabase();
    const quizCollection = db.collection<quiz>('quiz');
    const quizes = quizCollection.find({ class: '内科学' }).batchSize(1000);
    return quizes;
  }

  /**
   * 遍历整个集合，支持并发限制，同时打印处理进度
   * 将跳过link不为空的document
   */
  async batchAnnotate(classFilter?: string, sourceFilter?: string) {
    console.log('开始批量注释处理...');

    // 建立数据库连接并获取集合对象
    const { db } = await connectToDatabase();
    const quizCollection = db.collection<quiz>('quiz');

    // 构建查询条件
    // 构建查询条件，不再检查 analysis.link
    const query: any = {};
    if (classFilter) query.class = classFilter;
    if (sourceFilter) query.source = sourceFilter;

    // 获取总文档数量，以便后续显示进度
    const total = await quizCollection.countDocuments(query);

    console.log(`找到 ${total} 个需要处理的文档`);

    if (total === 0) {
      console.log('没有需要处理的文档，任务结束');
      return;
    }

    // 创建进度条
    this.progressBar = new cliProgress.SingleBar({
      format:
        '处理进度 |{bar}| {percentage}% | {value}/{total} | 速度: {speed} 题/分钟 | ETA: {eta_formatted} | 错误: {errors}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    this.progressBar.start(total, 0, {
      speed: 'N/A',
      errors: 0,
    });

    let processed = 0;
    let errors = 0;
    let startTime = Date.now();

    // 使用批量处理方式，避免一次性加载所有文档到内存
    let skip = 0;
    let hasMore = true;

    const processedIds = new Set(); // 跟踪已处理的ID，避免重复处理

    while (hasMore) {
      // 批量获取文档
      const batch = await quizCollection
        .find(query)
        .skip(skip)
        .limit(BATCH_SIZE)
        .toArray();

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      skip += batch.length;

      // 并发处理每个批次中的文档
      const batchPromises = batch.map((quiz) => {
        // 检查是否已处理过
        if (processedIds.has(quiz._id.toString())) {
          return Promise.resolve();
        }

        processedIds.add(quiz._id.toString());

        return this.limit(async () => {
          const startItemTime = Date.now();

          try {
            await this.processQuizWithRetry(quiz);

            // 更新进度
            processed++;
            const elapsedMinutes = (Date.now() - startTime) / 60000;
            const speed = processed / elapsedMinutes;

            this.progressBar.update(processed, {
              speed: speed.toFixed(2),
              errors,
            });
          } catch (error) {
            errors++;
            console.error(
              `\n处理 quiz ${quiz._id} 失败，已达到最大重试次数:`,
              error,
            );
            this.progressBar.update(processed, { errors });
          }

          // 添加随机延迟，避免请求过于集中
          const randomDelay = Math.floor(Math.random() * 500);
          await new Promise((resolve) => setTimeout(resolve, randomDelay));
        });
      });

      // 等待当前批次完成
      await Promise.all(batchPromises);
    }

    this.progressBar.stop();

    const totalTime = (Date.now() - startTime) / 60000;
    console.log(
      `\n批量注释完成。总共处理: ${processed}，错误: ${errors}，耗时: ${totalTime.toFixed(2)} 分钟`,
    );
  }

  /**
   * 处理单个题目，包含重试逻辑
   */
  async processQuizWithRetry(quiz: quiz, attempts = 0): Promise<void> {
    try {
      await this.annotateAndUpdate(quiz);
    } catch (error) {
      if (attempts < RETRY_ATTEMPTS) {
        // 指数退避重试
        const delay = RETRY_DELAY * Math.pow(2, attempts);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.processQuizWithRetry(quiz, attempts + 1);
      } else {
        throw error; // 达到最大重试次数，抛出错误
      }
    }
  }

  async annotateAndUpdate(quiz: quiz) {
    const annotated = await this.annotate(quiz);

    // 调用 updateQuizLinkAndDiscuss 将 AI 分析结果及相关链接保存到数据库中
    await this.updateQuizLinkAndDiscuss(
      quiz._id.toString(),
      annotated.ai_analysis,
      annotated.source,
    );
  }

  async annotate(quiz: quiz) {
    const query = this.formMessage(quiz);

    try {
      const { documents, summary } = await this.quizAnalysisChain.call({
        query,
      });

      const sources = documents.map((doc: Document<Record<string, any>>) => ({
        filename: doc.metadata?.fileName || '',
        oid: doc.metadata?.oid || '',
      }));

      // 只在调试模式下打印详细信息
      if (process.env.DEBUG === 'true') {
        let questionText = '';
        if (quiz.type === 'A3') {
          questionText = quiz.mainQuestion;
        } else if (quiz.type === 'B') {
          questionText = quiz.questions.map((q) => q.questionText).join('\n');
        } else {
          questionText = quiz.question;
        }
        console.log(`题目: ${questionText.substring(0, 50)}...`);
        console.log(`来源: ${JSON.stringify(sources)}`);
      }

      const source = documents.map(
        (doc: Document<Record<string, any>>) => doc.metadata?.oid || '',
      );

      return {
        quiz: quiz,
        ai_analysis: summary,
        source: source,
      };
    } catch (error) {
      console.error('Error analyzing quiz:', error);
      throw error;
    }
  }

  formMessage(quiz: quiz) {
    const quizTypeStr = quiz.type === 'X' ? '多选题' : '单选题';

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
      answerText = quiz.answer.toString();
    }

    return `这是一道 ${quizTypeStr}, 仔细分析题目，参考给出的解析，严格根据笔记内容给你你的解析 \n\n
            # 试题\n
            ${questionText}\n
            ${optionsText}\n
            # 答案\n
            ${answerText}
            # 参考解析
            ${quiz.analysis.discuss || '无'}\n
            ${quiz.analysis.point || '无'}`;
  }

  /**
   * 更新题目的AI分析和链接
   * @param id mongoDB ID of quiz
   * @param ai_analysis
   * @param source
   */
  async updateQuizLinkAndDiscuss(
    id: string,
    ai_analysis: string,
    source: string[],
  ) {
    try {
      const { db } = await connectToDatabase();
      const quizCollection = db.collection<quiz>('quiz');

      // 直接更新数据库
      await quizCollection.updateOne(
        { _id: new ObjectId(id) as unknown as string },
        {
          $set: {
            'analysis.ai_analysis': ai_analysis,
          },
        },
      );
    } catch (error) {
      console.error(`更新题目 ${id} 失败:`, error);
      throw error;
    }
  }

  /**
   * 手动处理特定ID的题目
   */
  async processSpecificQuiz(quizId: string) {
    const { db } = await connectToDatabase();
    const quizCollection = db.collection<quiz>('quiz');

    const quiz = await quizCollection.findOne({
      _id: new ObjectId(quizId) as any,
    });

    if (!quiz) {
      console.error(`未找到ID为 ${quizId} 的题目`);
      return;
    }

    console.log(`开始处理题目: ${quizId}`);
    await this.annotateAndUpdate(quiz);
    console.log(`题目 ${quizId} 处理完成`);
  }

  /**
   * 批量处理指定ID列表的题目
   */
  async processQuizList(quizIds: string[]) {
    console.log(`开始处理 ${quizIds.length} 个指定题目...`);

    const { db } = await connectToDatabase();
    const quizCollection = db.collection<quiz>('quiz');

    // 创建进度条
    const progressBar = new cliProgress.SingleBar({
      format: '处理进度 |{bar}| {percentage}% | {value}/{total}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });

    progressBar.start(quizIds.length, 0);

    let processed = 0;
    let errors = 0;

    // 并发处理每个ID
    await Promise.all(
      quizIds.map((id) =>
        this.limit(async () => {
          try {
            const quiz = await quizCollection.findOne({
              _id: new ObjectId(id) as any,
            });

            if (!quiz) {
              throw new Error(`未找到ID为 ${id} 的题目`);
            }

            await this.annotateAndUpdate(quiz);
            processed++;
          } catch (error) {
            errors++;
            console.error(`\n处理题目 ${id} 失败:`, error);
          } finally {
            progressBar.update(processed + errors);
          }
        }),
      ),
    );

    progressBar.stop();
    console.log(`处理完成。成功: ${processed}, 失败: ${errors}`);
  }

  /**
   * Generate quizzes based on input content
   * @param content refering content for LLM to generate quiz
   */
  async generate_quiz(content: string) {}
}
