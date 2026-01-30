import React, { useEffect, useRef } from 'react';
import { QuizWithUserAnswer, A1, A2, A3, B } from '@/types/quizData.types';
import {
  QuestionTitle,
  MainQuestion,
  SubQuestion,
  OptionsList,
} from '../styles/QuizStyles';
import { OptionItem } from './OptionItem';
import { Check, X as XIcon, Square } from 'lucide-react';

interface QuizContentProps {
  quiz: QuizWithUserAnswer;
  selected: any;
  submitted: boolean;
  subQuestionCorrectness: Record<number, boolean>;
  onOptionSelect: (
    oid: string,
    questionKey?: number,
    isDoubleClick?: boolean,
  ) => void;
  getShuffledOptions: (options: any[], questionId?: string | number) => any[];
  activeSubQuestionIndex?: number;
  isKeyboardNavigation?: boolean;
}

export const QuizContent: React.FC<QuizContentProps> = ({
  quiz,
  selected,
  submitted,
  subQuestionCorrectness,
  onOptionSelect,
  getShuffledOptions,
  activeSubQuestionIndex = 0,
  isKeyboardNavigation = false,
}) => {
  const isA1A2 = (q: QuizWithUserAnswer): q is A1 | A2 =>
    q.type === 'A1' || q.type === 'A2';
  const isX = (q: QuizWithUserAnswer): q is any => q.type === 'X';
  const isA3 = (q: QuizWithUserAnswer): q is A3 => q.type === 'A3';
  const isB = (q: QuizWithUserAnswer): q is B => q.type === 'B';

  const renderA1A2Content = (quiz: A1 | A2) => (
    <>
      <QuestionTitle>{quiz.question}</QuestionTitle>
      <OptionsList>
        {getShuffledOptions(quiz.options).map((item) => {
          const isSelected = selected === item.oid;
          const isCorrect = quiz.answer === item.oid;

          return (
            <OptionItem
              key={item.oid}
              selected={isSelected}
              correct={isCorrect}
              submitted={submitted}
              onClick={() => onOptionSelect(item.oid)}
              onDoubleClick={() => onOptionSelect(item.oid, undefined, true)}
            >
              <span>{item.text.replace(/^[A-E]\.\s*/, '')}</span>
            </OptionItem>
          );
        })}
      </OptionsList>
    </>
  );

  const renderXContent = (quiz: any) => (
    <>
      <QuestionTitle>{quiz.question}</QuestionTitle>
      <OptionsList>
        {getShuffledOptions(quiz.options).map((item) => {
          const isSelected =
            Array.isArray(selected) && selected.includes(item.oid);
          const isCorrect =
            Array.isArray(quiz.answer) && quiz.answer.includes(item.oid);

          return (
            <OptionItem
              key={item.oid}
              selected={isSelected}
              correct={isCorrect}
              submitted={submitted}
              onClick={() => onOptionSelect(item.oid)}
              onDoubleClick={() => onOptionSelect(item.oid, undefined, true)}
            >
              <span>{item.text.replace(/^[A-E]\.\s*/, '')}</span>
              {!submitted && (
                <Square
                  size={16}
                  className={`${isSelected ? 'text-blue-500 fill-current' : 'text-gray-300'}`}
                  style={{ borderRadius: '4px' }}
                />
              )}
            </OptionItem>
          );
        })}
      </OptionsList>
    </>
  );

  const subQuestionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Scroll active sub-question into view with better centering
    if (
      (quiz.type === 'A3' || quiz.type === 'B') &&
      activeSubQuestionIndex >= 0
    ) {
      const ref = subQuestionRefs.current[activeSubQuestionIndex];
      if (ref) {
        // Use a more centered scroll position with better viewport positioning
        ref.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });

        // Add a small delay to ensure the scroll completes, then fine-tune position
        setTimeout(() => {
          const container = ref.closest(
            '.sub-question-container, .question-container',
          ) as HTMLElement;
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const targetOffset = Math.max(
              100,
              (viewportHeight - containerRect.height) / 4,
            );

            // Fine-tune the scroll position to ensure better visibility
            const currentScroll =
              window.pageYOffset || document.documentElement.scrollTop;
            const targetScroll =
              currentScroll + containerRect.top - targetOffset;

            window.scrollTo({
              top: targetScroll,
              behavior: 'smooth',
            });
          }
        }, 150);
      }
    }
  }, [activeSubQuestionIndex, quiz.type]);

  const renderA3Content = (quiz: A3) => (
    <>
      <MainQuestion>{quiz.mainQuestion}</MainQuestion>
      {quiz.subQuizs.map((sub, index) => (
        <div
          key={sub.subQuizId}
          ref={(el: HTMLDivElement | null) => {
            subQuestionRefs.current[index] = el;
          }}
          className={`sub-question-container transition-all duration-300 ${
            activeSubQuestionIndex === index && isKeyboardNavigation
              ? 'border-2 border-primary rounded-lg p-4 bg-primary/5 ring-2 ring-primary/20 shadow-lg my-6'
              : submitted
                ? 'p-3 mb-4'
                : 'mb-6 border border-transparent'
          }`}
        >
          <SubQuestion
            className={
              activeSubQuestionIndex === index && isKeyboardNavigation
                ? 'text-primary font-semibold'
                : ''
            }
          >
            {sub.question}
            {activeSubQuestionIndex === index && isKeyboardNavigation && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                键盘焦点
              </span>
            )}
          </SubQuestion>
          <OptionsList>
            {getShuffledOptions(sub.options, sub.subQuizId).map((item) => {
              const isSelected = selected[sub.subQuizId] === item.oid;
              const isCorrect = sub.answer === item.oid;
              // For A3 questions, we use the subQuizId as the key in subQuestionCorrectness
              const isSubQuestionCorrect =
                subQuestionCorrectness[sub.subQuizId] ?? false;

              return (
                <OptionItem
                  key={item.oid}
                  selected={isSelected}
                  submitted={submitted}
                  correct={submitted && isCorrect}
                  onClick={() => onOptionSelect(item.oid, sub.subQuizId)}
                  onDoubleClick={() =>
                    onOptionSelect(item.oid, sub.subQuizId, true)
                  }
                >
                  <span className="mr-2">
                    {item.text.replace(/^[A-E]\.\s*/, '')}
                  </span>
                </OptionItem>
              );
            })}
          </OptionsList>
        </div>
      ))}
    </>
  );

  const renderBContent = (quiz: B) => (
    <>
      {quiz.questions.map((q, index) => (
        <div
          key={q.questionId}
          ref={(el: HTMLDivElement | null) => {
            subQuestionRefs.current[index] = el;
          }}
          className={`question-container transition-all duration-300 ${
            activeSubQuestionIndex === index && isKeyboardNavigation
              ? 'border-2 border-primary rounded-lg p-4 bg-primary/5 ring-2 ring-primary/20 shadow-lg my-6'
              : submitted
                ? 'p-3 mb-4'
                : 'mb-6 border border-transparent'
          }`}
        >
          <SubQuestion
            className={
              activeSubQuestionIndex === index && isKeyboardNavigation
                ? 'text-primary font-semibold'
                : ''
            }
          >
            {q.questionText}
            {activeSubQuestionIndex === index && isKeyboardNavigation && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                键盘焦点
              </span>
            )}
          </SubQuestion>
          <OptionsList>
            {getShuffledOptions(quiz.options, q.questionId).map((item) => {
              const isSelected = selected[q.questionId] === item.oid;
              const isCorrect = q.answer === item.oid;
              // For B questions, we use the questionId as the key in subQuestionCorrectness
              const isSubQuestionCorrect =
                subQuestionCorrectness[q.questionId] ?? false;

              return (
                <OptionItem
                  key={item.oid}
                  selected={isSelected}
                  submitted={submitted}
                  correct={submitted && isCorrect}
                  onClick={() => onOptionSelect(item.oid, q.questionId)}
                  onDoubleClick={() =>
                    onOptionSelect(item.oid, q.questionId, true)
                  }
                  className={`flex items-center p-2 rounded ${
                    submitted
                      ? isSubQuestionCorrect
                        ? isSelected
                          ? 'bg-[hsl(var(--quiz-user-correct)/0.2)] border-2 border-[hsl(var(--quiz-user-correct))]'
                          : 'border border-[hsl(var(--quiz-default-incorrect))]'
                        : isSelected
                          ? isCorrect
                            ? 'bg-[hsl(var(--quiz-user-correct)/0.2)] border-2 border-[hsl(var(--quiz-user-correct))]'
                            : 'bg-[hsl(var(--quiz-user-incorrect)/0.2)] border-2 border-[hsl(var(--quiz-user-incorrect))]'
                          : isCorrect
                            ? 'bg-[hsl(var(--quiz-missed-correct)/0.2)] border border-[hsl(var(--quiz-missed-correct))]'
                            : 'border border-[hsl(var(--quiz-default-incorrect))]'
                      : activeSubQuestionIndex === index && isKeyboardNavigation
                        ? 'border-primary/20'
                        : ''
                  }`}
                >
                  <span className="mr-2">
                    {item.text.replace(/^[A-E]\.\s*/, '')}
                  </span>
                  {submitted && (
                    <>
                      {isSubQuestionCorrect ? (
                        isSelected && (
                          <Check
                            size={16}
                            className="ml-auto text-[hsl(var(--quiz-user-correct))] font-bold"
                          />
                        )
                      ) : (
                        <>
                          {isSelected &&
                            (isCorrect ? (
                              <Check
                                size={16}
                                className="ml-auto text-[hsl(var(--quiz-user-correct))] font-bold"
                              />
                            ) : (
                              <XIcon
                                size={16}
                                className="ml-auto text-[hsl(var(--quiz-user-incorrect))] font-bold"
                              />
                            ))}
                          {isCorrect && !isSelected && (
                            <Check
                              size={16}
                              className="ml-auto text-[hsl(var(--quiz-missed-correct))] font-bold"
                            />
                          )}
                        </>
                      )}
                    </>
                  )}
                </OptionItem>
              );
            })}
          </OptionsList>
        </div>
      ))}
    </>
  );

  const renderContent = () => {
    if (isA1A2(quiz)) return renderA1A2Content(quiz);
    if (isX(quiz)) return renderXContent(quiz);
    if (isA3(quiz)) return renderA3Content(quiz);
    if (isB(quiz)) return renderBContent(quiz);
    return null;
  };

  return <>{renderContent()}</>;
};
