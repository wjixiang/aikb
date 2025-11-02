import { QuizParser } from './QuizParser';
import { ExamPaperService } from './services/ExamPaperService';
import { QuizProcessingService } from './services/QuizProcessingService';
import * as readline from 'readline';
import * as fs from 'fs';
import * as toml from 'toml';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { quesiton } from './varible';
import { answer } from './varible_answer';

// Configuration interface
interface QuizConfig {
  source: string;
  tags: string[];
  extractedYear: string;
  withExp: boolean
}

interface ExamPaperConfig {
  name: string;
  subject: string;
  year: string;
}

interface ProcessingConfig {
  default_chunks: number;
  retry_failed: boolean;
  check_failed: boolean;
}

interface ConcurrencyConfig {
  quiz_parser_limit: number;
  batch_processing_limit: number;
  batch_delay_ms: number;
  retry_concurrency_limit: number;
  max_retries: number;
  retry_base_delay_ms: number;
}

interface Config {
  quiz: QuizConfig;
  exam_paper: ExamPaperConfig;
  processing: ProcessingConfig;
  concurrency: ConcurrencyConfig;
}

// Load configuration from TOML file
function loadConfig(configPath: string = 'config.toml'): Config {
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return toml.parse(configContent) as Config;
  } catch (error) {
    console.error(`Error loading config from ${configPath}:`, error);
    process.exit(1);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Initialize yargs
const argv = yargs(hideBin(process.argv))
  .option('chunks', {
    alias: 'c',
    type: 'number',
    description: 'Split the input into specified number of chunks for processing',
    default: 1
  })
  .option('retry-failed', {
    type: 'boolean',
    description: 'Retry sending failed quizzes from local storage',
    default: false
  })
  .option('check-failed', {
    type: 'boolean',
    description: 'Check how many failed quizzes are stored locally',
    default: false
  })
  .option('config', {
    alias: 'f',
    type: 'string',
    description: 'Path to the TOML configuration file',
    default: 'config.toml'
  })
  .option('source', {
    type: 'string',
    description: 'Source name for the quiz',
  })
  .option('tags', {
    type: 'string',
    description: 'Comma-separated tags for the quiz',
  })
  .option('year', {
    type: 'string',
    description: 'Extracted year for the quiz',
  })
  .option('subject', {
    type: 'string',
    description: 'Subject for the exam paper',
  })
  .option('withExp', {
    type: 'boolean',
    description: 'Include explanations in the quiz',
    default: false
  })
  .help('help')
  .alias('help', 'h')
  .example([
    ['$0', 'Run without chunking'],
    ['$0 --chunks 3', 'Split into 3 chunks'],
    ['$0 --retry-failed', 'Retry failed quizzes'],
    ['$0 --check-failed', 'Check failed quizzes count'],
    ['$0 --config custom.toml', 'Use custom configuration file'],
  ])
  .parseSync();

async function runTest() {
  // Load configuration
  const config = loadConfig(argv.config);
  
  // Override config with command line arguments if provided
  const quizConfig: QuizConfig = {
    source: argv.source || config.quiz.source,
    tags: argv.tags ? argv.tags.split(',').map((tag: string) => tag.trim()) : config.quiz.tags,
    extractedYear: argv.year || config.quiz.extractedYear,
    withExp: argv.withExp || config.quiz.withExp
  };
  
  const examPaperConfig: ExamPaperConfig = {
    name: argv.source || config.exam_paper.name,
    subject: argv.subject || config.exam_paper.subject,
    year: argv.year || config.exam_paper.year
  };
  
  if (argv['check-failed']) {
    checkFailedQuizzes();
    rl.close();
    return;
  }
  
  if (argv['retry-failed']) {
    await retryFailedQuizzes(config.concurrency);
    rl.close();
    return;
  }
  
  // 使用配置文件中的default_chunks，如果命令行没有指定chunks参数
  const chunks = argv.chunks !== 1 ? argv.chunks : config.processing.default_chunks;
  
  console.log(`Running QuizParser CLI test...`);
  console.log(`Using configuration from: ${argv.config}`);
  console.log(`Processing with ${chunks} chunk${chunks > 1 ? 's' : ''}`);
  
  try {
    await runWithServiceLayer(quizConfig, examPaperConfig, config.concurrency, chunks);
  } catch (error) {
    console.error('Error running quiz parser:', error);
  } finally {
    rl.close();
  }
}

/**
 * 使用新的服务层运行
 */
async function runWithServiceLayer(quizConfig: QuizConfig, examPaperConfig: ExamPaperConfig, concurrencyConfig: ConcurrencyConfig, chunkNum: number = 1) {
  // 创建服务实例
  const examPaperService = new ExamPaperService();
  const processingService = new QuizProcessingService();
  
  // 创建试卷
  console.log('Creating exam paper...');
  const examPaper = await examPaperService.createExamPaperFromText(
    examPaperConfig.name,
    quesiton,
    answer,
    examPaperConfig.name,
    {
      year: examPaperConfig.year,
      tags: quizConfig.tags,
      subject: examPaperConfig.subject
    }
  );
  
  console.log(`Created exam paper with ID: ${examPaper.id}`);
  
  // 处理试卷
  console.log('Processing exam paper...');
  const processResult = await examPaperService.processExamPaper(examPaper.id, {
    ...quizConfig,
    concurrencyLimit: concurrencyConfig.quiz_parser_limit
  }, chunkNum);
  
  console.log(`Processed ${processResult.quizzes.length} quizzes`);
  
  if (processResult.errors && processResult.errors.length > 0) {
    console.log('Processing errors:');
    processResult.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  // 发送到服务器
  console.log('Sending quiz elements to server...');
  const sendResult = await processingService.processAndSendQuizzes(
    processResult.quizzes,
    {
      concurrency: concurrencyConfig.batch_processing_limit,
      maxRetries: concurrencyConfig.max_retries,
      baseDelay: concurrencyConfig.retry_base_delay_ms,
      onProgress: (processed, total, current) => {
        console.log(`Progress: ${processed}/${total} (${current.successCount} successful, ${current.failureCount} failed)`);
      }
    }
  );
  
  console.log(`Processing complete: ${sendResult.successCount} successful, ${sendResult.failureCount} failed`);
}

/**
 * 使用传统模式运行
 */
async function runLegacyMode(quizConfig: QuizConfig, chunkNum: number, concurrencyConfig: ConcurrencyConfig) {
  const parser = new QuizParser(quesiton, answer, concurrencyConfig.quiz_parser_limit);
  
  let result;
  
  if (chunkNum > 1) {
    console.log(`Splitting input into ${chunkNum} chunks...`);
    const chunks = await parser.chunkInput(chunkNum);
    console.log(`Successfully created ${chunks.length} chunks.`);
    
    result = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
      try {
        const chunkResult = await chunks[i].parse(quizConfig, quizConfig.withExp);
        
        result.push(...chunkResult);
        console.log(`Chunk ${i + 1} processed: ${chunkResult.length} quizzes`);
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error);
      }
    }
  } else {
    console.log('Processing without chunking...');
    result = await parser.parse(quizConfig, quizConfig.withExp);
  }
  
  console.log(`Total quizzes parsed: ${result.length}`);
  
  // 使用处理服务发送数据
  const processingService = new QuizProcessingService();
  const sendResult = await processingService.processAndSendQuizzes(result, {
    concurrency: concurrencyConfig.batch_processing_limit,
    maxRetries: concurrencyConfig.max_retries,
    baseDelay: concurrencyConfig.retry_base_delay_ms
  });
  
  console.log(`Processing complete: ${sendResult.successCount} successful, ${sendResult.failureCount} failed`);
}

async function retryFailedQuizzes(concurrencyConfig?: ConcurrencyConfig) {
  console.log('Retrying failed quizzes...');
  
  try {
    const processingService = new QuizProcessingService();
    const successCount = await processingService.retryFailedQuizzes(
      concurrencyConfig?.max_retries ?? 3,
      concurrencyConfig?.retry_base_delay_ms ?? 1000,
      concurrencyConfig?.retry_concurrency_limit ?? 3
    );
    console.log(`Successfully retried ${successCount} quizzes.`);
  } catch (error) {
    console.error('Error retrying failed quizzes:', error);
  }
}

function checkFailedQuizzes() {
  const processingService = new QuizProcessingService();
  const count = processingService.getFailedQuizzesCount();
  if (count === 0) {
    console.log('No failed quizzes found.');
  } else {
    console.log(`Found ${count} failed quizzes. Run with --retry-failed to retry them.`);
  }
}

runTest();