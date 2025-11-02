"use client";

import React, {
  forwardRef,
  useEffect,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UnifiedTagManager from "./UnifiedTagManager";
import {
  TopBar,
  InfoBar,
  HideScrollbar,
} from "./styles/QuizStyles";
import { QuizWithUserAnswer, answerType } from "@/types/quizData.types";
import { useQuizLogic } from "./hooks/useQuizLogic";
import { QuizContent } from "./components/QuizContent";
import { AnswerSection } from "./components/AnswerSection";
import { PracticeHistory } from "./components/PracticeHistory";
import { LinkBox } from "./LinkBox";

interface QuizComponentProps {
  quiz: QuizWithUserAnswer;
  quizSetId?: string;
  handleBackToGrid: () => void;
  currentQuizIndex: number;
  thisQuizIndex: number;
  back: () => void;
  forward: () => void;
  onAnswerChange: (quizId: string, answer: answerType) => Promise<void>;
  onSimilarQuizzesFound: (similarQuizzes: QuizWithUserAnswer[]) => void;
  isTestMode?: boolean;
}

export interface QuizImperativeHandle {
  getCurrentState: () => {
    submitted: boolean;
    isCorrect: boolean;
    selectedOptions: string;
    subQuestionCorrectness: Record<number, boolean>;
  };
}

const QuizComponent = forwardRef<QuizImperativeHandle, QuizComponentProps>(
  (
    {
      quiz,
      quizSetId,
      handleBackToGrid,
      currentQuizIndex,
      thisQuizIndex,
      back,
      forward,
      onAnswerChange,
      onSimilarQuizzesFound,
      isTestMode = false,
    },
    ref,
  ) => {
    const {
      submitted,
      selected,
      isCorrect,
      subQuestionCorrectness,
      practiceHistory,
      loadingPracticeHistory,
      errorPracticeHistory,
      isFindingSimilar,
      useClassFilter,
      useSourceFilter,
      topK,
      getShuffledOptions,
      handleOptionSelect,
      handleSubmit,
      handleDifficultSubmit,
      handleFindSimilar,
      setUseClassFilter,
      setUseSourceFilter,
      setTopK,
      getCurrentState,
      fetchPracticeHistory,
    } = useQuizLogic({
      quiz,
      quizSetId,
      onAnswerChange,
      currentQuizIndex,
      thisQuizIndex,
      isTestMode,
    });

    const { data: session, status } = useSession();
    const isAuthenticated = status === "authenticated";
    
    // State for tracking active sub-question in A3/B type questions
    const [activeSubQuestionIndex, setActiveSubQuestionIndex] = useState(0);
    const [isKeyboardNavigation, setIsKeyboardNavigation] = useState(false);

    // Reset active sub-question when quiz changes
    useEffect(() => {
      setActiveSubQuestionIndex(0);
    }, [quiz._id]);


    // Keyboard event handling
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        // Only handle keyboard events for the currently active quiz
        if (currentQuizIndex !== thisQuizIndex) {
          return;
        }

        // Skip shortcuts when typing in input elements (textarea, input, etc.)
        const target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }

        // Skip shortcuts when sidebar is open or has focus
        const sidebar = document.querySelector('[class*="translate-x-0"]');
        if (sidebar) {
          return;
        }

        // Handle Tab navigation for A3/B type questions
        if (event.key === "Tab" && (quiz.type === "A3" || quiz.type === "B")) {
          event.preventDefault();
          setIsKeyboardNavigation(true);

          const subQuestions =
            quiz.type === "A3"
              ? (quiz as any).subQuizs
              : (quiz as any).questions;
          if (!subQuestions || subQuestions.length === 0) return;

          if (event.shiftKey) {
            // Shift+Tab: move to previous sub-question
            setActiveSubQuestionIndex((prev) =>
              prev === 0 ? subQuestions.length - 1 : prev - 1,
            );
          } else {
            // Tab: move to next sub-question
            setActiveSubQuestionIndex(
              (prev) => (prev + 1) % subQuestions.length,
            );
          }
          return;
        }

        // Handle option selection shortcuts 1-5 for current sub-question
        if (event.key >= "1" && event.key <= "5") {
          const optionIndex = parseInt(event.key) - 1;

          if (quiz.type === "A1" || quiz.type === "A2") {
            const shuffledOptions = getShuffledOptions((quiz as any).options);
            if (shuffledOptions && shuffledOptions[optionIndex]) {
              handleOptionSelect(shuffledOptions[optionIndex].oid);
            }
          } else if (quiz.type === "X") {
            const shuffledOptions = getShuffledOptions((quiz as any).options);
            if (shuffledOptions && shuffledOptions[optionIndex]) {
              handleOptionSelect(shuffledOptions[optionIndex].oid);
            }
          } else if (quiz.type === "A3") {
            // For A3-type questions: each sub-question has its own options
            const subQuestions = (quiz as any).subQuizs;
            if (
              subQuestions &&
              subQuestions.length > 0 &&
              activeSubQuestionIndex < subQuestions.length
            ) {
              const currentSubQuestion = subQuestions[activeSubQuestionIndex];
              if (
                currentSubQuestion &&
                currentSubQuestion.options &&
                optionIndex < currentSubQuestion.options.length
              ) {
                const shuffledOptions = getShuffledOptions(
                  currentSubQuestion.options,
                  currentSubQuestion.subQuizId,
                );
                if (shuffledOptions && shuffledOptions[optionIndex]) {
                  const questionKey = currentSubQuestion.subQuizId;
                  handleOptionSelect(
                    shuffledOptions[optionIndex].oid,
                    questionKey,
                  );
                }
              }
            }
          } else if (quiz.type === "B") {
            // For B-type questions: all questions share the same options at quiz level
            const questions = (quiz as any).questions;
            if (
              questions &&
              questions.length > 0 &&
              activeSubQuestionIndex < questions.length
            ) {
              const currentQuestion = questions[activeSubQuestionIndex];
              const shuffledOptions = getShuffledOptions(
                (quiz as any).options,
                currentQuestion.questionId,
              );
              if (shuffledOptions && shuffledOptions[optionIndex]) {
                const questionKey = currentQuestion.questionId;
                handleOptionSelect(
                  shuffledOptions[optionIndex].oid,
                  questionKey,
                );
              }
            }
          }
        }
        // Handle Enter or Space for submission
        else if ((event.key === "Enter" || event.key === " ") && !submitted) {
          handleSubmit();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
      currentQuizIndex,
      quiz.type,
      selected,
      handleOptionSelect,
      handleSubmit,
      thisQuizIndex,
      activeSubQuestionIndex,
      submitted,
    ]);

    // Reset keyboard navigation when clicking outside
    useEffect(() => {
      const handleClick = () => {
        setIsKeyboardNavigation(false);
      };

      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }, []);

    // Expose imperative handle
    React.useImperativeHandle(
      ref,
      () => ({
        getCurrentState,
      }),
      [getCurrentState],
    );


    return (
      <HideScrollbar
        id={`quiz-${thisQuizIndex}`}
        className="w-full p-2 mb-10 h-full overflow-y-auto"
      >
        <InfoBar className="flex items-center gap-2 flex-wrap pb-2 mb-2">
          <Badge variant="secondary">{quiz.type}型题</Badge>
          <Badge variant="outline">{quiz.class}</Badge>
          <Badge variant="outline">{quiz.source}</Badge>
        </InfoBar>


        <HideScrollbar className="h-full overflow-y-auto">
          <QuizContent
            quiz={quiz}
            selected={selected}
            submitted={submitted}
            subQuestionCorrectness={subQuestionCorrectness}
            onOptionSelect={handleOptionSelect}
            activeSubQuestionIndex={activeSubQuestionIndex}
            isKeyboardNavigation={isKeyboardNavigation}
            getShuffledOptions={getShuffledOptions}
          />

          <TopBar>
            {!submitted && !isTestMode && (
              <div className="flex w-full space-x-2 pb-[100px]">
                <Button
                  onClick={handleDifficultSubmit}
                  className="flex-grow bg-red-500 hover:bg-red-600 text-white"
                >
                  困难
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-grow bg-green-500 hover:bg-green-600 text-white"
                >
                  简单
                </Button>
              </div>
            )}
          </TopBar>

  
          <UnifiedTagManager quizId={quiz._id} currentQuizIndex={currentQuizIndex} quizIndex={thisQuizIndex}/>
           

          {submitted && (
            <div className="space-y-6">
              <PracticeHistory
                submitted={submitted}
                practiceHistory={practiceHistory}
                loading={loadingPracticeHistory}
                error={errorPracticeHistory}
                isCorrect={isCorrect}
                quiz={quiz}
                onRefresh={() => {
                  if (isAuthenticated && session?.user?.email) {
                    fetchPracticeHistory(quiz._id, session.user.email);
                  }
                }}
              />
          
          

              <div className="mt-4">
                <LinkBox isloading={false} links={[]} />
              </div>

              <div className="mt-6 w-full">
                <AnswerSection
                  quiz={quiz}
                  submitted={submitted}
                  isCorrect={isCorrect}
                  subQuestionCorrectness={subQuestionCorrectness}
                  getShuffledOptions={getShuffledOptions}
                />
              </div>
            </div>
          )}


          {/* {submitted && (
            <Card className="mt-4 pt-4 w-full">
              <CardTitle className="text-lg font-semibold mb-2 pl-4">
                获取相似试题
              </CardTitle>
              <CardContent className="gap-2 w-full">
                <Toggle
                  pressed={useClassFilter}
                  onPressedChange={setUseClassFilter}
                  aria-label="Toggle class filter"
                >
                  {useClassFilter ? "按科目筛选 (开)" : "按科目筛选 (关)"}
                </Toggle>
                <Toggle
                  pressed={useSourceFilter}
                  onPressedChange={setUseSourceFilter}
                  aria-label="Toggle source filter"
                >
                  {useSourceFilter ? "按来源筛选 (开)" : "按来源筛选 (关)"}
                </Toggle>
                <div className="flex items-center space-x-2 flex-grow">
                  <span className="text-sm text-muted-foreground">
                    题数: {topK[0]}
                  </span>
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={topK}
                    onValueChange={setTopK}
                    className="w-[100px]"
                  />
                </div>
                <Button
                  onClick={handleFindSimilar}
                  className="flex-grow bg-blue-500 hover:bg-blue-600 text-white"
                  disabled={isFindingSimilar}
                >
                  {isFindingSimilar ? "查找中..." : "查找相似试题"}
                </Button>
              </CardContent>
            </Card>
          )} */}
        </HideScrollbar>
      </HideScrollbar>
    );
  },
);

QuizComponent.displayName = "QuizComponent";

export default QuizComponent;
