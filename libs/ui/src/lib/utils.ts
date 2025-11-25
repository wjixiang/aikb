import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { quiz } from "../../../quiz-shared/src/types/quiz.types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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