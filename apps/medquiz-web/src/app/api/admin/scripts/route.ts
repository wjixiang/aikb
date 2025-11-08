import { NextResponse } from 'next/server';
import { quizAI } from '@/lib/quiz/quizAI';

interface ScriptRequest {
  script: string;
  args: string[];
}

interface ScriptParams {
  [key: string]: string | number | undefined;
  command?: string;
  concurrency?: number;
  class?: string;
  source?: string;
  quizId?: string;
  quizIds?: string;
}

export async function POST(request: Request) {
  try {
    const { script, args } = (await request.json()) as ScriptRequest;

    // 解析参数为键值对
    const params: ScriptParams = args.reduce(
      (acc: ScriptParams, arg: string) => {
        const [key, value] = arg.replace('--', '').split('=');
        acc[key] = key === 'concurrency' ? Number(value) : value;
        return acc;
      },
      {},
    );

    // 计算并发数 - 确保括号闭合
    const concurrencyValue = Number(params.concurrency) || 100;
    const safeConcurrency = Math.max(1, concurrencyValue);

    // 直接实例化quizAI类
    const aiInstance = new quizAI(safeConcurrency);

    let result = '';

    // 根据脚本类型调用不同的类方法
    switch (script) {
      case 'batchAnnotateQuiz':
        if (params.command === 'batch') {
          // 调用批量注释方法
          await aiInstance.batchAnnotate(params.class, params.source);
          result = '批量注释完成';
        } else if (params.command === 'single' && params.quizId) {
          // 调用单题处理方法
          await aiInstance.processSpecificQuiz(params.quizId);
          result = `单题处理完成: ${params.quizId}`;
        } else if (params.command === 'list' && params.quizIds) {
          // 调用批量处理方法
          const ids = params.quizIds.split(',').map((id: string) => id.trim());
          await aiInstance.processQuizList(ids);
          result = `批量处理完成: ${ids.length} 题`;
        } else {
          throw new Error('无效的命令或参数');
        }
        break;

      default:
        throw new Error('未知的脚本');
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
