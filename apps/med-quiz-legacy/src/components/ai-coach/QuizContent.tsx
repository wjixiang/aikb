"use client";

import { QuizWithUserAnswer, answerType } from "@/types/quizData.types";
import Page, { QuizPageImperativeHandle } from "../quiz/QuizPage";
import { Skeleton } from "../ui/skeleton";
import { useRef, forwardRef } from "react";

interface QuizContentProps {
  quizzes: QuizWithUserAnswer[];
  quizSetId?: string;
  onAnswerChange: (quizId: string, answer: answerType) => Promise<void>;
  onReset: () => void;
  onQuizSelect?: (index: number) => void;
  isQuizFetching: boolean;
  setQuizzes: React.Dispatch<React.SetStateAction<QuizWithUserAnswer[]>>;
  isTestMode?: boolean;
  quizStateUpdateTrigger?: number;
  quizPageRef?: React.RefObject<QuizPageImperativeHandle | null>;
}

export function QuizContent({
  quizzes,
  quizSetId,
  onAnswerChange,
  onReset,
  onQuizSelect,
  isQuizFetching,
  setQuizzes,
  isTestMode,
  quizStateUpdateTrigger,
  quizPageRef,
}: QuizContentProps) {
  // Create a local ref if none is provided
  const localQuizPageRef = useRef<QuizPageImperativeHandle | null>(null);
  const refToUse = quizPageRef || localQuizPageRef;
  return (
    <>
      {isQuizFetching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mx-auto h-full">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : (
        <div className="flex w-full mx-auto h-full flex-grow min-w-0">
          <Page
            ref={refToUse}
            quizSet={quizzes}
            onAnswerChange={onAnswerChange}
            setCurrentQuiz={onQuizSelect}
            initialAnswers={quizzes.reduce(
              (acc, quiz) => {
                if (quiz.userAnswer !== undefined) {
                  acc[quiz._id] = quiz.userAnswer;
                }
                return acc;
              },
              {} as Record<string, answerType>,
            )}
            setQuizSet={setQuizzes}
            isTestMode={isTestMode}
            quizStateUpdateTrigger={quizStateUpdateTrigger}
          />
        </div>
      )}
    </>
  );
}
