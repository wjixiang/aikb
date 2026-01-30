import * as React from 'react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import Quiz, { QuizImperativeHandle } from '../Quiz';
import { QuizWithUserAnswer, answerType } from '@/types/quizData.types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Grid } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';

interface QuizViewProps {
  quizSet: QuizWithUserAnswer[];
  quizSetId?: string;
  onAnswerChange: (quizId: string, answer: answerType) => Promise<void>;
  initialAnswers?: Record<string, answerType>;
  setCurrentQuiz?: (index: number) => void;
  setQuizSet: React.Dispatch<React.SetStateAction<QuizWithUserAnswer[]>>;
  isTestMode?: boolean;
  handleBackToGrid: () => void;
  currentQuizIndex: number;
  setCurrentQuizIndex: React.Dispatch<React.SetStateAction<number>>;
  getQuizState: (quizindex: number) => {
    submitted: boolean;
    isCorrect: boolean;
    selectedOptions: string | Record<number, string>;
  };
  batchSync: {
    pendingUpdates: number;
    isSyncing: boolean;
    lastSyncTime: Date | null;
    syncErrors: Record<string, string>;
    updateQuizAnswer: (quizId: string, answer: answerType) => void;
    forceSync: () => Promise<void>;
    retryFailed: (quizId: string) => Promise<void>;
    clearErrors: () => void;
  };
  quizRefs: React.MutableRefObject<
    Array<React.RefObject<QuizImperativeHandle | null>>
  >;
  viewKey?: string; // Add a key to force re-render when switching views
}

