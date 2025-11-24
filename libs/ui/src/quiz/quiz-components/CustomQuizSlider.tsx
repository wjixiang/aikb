import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import Quiz, { QuizImperativeHandle } from "../Quiz";
import { QuizType } from "quiz-shared";

interface CustomQuizSliderProps {
  quizzesWithCombinedAnswers: QuizType.QuizWithUserAnswer[];
  quizSetId?: string;
  quizRefs: React.MutableRefObject<Array<React.RefObject<QuizImperativeHandle | null>>>;
  handleBackToGrid: () => void;
  currentQuizIndex: number;
  setCurrentQuizIndex: React.Dispatch<React.SetStateAction<number>>;
  onAnswerChange: (quizId: string, answer: QuizType.answerType) => Promise<void>;
  onSimilarQuizzesFound: (similarQuizzes: QuizType.QuizWithUserAnswer[]) => void;
  isTestMode?: boolean;
  back: () => void;
  forward: () => void;
}

const CustomQuizSlider: React.FC<CustomQuizSliderProps> = ({
  quizzesWithCombinedAnswers,
  quizSetId,
  quizRefs,
  handleBackToGrid,
  currentQuizIndex,
  setCurrentQuizIndex,
  onAnswerChange,
  onSimilarQuizzesFound,
  isTestMode = false,
  back,
  forward,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 滚动到指定索引
  const scrollToIndex = useCallback((index: number) => {
    if (!containerRef.current || isTransitioning) return;
    
    const container = containerRef.current;
    const slideWidth = container.offsetWidth;
    const scrollLeft = index * slideWidth;
    
    setIsTransitioning(true);
    container.scrollTo({
      left: scrollLeft,
      behavior: 'smooth'
    });
    
    // 过渡结束后重置状态
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  }, [isTransitioning]);

  // 监听滚动事件，更新当前索引
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isTransitioning) return;
      
      const slideWidth = container.offsetWidth;
      const scrollLeft = container.scrollLeft;
      const newIndex = Math.round(scrollLeft / slideWidth);
      
      if (newIndex !== currentQuizIndex && newIndex >= 0 && newIndex < quizzesWithCombinedAnswers.length) {
        setCurrentQuizIndex(newIndex);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentQuizIndex, setCurrentQuizIndex, quizzesWithCombinedAnswers.length, isTransitioning]);

  // 当 currentQuizIndex 变化时，滚动到对应位置
  useEffect(() => {
    // 使用 requestAnimationFrame 确保 DOM 更新后再跳转
    const timer = requestAnimationFrame(() => {
      scrollToIndex(currentQuizIndex);
    });
    
    return () => cancelAnimationFrame(timer);
  }, [currentQuizIndex, scrollToIndex]);

  // 处理键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        forward();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [back, forward]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full overflow-x-auto overflow-y-hidden scroll-smooth"
      style={{ scrollSnapType: 'x mandatory' }}
    >
      <div className="flex h-full" style={{ width: `${quizzesWithCombinedAnswers.length * 100}%` }}>
        {quizzesWithCombinedAnswers.map((quiz, index) => (
          <div
            key={index}
            className="h-full flex-shrink-0"
            style={{ 
              width: `${100 / quizzesWithCombinedAnswers.length}%`,
              scrollSnapAlign: 'start'
            }}
          >
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
              onSimilarQuizzesFound={onSimilarQuizzesFound}
              isTestMode={isTestMode}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomQuizSlider;