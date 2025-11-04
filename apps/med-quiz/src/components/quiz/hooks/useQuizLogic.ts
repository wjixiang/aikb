import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { QuizWithUserAnswer, answerType } from '@/types/quizData.types';
import { PracticeRecordData } from '@/lib/quiz/QuizStorage';
import { shuffleArray } from '@/lib/utils';

interface UseQuizLogicProps {
  quiz: QuizWithUserAnswer;
  quizSetId?: string;
  onAnswerChange: (quizId: string, answer: answerType) => Promise<void>;
  currentQuizIndex: number;
  thisQuizIndex: number;
  onQuizSubmit?: () => void;
  isTestMode?: boolean;
}

interface UseQuizLogicReturn {
  submitted: boolean;
  selected: any;
  isCorrect: boolean;
  subQuestionCorrectness: Record<number, boolean>; // For A3/B type questions
  isMounted: boolean;
  practiceHistory: PracticeRecordData[] | null;
  loadingPracticeHistory: boolean;
  errorPracticeHistory: string | null;
  tags: string[];
  allAvailableTags: string[];
  quizTags: string[];
  isFindingSimilar: boolean;
  useClassFilter: boolean;
  useSourceFilter: boolean;
  topK: number[];
  shuffledOptionsMap: Record<string, any[]>;
  getShuffledOptions: (options: any[], questionId?: string | number) => any[];
  handleOptionSelect: (
    oid: string,
    questionKey?: number,
    isDoubleClick?: boolean,
  ) => void;
  handleSubmit: () => void;
  handleDifficultSubmit: () => void;
  handleFindSimilar: () => Promise<void>;
  setUseClassFilter: (value: boolean) => void;
  setUseSourceFilter: (value: boolean) => void;
  setTopK: (value: number[]) => void;
  fetchQuizTags: () => Promise<void>;
  fetchPracticeHistory: (quizId: string, userId: string) => Promise<void>;
  getCurrentState: () => {
    submitted: boolean;
    isCorrect: boolean;
    selectedOptions: string;
    subQuestionCorrectness: Record<number, boolean>;
  };
}

