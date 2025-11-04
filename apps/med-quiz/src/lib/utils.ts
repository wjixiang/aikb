import { quiz } from '@/types/quizData.types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AgentStep } from './agents/agent.types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formQuizContent(
  quiz: quiz,
  withAnswer: boolean = false,
  withAnalysis: boolean = false,
) {
  let content = '';
  let answerContent = '';

  switch (quiz.type) {
    case 'A3':
      content = '【共用题干题】\n\n';
      content += quiz.mainQuestion ?? '';
      if (quiz.subQuizs) {
        content += quiz.subQuizs
          .map((q, i) => {
            answerContent += `\n${i + 1}. ${q.answer ?? ''}`;
            return (
              `\n\n${i + 1}. ${q.question ?? ''}\n` +
              (q.options
                ?.map(
                  (opt, j) =>
                    `${String.fromCharCode(65 + j)}. ${opt.text ?? ''}`,
                )
                .join('\n') ?? '')
            );
          })
          .join('\n');
      }
      break;

    case 'B':
      content = '【共用选项题】\n\n';
      content +=
        quiz.questions
          ?.map((q, i) => {
            answerContent += `\n${q.questionId + 1}. ${q.answer ?? ''}`;
            return `${i + 1}.` + q.questionText;
          })
          .join('\n\n') ?? '';
      if (quiz.options) {
        content +=
          '\n\n' +
          quiz.options
            .map((opt) => `${opt.oid ?? ''}. ${opt.text ?? ''}`)
            .join('\n\n');
      }
      break;

    default:
      console.log(quiz);
      content = quiz.type === 'X' ? '【多选题】\n\n' : '【单选题】\n\n';
      content += quiz.question ?? '';
      answerContent =
        typeof quiz.answer === 'string' ? quiz.answer : quiz.answer.join('');
      if (quiz.options) {
        content +=
          '\n\n' +
          quiz.options
            .map(
              (opt, index) =>
                `${String.fromCharCode(65 + index)}. ${opt.text ?? ''}`,
            )
            .join('\n\n');
      }
  }

  if (withAnswer) {
    content += '\n\n## 正确选项：' + answerContent;
  }

  if (withAnalysis && 'analysis' in quiz && quiz.analysis) {
    content +=
      '\n\n## 解析：\n' +
      (quiz.analysis.point ?? '') +
      '\n\n' +
      (quiz.analysis.discuss ?? '');
  }

  return content;
}

/**
 * Processes an async stream of items and yields AgentStep objects with streaming content.
 *
 * @template T - The type of items in the input stream
 * @param stream - Async iterable stream of items to process
 * @param processor - Function that converts each item to a string representation
 * @yields {AgentStep} - Agent steps with streaming content:
 *   - For each item, yields content that's new since the last item
 *   - At end of stream, yields a final empty step with isFinal: true
 * @example
 * const stream = getSomeAsyncStream();
 * for await (const step of _handleStream(stream, item => item.toString())) {
 *   // Handle streaming updates
 * }
 */
export async function* _handleStream<T>(
  stream: AsyncIterable<T>,
  processor: (item: T) => string,
): AsyncGenerator<AgentStep> {
  let preContent = '';
  for await (const item of stream) {
    let currentContent = processor(item);
    yield {
      type: 'stream',
      content: currentContent.startsWith(preContent)
        ? currentContent.substring(preContent.length)
        : '',
      task: '',
    };
    preContent = currentContent;
  }
  yield {
    type: 'stream',
    content: '',
    isFinal: true,
    task: '',
  };
}

/**
 * Shuffles an array in place using the Fisher-Yates algorithm
 * @param array The array to shuffle
 * @returns The shuffled array
 */
export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}