const QuizView: React.FC<QuizViewProps> = ({
  quizSet,
  quizSetId,
  onAnswerChange,
  initialAnswers,
  setCurrentQuiz,
  setQuizSet,
  isTestMode = false,
  handleBackToGrid,
  currentQuizIndex,
  setCurrentQuizIndex,
  getQuizState,
  batchSync,
  quizRefs,
  viewKey,
}) => {
  const [api, setApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [isViewSwitching, setIsViewSwitching] = useState(false);

  const quizzesWithCombinedAnswers = useMemo(() => {
    return quizSet.map((quiz) => ({
      ...quiz,
      userAnswer:
        initialAnswers?.[quiz._id] || (quiz as QuizWithUserAnswer).userAnswer,
    }));
  }, [quizSet, initialAnswers]);

  useEffect(() => {
    if (!api) {
      return;
    }

    // Update scroll state
    const updateScrollState = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    const handleApiSelect = () => {
      const newIndex = api.selectedScrollSnap();
      setCurrentQuizIndex(newIndex);
      if (setCurrentQuiz) {
        setCurrentQuiz(newIndex);
      }
      // Update scroll state when selection changes
      updateScrollState();
    };

    // Initialize scroll state
    updateScrollState();

    api.on('select', handleApiSelect);
    api.on('reInit', updateScrollState);

    return () => {
      api?.off('select', handleApiSelect);
      api?.off('reInit', updateScrollState);
    };
  }, [api, setCurrentQuiz, setCurrentQuizIndex]);

  useEffect(() => {
    if (api) {
      const timer = setTimeout(() => {
        // Carousel 组件默认是放置于第一个页面的，如果不滚动则会导致切换后异常处于第一个试题
        // 所以总是需要滚动到目标位置
        // Use smooth scroll for regular navigation within quiz-view
        api.scrollTo(currentQuizIndex);
      }, 50); // Add a small delay to ensure the carousel is fully rendered and ready
      return () => clearTimeout(timer); // Cleanup on unmount or dependency change
    }
  }, [api, currentQuizIndex]);

  // Add a new effect to handle scrolling when the component mounts or when switching views
  useEffect(() => {
    if (api) {
      // Set flag to indicate we're switching views
      setIsViewSwitching(true);

      // Add a longer delay when the component first mounts or when switching from grid-view
      const timer = setTimeout(() => {
        // When switching from grid-view to quiz-view, use instant scroll
        api.scrollTo(currentQuizIndex);

        // Reset the flag after scrolling
        setTimeout(() => setIsViewSwitching(false), 50);
      }, 200); // Longer delay to ensure the carousel is fully initialized
      return () => clearTimeout(timer);
    }
  }, [api, viewKey]); // Depend on api and viewKey to run when the carousel is ready or when view changes

  const back = useCallback(() => {
    if (api?.canScrollPrev()) {
      api.scrollPrev();
    }
  }, [api]);

  const forward = useCallback(() => {
    if (api?.canScrollNext()) {
      api.scrollNext();
    }
  }, [api]);

  const handleSimilarQuizzesFound = useCallback(
    (similarQuizzes: QuizWithUserAnswer[]) => {
      setQuizSet((prevQuizSet) => {
        const newQuizSet = [...prevQuizSet];
        const existingQuizIds = new Set(prevQuizSet.map((quiz) => quiz._id));
        const filteredSimilarQuizzes = similarQuizzes.filter(
          (similarQuiz) => !existingQuizIds.has(similarQuiz._id),
        );

        if (filteredSimilarQuizzes.length > 0) {
          const insertIndex = currentQuizIndex + 1;
          newQuizSet.splice(insertIndex, 0, ...filteredSimilarQuizzes);
        }

        // Sorting function to order quizzes by type: A1/A2 -> A3 -> B -> X
        const sortQuizzesByType = (
          quizzes: QuizWithUserAnswer[],
        ): QuizWithUserAnswer[] => {
          const typeOrder: Record<string, number> = {
            A1: 0,
            A2: 0,
            A3: 1,
            B: 2,
            X: 3,
          };

          return [...quizzes].sort((a, b) => {
            const orderA = typeOrder[a.type] ?? 999;
            const orderB = typeOrder[b.type] ?? 999;
            if (orderA !== orderB) {
              return orderA - orderB;
            }
            return 0; // Maintain original order for same types
          });
        };

        return sortQuizzesByType(newQuizSet);
      });
    },
    [currentQuizIndex, setQuizSet],
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault(); // Prevent default browser behavior
        back();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault(); // Prevent default browser behavior
        forward();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [back, forward]);

  const handleUnifiedSubmit = () => {
    // Collect all answers from quizRefs and submit them
    const answersToSubmit: Record<string, answerType> = {};

    quizSet.forEach((quiz, index) => {
      const quizRef = quizRefs.current[index];
      if (quizRef && quizRef.current) {
        const state = quizRef.current.getCurrentState();

        // Handle A3/B type questions differently
        if (quiz.type === 'A3' || quiz.type === 'B') {
          // For A3/B type questions, check if any subquestions have been answered
          if (
            state.selectedOptions &&
            typeof state.selectedOptions === 'object' &&
            !Array.isArray(state.selectedOptions)
          ) {
            // Check if any subquestion has been answered
            const hasAnyAnswer = Object.values(
              state.selectedOptions as Record<number, string>,
            ).some((answer) => answer && answer !== '');

            if (hasAnyAnswer) {
              answersToSubmit[quiz._id] = state.selectedOptions;
            }
          }
        } else {
          // For regular questions
          // Only submit if the quiz has been answered
          if (state.selectedOptions && state.selectedOptions !== '') {
            answersToSubmit[quiz._id] = state.selectedOptions;
          }
        }
      }
    });

    // Submit all collected answers
    Object.entries(answersToSubmit).forEach(([quizId, answer]) => {
      onAnswerChange(quizId, answer);
    });

    // Show success message
    alert(`成功提交 ${Object.keys(answersToSubmit).length} 道题的答案`);
  };

  // Scroll to the current question in test mode
  useEffect(() => {
    if (isTestMode) {
      // Add a small delay to ensure the DOM is updated
      const timer = setTimeout(() => {
        const element = document.getElementById(`quiz-${currentQuizIndex}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [currentQuizIndex, isTestMode]);

  // 计算统计信息
  const calculateStats = () => {
    let submittedCount = 0;
    let correctCount = 0;
    let totalSubquestions = 0;
    let correctSubquestions = 0;

    quizSet.forEach((quiz, index) => {
      const state = getQuizState(index);

      // Handle A3/B type questions with subquestions
      if (quiz.type === 'A3') {
        // For A3 type questions, check subQuizs
        const subquestions = quiz.subQuizs || [];
        totalSubquestions += subquestions.length;

        // Count submitted and correct subquestions
        subquestions.forEach((subQ) => {
          // Get the answer for this subquestion from the selected object
          const subAnswer =
            state.selectedOptions &&
            typeof state.selectedOptions === 'object' &&
            !Array.isArray(state.selectedOptions)
              ? (state.selectedOptions as Record<number, string>)[
                  subQ.subQuizId
                ]
              : undefined;

          // Only count if the subquestion has been answered
          if (subAnswer && subAnswer !== '') {
            submittedCount++;
            // Check if the subquestion answer is correct
            if (subQ.answer === subAnswer) {
              correctCount++;
              correctSubquestions++;
            }
          }
        });
      } else if (quiz.type === 'B') {
        // For B type questions, check questions
        const subquestions = quiz.questions || [];
        totalSubquestions += subquestions.length;

        // Count submitted and correct subquestions
        subquestions.forEach((subQ) => {
          // Get the answer for this subquestion from the selected object
          const subAnswer =
            state.selectedOptions &&
            typeof state.selectedOptions === 'object' &&
            !Array.isArray(state.selectedOptions)
              ? (state.selectedOptions as Record<number, string>)[
                  subQ.questionId
                ]
              : undefined;

          // Only count if the subquestion has been answered
          if (subAnswer && subAnswer !== '') {
            submittedCount++;
            // Check if the subquestion answer is correct
            if (subQ.answer === subAnswer) {
              correctCount++;
              correctSubquestions++;
            }
          }
        });
      } else {
        // For regular questions (A1, A2, X)
        if (state.submitted) {
          submittedCount++;
          if (state.isCorrect) {
            correctCount++;
          }
        }
      }
    });

    const totalCount = quizSet.length;
    const completionRate =
      totalCount > 0
        ? ((submittedCount / (totalCount + totalSubquestions)) * 100).toFixed(1)
        : '0';
    const accuracyRate =
      submittedCount > 0
        ? ((correctCount / submittedCount) * 100).toFixed(1)
        : '0';

    return {
      completionRate,
      accuracyRate,
      submittedCount,
      correctCount,
      totalCount: totalCount + totalSubquestions,
      correctSubquestions,
      totalSubquestions,
    };
  };

  // Topbar component for quiz navigation
  const QuizTopbar = () => (
    <div className="flex items-center justify-between p-2 sm:p-3 bg-background border-b">
      <div className="flex items-center gap-2">
        <Grid size="25px" onClick={handleBackToGrid} />

        <div className="text-sm sm:text-base font-medium">
          {currentQuizIndex + 1} / {quizSet.length}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={back}
          disabled={!canScrollPrev}
          className="h-8 w-8 sm:h-9 sm:w-9"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={forward}
          disabled={!canScrollNext}
          className="h-8 w-8 sm:h-9 sm:w-9"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {quizSet.length === 0 ? (
        <div className="items-center justify-center h-full">暂无试题</div>
      ) : isTestMode ? (
        <>
          {/* Topbar for test mode */}
          <QuizTopbar />
          {/* Vertical layout for test mode */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-6 w-full">
              {quizzesWithCombinedAnswers.map((quiz, index) => (
                <div key={index} className="w-full">
                  <Quiz
                    quiz={quiz}
                    quizSetId={quizSetId}
                    ref={quizRefs.current[index]}
                    handleBackToGrid={handleBackToGrid}
                    currentQuizIndex={currentQuizIndex}
                    thisQuizIndex={index}
                    forward={forward}
                    back={back}
                    onAnswerChange={onAnswerChange}
                    onSimilarQuizzesFound={handleSimilarQuizzesFound}
                    isTestMode={isTestMode}
                  />
                </div>
              ))}
            </div>
          </div>
          {/* Submission button for test mode */}
          {!isTestMode && (
            <div className="flex justify-center mt-4">
              <Button onClick={handleUnifiedSubmit}>提交所有答案</Button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Topbar for practice mode */}
          <QuizTopbar />
          {/* Carousel layout for practice mode */}
          <div className="flex-1 overflow-hidden">
            <Carousel
              setApi={setApi}
              opts={{
                align: 'start',
                loop: false,
                duration: isViewSwitching ? 0 : 20, // No animation when switching views, shorter animation for regular navigation
              }}
              className="w-full h-full"
            >
              <CarouselContent className="h-full">
                {quizzesWithCombinedAnswers.map((quiz, index) => (
                  <CarouselItem key={index} className="w-full h-full">
                    <Quiz
                      quiz={quiz}
                      quizSetId={quizSetId}
                      ref={quizRefs.current[index]}
                      handleBackToGrid={handleBackToGrid}
                      currentQuizIndex={currentQuizIndex}
                      thisQuizIndex={index}
                      forward={forward}
                      back={back}
                      onAnswerChange={onAnswerChange}
                      onSimilarQuizzesFound={handleSimilarQuizzesFound}
                      isTestMode={isTestMode}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </div>
        </>
      )}
    </div>
  );
};

export default QuizView;