export const useQuizLogic = ({
  quiz,
  quizSetId,
  onAnswerChange,
  currentQuizIndex,
  thisQuizIndex,
  onQuizSubmit,
  isTestMode,
}: UseQuizLogicProps): UseQuizLogicReturn => {
  const [submitted, setSubmitted] = useState(false);
  const [selected, setSelected] = useState<any>(
    quiz.type === 'X' ? [] : quiz.type === 'A3' || quiz.type === 'B' ? {} : '',
  );
  const [isCorrect, setIsCorrect] = useState(false);
  const [subQuestionCorrectness, setSubQuestionCorrectness] = useState<
    Record<number, boolean>
  >({});
  const [isMounted, setIsMounted] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState<
    PracticeRecordData[] | null
  >(null);
  const [loadingPracticeHistory, setLoadingPracticeHistory] = useState(false);
  const [errorPracticeHistory, setErrorPracticeHistory] = useState<
    string | null
  >(null);
  const [tags, setTags] = useState<string[]>([]);
  const [allAvailableTags, setAllAvailableTags] = useState<string[]>([]);
  const [quizTags, setQuizTags] = useState<string[]>([]);
  const [isFindingSimilar, setIsFindingSimilar] = useState(false);
  const [useClassFilter, setUseClassFilter] = useState(false);
  const [useSourceFilter, setUseSourceFilter] = useState(false);
  const [topK, setTopK] = useState<number[]>([3]);
  const [shuffledOptionsMap, setShuffledOptionsMap] = useState<
    Record<string, any[]>
  >({});

  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  // Generate storage key for persisting user selections
  const getStorageKey = useCallback(() => {
    if (quizSetId) {
      return `quiz_selection_${quizSetId}_${quiz._id}`;
    }
    return `quiz_selection_${quiz._id}`;
  }, [quizSetId, quiz._id]);

  // Fetch quiz tags
  const fetchQuizTags = useCallback(async () => {
    try {
      const response = await fetch(`/api/quiz/${quiz._id}/tags`);
      if (!response.ok) throw new Error('Failed to fetch quiz tags');
      const data = await response.json();
      const tags = Array.isArray(data)
        ? data
        : data.tags
          ? data.tags.map((t: any) => t.value)
          : data.value
            ? [data.value]
            : [];
      setQuizTags(tags);
    } catch (error) {
      console.error('Error fetching quiz tags:', error);
      setQuizTags([]);
    }
  }, [quiz._id]);

  // Function to get shuffled options for a question
  const getShuffledOptions = useCallback(
    (options: any[], questionId?: string | number): any[] => {
      const id = questionId ? `${quiz._id}-${questionId}` : quiz._id;

      // Return pre-shuffled options if available, otherwise return original options
      if (shuffledOptionsMap[id]) {
        return shuffledOptionsMap[id];
      }

      // Fallback to original options if not shuffled yet
      return options;
    },
    [quiz._id, shuffledOptionsMap],
  );

  // Fetch all available tags
  // useEffect(() => {
  //   setIsMounted(true);
  //   const fetchAllTags = async () => {
  //     try {
  //       const response = await fetch('/api/quiz/tags');
  //       if (!response.ok) {
  //         throw new Error(`HTTP error! status: ${response.status}`);
  //       }
  //       const data: string[] = await response.json();
  //       setAllAvailableTags(data);
  //     } catch (error) {
  //       console.error("Failed to fetch all available tags:", error);
  //     }
  //   };
  //   fetchAllTags();
  //   fetchQuizTags();
  //   return () => setIsMounted(false);
  // }, [quiz._id, session?.user?.email, fetchQuizTags]);

  // Initialize quiz state based on user answer and fetch practice history
  useEffect(() => {
    // Fetch practice history when quiz changes
    // if (isAuthenticated && session?.user?.email) {
    //   fetchPracticeHistory(quiz._id, session.user.email);
    // }

    // Check for saved selection in sessionStorage
    const storageKey = getStorageKey();
    const savedSelection = sessionStorage.getItem(storageKey);

    // Initialize quiz state based on user answer or saved selection
    if (quiz.userAnswer !== undefined && quiz.userAnswer !== null) {
      setSelected(quiz.userAnswer);
      setSubmitted(true);

      let correct = false;
      const subQuestionCorrectnessMap: Record<number, boolean> = {};
      switch (quiz.type) {
        case 'A1':
        case 'A2':
          correct = quiz.userAnswer === (quiz as any).answer;
          break;
        case 'X':
          if (Array.isArray(quiz.userAnswer)) {
            correct =
              JSON.stringify(quiz.userAnswer.sort()) ===
              JSON.stringify((quiz as any).answer.sort());
          }
          break;
        case 'A3':
          correct = (quiz as any).subQuizs.every((sub: any) => {
            const isSubCorrect =
              (quiz.userAnswer as Record<number, string>)[sub.subQuizId] ===
              sub.answer;
            subQuestionCorrectnessMap[sub.subQuizId] = isSubCorrect;
            return isSubCorrect;
          });
          break;
        case 'B':
          correct = (quiz as any).questions.every((q: any) => {
            const isSubCorrect =
              (quiz.userAnswer as Record<number, string>)[q.questionId] ===
              q.answer;
            subQuestionCorrectnessMap[q.questionId] = isSubCorrect;
            return isSubCorrect;
          });
          break;
      }
      setIsCorrect(correct);
      setSubQuestionCorrectness(subQuestionCorrectnessMap);
      // Clear saved selection if user answer exists
      sessionStorage.removeItem(storageKey);
    } else if (savedSelection && !submitted) {
      try {
        const parsed = JSON.parse(savedSelection);
        if (parsed.selected !== undefined) {
          setSelected(parsed.selected);
          // Don't set submitted to true for saved selections
        }
      } catch (error) {
        console.warn(
          'Failed to restore quiz selection from sessionStorage:',
          error,
        );
        setSelected(
          quiz.type === 'X'
            ? []
            : quiz.type === 'A3' || quiz.type === 'B'
              ? {}
              : '',
        );
      }
    } else {
      setSubmitted(false);
      setSelected(
        quiz.type === 'X'
          ? []
          : quiz.type === 'A3' || quiz.type === 'B'
            ? {}
            : '',
      );
      setPracticeHistory(null);
    }
  }, [
    quiz._id,
    isAuthenticated,
    session?.user?.email,
    quiz.userAnswer,
    quiz.type,
    submitted,
    getStorageKey,
  ]);

  // Generate shuffled options when quiz changes
  useEffect(() => {
    // Check if we already have shuffled options for this quiz
    const quizId = quiz._id;
    if (shuffledOptionsMap[quizId]) {
      // We already have shuffled options for this quiz, don't reshuffle
      return;
    }

    const newShuffledOptionsMap: Record<string, any[]> = {
      ...shuffledOptionsMap,
    };

    // Generate shuffled options for each question type
    if (
      (quiz.type === 'A1' || quiz.type === 'A2' || quiz.type === 'X') &&
      'options' in quiz
    ) {
      const id = quiz._id;
      newShuffledOptionsMap[id] = shuffleArray(quiz.options);
    } else if (quiz.type === 'A3' && 'subQuizs' in quiz) {
      quiz.subQuizs.forEach((subQuiz: any) => {
        const id = `${quiz._id}-${subQuiz.subQuizId}`;
        newShuffledOptionsMap[id] = shuffleArray(subQuiz.options);
      });
    } else if (quiz.type === 'B' && 'options' in quiz && 'questions' in quiz) {
      // For B type, options are shared across all questions
      const id = quiz._id;
      newShuffledOptionsMap[id] = shuffleArray(quiz.options);

      // Also add individual question IDs that map to the same shuffled options
      (quiz as any).questions.forEach((question: any) => {
        const questionId = `${quiz._id}-${question.questionId}`;
        newShuffledOptionsMap[questionId] = newShuffledOptionsMap[id];
      });
    }

    setShuffledOptionsMap(newShuffledOptionsMap);
  }, [quiz._id]);

  // Handle option selection
  const handleOptionSelect = useCallback(
    (oid: string, questionKey?: number, isDoubleClick = false) => {
      if (submitted) return;

      let newSelected;
      if (quiz.type === 'A1' || quiz.type === 'A2') {
        newSelected = oid;
        setSelected(oid);
      } else if (quiz.type === 'X') {
        if (Array.isArray(selected)) {
          if (selected.includes(oid)) {
            newSelected = selected.filter((item: string) => item !== oid);
            setSelected(newSelected);
          } else {
            newSelected = [...selected, oid];
            setSelected(newSelected);
          }
        }
      } else if (quiz.type === 'A3' || quiz.type === 'B') {
        newSelected = { ...selected, [questionKey as number]: oid };
        setSelected(newSelected);
      }

      // Save selection to sessionStorage
      if (!submitted) {
        const storageKey = getStorageKey();
        try {
          const dataToSave = {
            selected: newSelected,
            timestamp: new Date().toISOString(),
          };
          sessionStorage.setItem(storageKey, JSON.stringify(dataToSave));
        } catch (error) {
          console.warn(
            'Failed to save quiz selection to sessionStorage:',
            error,
          );
        }
      }

      if (isDoubleClick) {
        const isOptionSelected =
          quiz.type === 'A1' || quiz.type === 'A2'
            ? newSelected === oid
            : quiz.type === 'X'
              ? Array.isArray(newSelected) && newSelected.includes(oid)
              : quiz.type === 'A3' || quiz.type === 'B'
                ? newSelected[questionKey as number] === oid
                : false;

        if (isOptionSelected) {
          handleSubmit();
        }
      }
    },
    [quiz.type, selected, submitted, quiz._id],
  );

  // Removed handleKeyboardOptionSelect as we're simplifying to use handleOptionSelect for all cases

  // Check if user has made any selection
  const hasSelection = (): boolean => {
    switch (quiz.type) {
      case 'A1':
      case 'A2':
        return selected !== '';
      case 'X':
        return Array.isArray(selected) && selected.length > 0;
      case 'A3':
        return quiz.subQuizs.every(
          (sub: any) => selected[sub.subQuizId] !== undefined,
        );
      case 'B':
        return quiz.questions.every(
          (q: any) => selected[q.questionId] !== undefined,
        );
      default:
        return false;
    }
  };

  // Get incomplete sub-questions count
  const getIncompleteSubQuestions = (): string[] => {
    const incomplete: string[] = [];

    if (quiz.type === 'A3') {
      quiz.subQuizs.forEach((sub: any) => {
        if (selected[sub.subQuizId] === undefined) {
          incomplete.push(sub.question || `子题 ${sub.subQuizId}`);
        }
      });
    } else if (quiz.type === 'B') {
      quiz.questions.forEach((q: any, index: number) => {
        if (selected[q.questionId] === undefined) {
          incomplete.push(q.questionText || `问题 ${index + 1}`);
        }
      });
    }

    return incomplete;
  };

  // Calculate if answer is correct
  const calculateCorrectness = (selectedAnswer: any): boolean => {
    const subQuestionCorrectnessMap: Record<number, boolean> = {};
    let isOverallCorrect = false;

    switch (quiz.type) {
      case 'A1':
      case 'A2':
        isOverallCorrect = selectedAnswer === quiz.answer;
        break;
      case 'X':
        if (Array.isArray(selectedAnswer)) {
          isOverallCorrect =
            JSON.stringify(selectedAnswer.sort()) ===
            JSON.stringify(quiz.answer.sort());
        }
        break;
      case 'A3':
        isOverallCorrect = quiz.subQuizs.every((sub: any) => {
          const isSubCorrect = selectedAnswer[sub.subQuizId] === sub.answer;
          subQuestionCorrectnessMap[sub.subQuizId] = isSubCorrect;
          return isSubCorrect;
        });
        break;
      case 'B':
        isOverallCorrect = quiz.questions.every((q: any) => {
          const isSubCorrect = selectedAnswer[q.questionId] === q.answer;
          subQuestionCorrectnessMap[q.questionId] = isSubCorrect;
          return isSubCorrect;
        });
        break;
      default:
        isOverallCorrect = false;
    }

    // Update sub-question correctness state for A3/B types
    if (quiz.type === 'A3' || quiz.type === 'B') {
      setSubQuestionCorrectness(subQuestionCorrectnessMap);
    }

    return isOverallCorrect;
  };

  // Submit answer
  const handleSubmit = useCallback(() => {
    // In test mode, don't submit internally
    if (isTestMode) {
      setSubmitted(true);
      const correct = calculateCorrectness(selected);
      setIsCorrect(correct);
      return;
    }

    if (!isAuthenticated) {
      toast.error('需要登录', {
        description: '请先登录后再提交答案',
        action: {
          label: '去登录',
          onClick: () => {
            window.location.href = '/auth/signin';
          },
        },
        duration: 5000,
      });
      return;
    }

    if (!hasSelection()) {
      const incomplete = getIncompleteSubQuestions();

      if (quiz.type === 'A3' || quiz.type === 'B') {
        if (incomplete.length > 0) {
          toast.error('请完成所有子题', {
            description: `还有 ${incomplete.length} 个子题未完成`,
            duration: 3000,
          });
          return;
        }
      } else {
        toast.error('请先选择答案', {
          description: '您还没有选择任何选项',
          duration: 2000,
        });
        return;
      }
    }

    setSubmitted(true);
    const correct = calculateCorrectness(selected);
    setIsCorrect(correct);

    // Clear saved selection from sessionStorage
    const storageKey = getStorageKey();
    sessionStorage.removeItem(storageKey);

    pushRecord(correct);
    onAnswerChange(quiz._id, selected);

    if (isAuthenticated && session?.user?.email) {
      fetchPracticeHistory(quiz._id, session.user.email);
    }

    // Call the onQuizSubmit callback if provided
    if (onQuizSubmit) {
      onQuizSubmit();
    }

    // Dispatch custom event for practice record browser refresh
    const quizSubmitEvent = new CustomEvent('quizSubmitted', {
      detail: { quizId: quiz._id, timestamp: new Date() },
    });
    window.dispatchEvent(quizSubmitEvent);
  }, [
    isAuthenticated,
    selected,
    quiz,
    onAnswerChange,
    isTestMode,
    session?.user?.email,
  ]);

  // Handle difficult submission
  const handleDifficultSubmit = useCallback(() => {
    // In test mode, don't submit internally
    if (isTestMode) {
      setSubmitted(true);
      setIsCorrect(false);
      return;
    }

    if (!isAuthenticated) {
      toast.error('需要登录', {
        description: '请先登录后再提交答案',
        action: {
          label: '去登录',
          onClick: () => {
            window.location.href = '/auth/signin';
          },
        },
        duration: 5000,
      });
      return;
    }

    if (!hasSelection()) {
      const incomplete = getIncompleteSubQuestions();

      if (quiz.type === 'A3' || quiz.type === 'B') {
        if (incomplete.length > 0) {
          toast.error('请完成所有子题', {
            description: `还有 ${incomplete.length} 个子题未完成`,
            duration: 3000,
          });
          return;
        }
      } else {
        toast.error('请先选择答案', {
          description: '您还没有选择任何选项',
          duration: 2000,
        });
        return;
      }
    }

    setSubmitted(true);
    setIsCorrect(false);

    // For A3/B types, also reset sub-question correctness
    if (quiz.type === 'A3' || quiz.type === 'B') {
      const subQuestionIds =
        quiz.type === 'A3'
          ? (quiz as any).subQuizs.map((sub: any) => sub.subQuizId)
          : (quiz as any).questions.map((q: any) => q.questionId);
      const resetCorrectness: Record<number, boolean> = {};
      subQuestionIds.forEach((id: number) => {
        resetCorrectness[id] = false;
      });
      setSubQuestionCorrectness(resetCorrectness);
    }

    // Clear saved selection from sessionStorage
    const storageKey = getStorageKey();
    sessionStorage.removeItem(storageKey);

    pushRecord(false);
    onAnswerChange(quiz._id, selected);

    if (isAuthenticated && session?.user?.email) {
      fetchPracticeHistory(quiz._id, session.user.email);
    }

    // Call the onQuizSubmit callback if provided
    if (onQuizSubmit) {
      onQuizSubmit();
    }

    // Dispatch custom event for practice record browser refresh
    const quizSubmitEvent = new CustomEvent('quizSubmitted', {
      detail: { quizId: quiz._id, timestamp: new Date() },
    });
    window.dispatchEvent(quizSubmitEvent);
  }, [
    isAuthenticated,
    selected,
    quiz,
    onAnswerChange,
    isTestMode,
    session?.user?.email,
  ]);

  // Push practice record
  const pushRecord = async (isCorrect: boolean) => {
    if (!isAuthenticated) return;

    try {
      const practice_record = {
        quizid: quiz._id,
        selectrecord: selected,
        correct: isCorrect,
        subject: quiz.class,
        timestamp: new Date(),
      };

      const response = await fetch('/api/quiz/practice-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(practice_record),
      });

      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }

      if (isCorrect) {
        toast.success('回答正确', {
          style: {
            backgroundColor: '#4caf50',
            color: 'white',
          },
          duration: 1000,
        });
      } else {
        toast.warning('回答错误', {
          style: {
            backgroundColor: '#af4c4c',
            color: 'white',
          },
          duration: 1000,
        });
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast.error('提交失败', {
        description: '无法保存您的答案，请稍后再试',
      });
    }
  };

  // Fetch practice history
  const fetchPracticeHistory = async (quizId: string, userId: string) => {
    setLoadingPracticeHistory(true);
    setErrorPracticeHistory(null);
    try {
      const response = await fetch(
        `/api/quiz/practice-history?quizId=${quizId}&userId=${userId}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setPracticeHistory(data);
    } catch (error: any) {
      setErrorPracticeHistory(error.message);
      console.error('Failed to fetch practice history:', error);
    } finally {
      setLoadingPracticeHistory(false);
    }
    return Promise.resolve();
  };

  // Handle finding similar quizzes
  const handleFindSimilar = async () => {
    setIsFindingSimilar(true);
    try {
      const requestBody: {
        quizId: string;
        top_k: number;
        class?: string;
        source?: string;
      } = {
        quizId: quiz._id,
        top_k: topK[0],
      };

      if (useClassFilter) {
        requestBody.class = quiz.class;
      }
      if (useSourceFilter) {
        requestBody.source = quiz.source;
      }

      const response = await fetch('/api/quiz/similar-quizzes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to find similar quizzes');
      }

      const similarQuizzes = await response.json();
      toast.success(`找到 ${similarQuizzes.length} 个相似试题`);
    } catch (error: any) {
      console.error('Error finding similar quizzes:', error);
      toast.error(`查找相似试题失败: ${error.message}`);
    } finally {
      setIsFindingSimilar(false);
    }
  };

  // Get current state for imperative handle
  const getCurrentState = () => ({
    submitted,
    isCorrect,
    selectedOptions: selected,
    subQuestionCorrectness,
  });

  return {
    submitted,
    selected,
    isCorrect,
    subQuestionCorrectness,
    isMounted,
    practiceHistory,
    loadingPracticeHistory,
    errorPracticeHistory,
    tags,
    allAvailableTags,
    quizTags,
    isFindingSimilar,
    useClassFilter,
    useSourceFilter,
    topK,
    shuffledOptionsMap,
    getShuffledOptions,
    handleOptionSelect,
    handleSubmit,
    handleDifficultSubmit,
    handleFindSimilar,
    setUseClassFilter,
    setUseSourceFilter,
    setTopK,
    fetchQuizTags,
    fetchPracticeHistory,
    getCurrentState,
  };
};
