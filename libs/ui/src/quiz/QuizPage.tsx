import * as React from 'react';
import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useImperativeHandle,
} from 'react';
import { QuizImperativeHandle } from './Quiz';
import QuizPreview from './QuizPreview';
import QuizView from './quiz-components/QuizView';
import { QuizType } from 'quiz-shared';
import { Card } from 'ui';
import { Button } from 'ui';
import { Toggle } from 'ui';

// Remove styled-components import since we're using Tailwind
// import styled from 'styled-components'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'ui';
import { useQuizBatchSync } from './quiz-hooks/useQuizBatchSync';

// Sorting function to order quizzes by type: A1/A2 -> A3 -> B -> X
const sortQuizzesByType = (
  quizzes: QuizType.QuizWithUserAnswer[],
): QuizType.QuizWithUserAnswer[] => {
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

interface PageProps {
  quizSet: QuizType.QuizWithUserAnswer[];
  quizSetId?: string;
  onAnswerChange: (
    quizId: string,
    answer: QuizType.answerType,
  ) => Promise<void>;
  initialAnswers?: Record<string, QuizType.answerType>;
  setCurrentQuiz?: (index: number) => void;
  setQuizSet: React.Dispatch<
    React.SetStateAction<QuizType.QuizWithUserAnswer[]>
  >;
  isTestMode?: boolean;
  quizStateUpdateTrigger?: number;
}

export interface QuizPageImperativeHandle {
  getQuizState: (quizIndex: number) => {
    submitted: boolean;
    isCorrect: boolean;
    selectedOptions: string;
  };
  handleUnifiedSubmit: () => void;
  getCurrentQuizIndex: () => number;
  setCurrentQuizIndex: (index: number) => void;
}

const Page = React.forwardRef<QuizPageImperativeHandle, PageProps>(
  (
    {
      quizSet,
      quizSetId,
      onAnswerChange,
      initialAnswers,
      setCurrentQuiz,
      setQuizSet,
      isTestMode = false,
      quizStateUpdateTrigger: externalQuizStateUpdateTrigger,
    },
    ref,
  ) => {
    const [currentPage, setCurrentPage] = useState<'grid-view' | 'quiz-view'>(
      'grid-view',
    );
    const [viewKey, setViewKey] = useState(0); // Add a key to force re-render when switching views
    const [quizStateUpdateTrigger, setQuizStateUpdateTrigger] = useState(0);
    const [startTime] = useState(Date.now());
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isStatusPanelCollapsed, setIsStatusPanelCollapsed] = useState(false);

    // Wrapper function for onAnswerChange that also triggers quiz state updates
    const handleAnswerChange = useCallback(
      async (quizId: string, answer: QuizType.answerType) => {
        await onAnswerChange(quizId, answer);
        setQuizStateUpdateTrigger((prev) => prev + 1);
      },
      [onAnswerChange],
    );

    // Function to get quiz state - moved to the top to avoid initialization error
    const getQuizState = (quizindex: number) => {
      // First check if we have combined answers for this quiz
      const quizWithAnswer = quizzesWithCombinedAnswers[quizindex];
      if (
        quizWithAnswer &&
        quizWithAnswer.userAnswer !== undefined &&
        quizWithAnswer.userAnswer !== null
      ) {
        // Calculate correctness based on the user answer
        let isCorrect = false;
        const subQuestionCorrectnessMap: Record<number, boolean> = {};

        switch (quizWithAnswer.type) {
          case 'A1':
          case 'A2':
            isCorrect = quizWithAnswer.userAnswer === quizWithAnswer.answer;
            break;
          case 'X':
            if (Array.isArray(quizWithAnswer.userAnswer)) {
              isCorrect =
                JSON.stringify(quizWithAnswer.userAnswer.sort()) ===
                JSON.stringify(quizWithAnswer.answer.sort());
            }
            break;
          case 'A3':
            isCorrect = (quizWithAnswer as any).subQuizs?.every((sub: any) => {
              const isSubCorrect =
                (quizWithAnswer.userAnswer as Record<number, string>)[
                  sub.subQuizId
                ] === sub.answer;
              subQuestionCorrectnessMap[sub.subQuizId] = isSubCorrect;
              return isSubCorrect;
            });
            break;
          case 'B':
            isCorrect = (quizWithAnswer as any).questions?.every((q: any) => {
              const isSubCorrect =
                (quizWithAnswer.userAnswer as Record<number, string>)[
                  q.questionId
                ] === q.answer;
              subQuestionCorrectnessMap[q.questionId] = isSubCorrect;
              return isSubCorrect;
            });
            break;
          default:
            break;
        }

        // Convert selectedOptions to string for compatibility with QuizPreview
        let selectedOptions: string;
        if (Array.isArray(quizWithAnswer.userAnswer)) {
          selectedOptions = quizWithAnswer.userAnswer.join(',');
        } else if (typeof quizWithAnswer.userAnswer === 'object') {
          selectedOptions = JSON.stringify(quizWithAnswer.userAnswer);
        } else {
          selectedOptions = quizWithAnswer.userAnswer as string;
        }

        return {
          submitted: true,
          isCorrect: isCorrect,
          selectedOptions: selectedOptions,
        };
      }

      // For when no initial answer is available, fall back to ref-based approach
      if (
        quizRefs.current.length === 0 ||
        quizindex < 0 ||
        quizindex >= quizRefs.current.length
      ) {
        // console.error("Invalid quiz index:", quizindex);
        return {
          submitted: false,
          isCorrect: false,
          selectedOptions: 'A',
        };
      }

      const currentRef = quizRefs.current[quizindex];
      if (currentRef && currentRef.current) {
        const quizState = currentRef.current.getCurrentState();
        // Convert selectedOptions to string for compatibility with QuizPreview
        let selectedOptions: string;
        if (Array.isArray(quizState.selectedOptions)) {
          selectedOptions = quizState.selectedOptions.join(',');
        } else if (typeof quizState.selectedOptions === 'object') {
          selectedOptions = JSON.stringify(quizState.selectedOptions);
        } else {
          selectedOptions = quizState.selectedOptions as string;
        }

        return {
          submitted: quizState.submitted,
          isCorrect: quizState.isCorrect,
          selectedOptions: selectedOptions,
        };
      } else {
        return {
          submitted: false,
          isCorrect: false,
          selectedOptions: 'A',
        };
      }
    };

    const quizzesWithCombinedAnswers = useMemo(() => {
      return quizSet.map((quiz) => ({
        ...quiz,
        userAnswer:
          initialAnswers?.[quiz._id] ||
          (quiz as QuizType.QuizWithUserAnswer).userAnswer,
      }));
    }, [quizSet, initialAnswers]);
    const [currentQuizIndex, setCurrentQuizIndex] = useState(0);

    const batchSync = useQuizBatchSync({
      quizSet,
      onAnswerChange,
      batchDelay: 500,
      maxBatchSize: 5,
      onSyncComplete: () => {
        setQuizStateUpdateTrigger((prev) => prev + 1);
      },
    });

    const setIndex = useCallback(
      (index: number) => {
        if (setCurrentQuiz) setCurrentQuiz(index);
        setCurrentQuizIndex(index);
      },
      [setCurrentQuiz],
    );

    const quizRefs = useRef<
      Array<React.RefObject<QuizImperativeHandle | null>>
    >([]);

    useEffect(() => {
      quizRefs.current = Array(quizSet.length)
        .fill(null)
        .map(() => React.createRef<QuizImperativeHandle>());
    }, [quizSet.length]);

    useEffect(() => {
      quizRefs.current = Array(quizSet.length)
        .fill(null)
        .map(() => React.createRef<QuizImperativeHandle>());
    }, [quizSet.length]);

    useEffect(() => {
      // 仅当quizSet长度变化时重置视图
      if (!isTestMode) {
        setCurrentPage('grid-view');
      }
      // 只有在quizSet长度变化时才重置索引，避免从quiz-view返回grid-view后再次点击时跳转到第一个quiz
      if (quizSet.length !== quizRefs.current.length) {
        setIndex(0);
      }

      // 调试日志：打印初始答案和quizSet
      console.log('QuizSet updated:', {
        quizSet: quizSet,
        initialAnswers: initialAnswers,
        combined: quizSet.map((quiz) => ({
          id: quiz._id,
          initialAnswer: initialAnswers?.[quiz._id],
          quizAnswer: (quiz as QuizType.QuizWithUserAnswer).userAnswer,
        })),
      });
    }, [quizSet.length, setIndex]); // 仅依赖quizSet长度

    // Update elapsed time every second
    useEffect(() => {
      if (!isTestMode) return;

      const timer = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);

      return () => clearInterval(timer);
    }, [isTestMode, startTime]);

    const handleSimilarQuizzesFound = useCallback(
      (similarQuizzes: QuizType.QuizWithUserAnswer[]) => {
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
          return sortQuizzesByType(newQuizSet);
        });
      },
      [currentQuizIndex, setQuizSet],
    );

    // Unified submit function for test mode
    const handleUnifiedSubmit = useCallback(() => {
      // Collect all answers from quizRefs and submit them
      const answersToSubmit: Record<string, QuizType.answerType> = {};

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
        handleAnswerChange(quizId, answer);
      });

      // Show success message
      alert(`成功提交 ${Object.keys(answersToSubmit).length} 道题的答案`);
    }, [quizSet, quizRefs, handleAnswerChange]);

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
          ? ((submittedCount / (totalCount + totalSubquestions)) * 100).toFixed(
              1,
            )
          : 0;
      const accuracyRate =
        submittedCount > 0
          ? ((correctCount / submittedCount) * 100).toFixed(1)
          : 0;

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

    const [filterMode, setFilterMode] = useState<
      'all' | 'correct' | 'incorrect'
    >('all');

    const filteredQuizzes = quizSet.filter((quiz, index) => {
      const state = getQuizState(index);

      // Handle A3/B type questions with subquestions
      if (quiz.type === 'A3') {
        // For A3 type questions, check if any subquestions match the filter
        const subquestions = quiz.subQuizs || [];

        // If showing all, include the quiz
        if (filterMode === 'all') return true;

        // Check if any subquestions match the filter criteria
        const hasMatchingSubquestion = subquestions.some((subQ: any) => {
          // Get the answer for this subquestion from the selected object
          const subAnswer =
            state.selectedOptions &&
            typeof state.selectedOptions === 'object' &&
            !Array.isArray(state.selectedOptions)
              ? (state.selectedOptions as Record<number, string>)[
                  subQ.subQuizId
                ]
              : undefined;

          // If no answer, it's not submitted
          if (!subAnswer || subAnswer === '') {
            return false;
          }

          // Check correctness based on filter mode
          const isSubquestionCorrect = subQ.answer === subAnswer;
          return filterMode === 'correct'
            ? isSubquestionCorrect
            : !isSubquestionCorrect;
        });

        return hasMatchingSubquestion;
      } else if (quiz.type === 'B') {
        // For B type questions, check if any subquestions match the filter
        const subquestions = quiz.questions || [];

        // If showing all, include the quiz
        if (filterMode === 'all') return true;

        // Check if any subquestions match the filter criteria
        const hasMatchingSubquestion = subquestions.some((subQ: any) => {
          // Get the answer for this subquestion from the selected object
          const subAnswer =
            state.selectedOptions &&
            typeof state.selectedOptions === 'object' &&
            !Array.isArray(state.selectedOptions)
              ? (state.selectedOptions as Record<number, string>)[
                  subQ.questionId
                ]
              : undefined;

          // If no answer, it's not submitted
          if (!subAnswer || subAnswer === '') {
            return false;
          }

          // Check correctness based on filter mode
          const isSubquestionCorrect = subQ.answer === subAnswer;
          return filterMode === 'correct'
            ? isSubquestionCorrect
            : !isSubquestionCorrect;
        });

        return hasMatchingSubquestion;
      } else {
        // For regular questions
        if (filterMode === 'all') return true;
        if (!state.submitted) return false;
        return filterMode === 'correct' ? state.isCorrect : !state.isCorrect;
      }
    });

    const handleQuizSelect = (index: number) => {
      console.log(`selected quiz index: ${index}`);
      setIndex(index);
      if (!isTestMode) {
        setCurrentPage('quiz-view');
        setViewKey((prev) => prev + 1); // Increment viewKey to force re-render
      }
    };

    const handleBackToGrid = () => {
      setCurrentPage('grid-view');
      // Force sync any pending changes before switching views
      batchSync.forceSync();
    };

    // Force sync before unmount
    useEffect(() => {
      return () => {
        batchSync.forceSync();
      };
    }, [batchSync]);

    // Expose methods through ref
    useImperativeHandle(
      ref,
      () => ({
        getQuizState,
        handleUnifiedSubmit,
        getCurrentQuizIndex: () => currentQuizIndex,
        setCurrentQuizIndex: setIndex,
      }),
      [getQuizState, handleUnifiedSubmit, setIndex],
    );

    return (
      <div className="w-full h-full overflow-hidden [&::-webkit-scrollbar]:hidden scrollbar-none md:overflow-x-hidden md:px-0 md:box-border flex flex-col">
        {/* 网格视图 */}
        <div
          style={{
            display:
              currentPage === 'grid-view' && !isTestMode ? 'block' : 'none',
          }}
          className="h-full flex flex-col"
        >
          <div className=" border-none items-center justify-center h-full w-full flex flex-col">
            {quizSet.length === 0 ? (
              <div className="text-center text-xl text-muted-foreground">
                暂无试题
              </div>
            ) : (
              <>
                <div className="p-3 px-4 flex flex-wrap justify-between items-center gap-3 border-b w-full">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm leading-tight">
                      <span className="font-semibold">完成进度:</span>
                      <span className="font-medium">
                        {calculateStats().completionRate}%
                      </span>
                      <span className="font-medium">
                        ({calculateStats().submittedCount}/
                        {calculateStats().totalCount})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    {batchSync.isSyncing && (
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <span>同步中...</span>
                        {batchSync.pendingUpdates > 0 && (
                          <span>({batchSync.pendingUpdates})</span>
                        )}
                      </div>
                    )}
                    {batchSync.lastSyncTime && !batchSync.isSyncing && (
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        ✓ 已同步
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-sm whitespace-nowrap">筛选:</span>
                      <Select
                        value={filterMode}
                        onValueChange={(value) =>
                          setFilterMode(
                            value as 'all' | 'correct' | 'incorrect',
                          )
                        }
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="筛选试题" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部试题</SelectItem>
                          <SelectItem value="correct">仅正确</SelectItem>
                          <SelectItem value="incorrect">仅错误</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm leading-tight">
                        <span className="font-semibold">正确率:</span>
                        <span className="font-medium">
                          {calculateStats().accuracyRate}%
                        </span>
                        <span className="font-medium">
                          ({calculateStats().correctCount}/
                          {calculateStats().submittedCount})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={'w-full h-full'}>
                  <div className="h-full overflow-y-auto pb-32">
                    <div
                      className={`w-full grid ${isTestMode ? 'gap-2 p-2' : 'gap-4 p-5'} grid-cols-[repeat(auto-fill,minmax(50px,1fr))]`}
                    >
                      {filteredQuizzes.map((quiz, index) => {
                        const originalIndex = quizSet.indexOf(quiz);
                        return (
                          <div key={originalIndex}>
                            <QuizPreview
                              id={originalIndex}
                              name={`Quiz ${originalIndex + 1}`}
                              status="todo"
                              redirect={() => handleQuizSelect(originalIndex)}
                              getquizstate={getQuizState}
                              updateTrigger={
                                quizStateUpdateTrigger ||
                                externalQuizStateUpdateTrigger
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Quiz 视图 */}
        <div
          style={{
            display:
              currentPage === 'quiz-view' || isTestMode ? 'flex' : 'none',
          }}
          className="flex-grow h-full flex flex-col"
        >
          <div
            style={{
              maxHeight: isTestMode ? 'none' : 'none',
              overflowY: isTestMode ? 'auto' : 'visible',
            }}
            className="h-full flex flex-col"
          >
            <QuizView
              quizSet={quizSet}
              quizSetId={quizSetId}
              onAnswerChange={handleAnswerChange}
              initialAnswers={initialAnswers}
              setCurrentQuiz={setCurrentQuiz}
              setQuizSet={setQuizSet}
              isTestMode={isTestMode}
              handleBackToGrid={handleBackToGrid}
              currentQuizIndex={currentQuizIndex}
              setCurrentQuizIndex={setCurrentQuizIndex}
              getQuizState={getQuizState}
              batchSync={batchSync}
              quizRefs={quizRefs}
              viewKey={viewKey.toString()}
            />
          </div>
        </div>

        {/* 浮窗组件 - 仅在测试模式下显示 */}
        {isTestMode && (
          <div
            className={`fixed right-5 bg-card border border-border rounded-lg shadow-lg flex flex-col transition-all duration-300 z-50 ${
              isStatusPanelCollapsed
                ? 'bottom-5 w-16 h-16'
                : 'bottom-5 w-80 max-h-[80vh]'
            }`}
          >
            {/* Header with collapse toggle */}
            <div
              className="p-3 border-b border-border flex justify-between items-center cursor-pointer"
              onClick={() => setIsStatusPanelCollapsed(!isStatusPanelCollapsed)}
            >
              {!isStatusPanelCollapsed && (
                <>
                  <div className="font-semibold text-foreground">答题进度</div>
                  <div className="text-sm text-muted-foreground">
                    用时: {Math.floor(elapsedTime / 60000)}:
                    {String(Math.floor((elapsedTime % 60000) / 1000)).padStart(
                      2,
                      '0',
                    )}
                  </div>
                </>
              )}
              {isStatusPanelCollapsed && (
                <div className="w-full flex justify-center">
                  <div className="text-center">
                    <div className="text-xs font-semibold text-foreground">
                      {calculateStats().completionRate}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Math.floor(elapsedTime / 60000)}:
                      {String(
                        Math.floor((elapsedTime % 60000) / 1000),
                      ).padStart(2, '0')}
                    </div>
                  </div>
                </div>
              )}
              <button
                className="ml-2 p-1 rounded hover:bg-muted transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsStatusPanelCollapsed(!isStatusPanelCollapsed);
                }}
              >
                <svg
                  className={`w-4 h-4 text-muted-foreground transition-transform ${
                    isStatusPanelCollapsed ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>

            {/* Content - only show when not collapsed */}
            {!isStatusPanelCollapsed && (
              <>
                <div className="p-3">
                  <div className="grid grid-cols-5 gap-2">
                    {quizSet.map((quiz, index) => {
                      const state = getQuizState(index);

                      // Determine status based on submission state and selection state
                      let status = 'todo';
                      if (state.submitted) {
                        status = state.isCorrect ? 'correct' : 'wrong';
                      } else if (
                        (quiz.type === 'X' &&
                          Array.isArray(state.selectedOptions) &&
                          state.selectedOptions.length > 0) ||
                        (quiz.type === 'A3' &&
                          typeof state.selectedOptions === 'object' &&
                          state.selectedOptions !== null &&
                          (quiz as any).subQuizs?.some(
                            (subQuiz: any) =>
                              state.selectedOptions[subQuiz.subQuizId] &&
                              state.selectedOptions[subQuiz.subQuizId] !== '',
                          )) ||
                        (quiz.type === 'B' &&
                          typeof state.selectedOptions === 'object' &&
                          state.selectedOptions !== null &&
                          (quiz as any).questions?.some(
                            (question: any) =>
                              state.selectedOptions[question.questionId] &&
                              state.selectedOptions[question.questionId] !== '',
                          )) ||
                        (quiz.type !== 'X' &&
                          quiz.type !== 'A3' &&
                          quiz.type !== 'B' &&
                          typeof state.selectedOptions === 'string' &&
                          state.selectedOptions !== '')
                      ) {
                        status = 'selected';
                      }

                      return (
                        <div
                          key={index}
                          className={`w-10 h-10 rounded-md flex items-center justify-center text-xs font-bold cursor-pointer border-2 transition-all hover:scale-105 ${
                            index === currentQuizIndex
                              ? 'border-primary ring-2 ring-primary/20'
                              : status === 'correct'
                                ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                                : status === 'wrong'
                                  ? 'border-destructive bg-red-50 dark:bg-red-950/20'
                                  : status === 'selected'
                                    ? 'border-primary bg-primary/10'
                                    : 'border-border bg-card hover:bg-muted'
                          }`}
                          onClick={() => {
                            setCurrentQuizIndex(index);
                            if (setCurrentQuiz) {
                              setCurrentQuiz(index);
                            }
                          }}
                        >
                          {index + 1}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 pt-0">
                  <Button onClick={handleUnifiedSubmit} className="w-full">
                    提交所有答案
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  },
);

Page.displayName = 'QuizPage';

export default Page;
