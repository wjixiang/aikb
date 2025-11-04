'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { answerType, QuizWithUserAnswer } from '@/types/quizData.types';
import { QuizHistoryItem } from '@/types/quizSet.types';
import { NotificationState } from './types';
import { sortQuizzesByType } from './utils';
import { formQuizContent } from '@/lib/utils';

export const useQuizAI = () => {
  const { data: session } = useSession();
  const [quizzes, setQuizzes] = useState<QuizWithUserAnswer[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isQuizFetching, setIsQuizFetching] = useState(false);
  const [loadingOperation, setLoadingOperation] = useState<string | null>(null);
  const [currentQuizSetId, setCurrentQuizSetId] = useState<string | null>(null);
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [notification, setNotification] = useState<NotificationState>({
    message: '',
    type: 'success',
  });
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isTabsExpanded, setIsTabsExpanded] = useState(true);
  const [selectedQuizIndex, setSelectedQuizIndex] = useState<number | null>(
    null,
  );
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectorDrawerOpen, setSelectorDrawerOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [quizStateUpdateTrigger, setQuizStateUpdateTrigger] = useState(0);

  // Refs for auto-save functionality
  const prevQuizzesRef = useRef<QuizWithUserAnswer[]>([]);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setNotificationVisible(true);
    setTimeout(() => setNotificationVisible(false), 3000);
  };

  const addQuizToPage = (quiz: QuizWithUserAnswer[]) => {
    setQuizzes((prev) => sortQuizzesByType([...prev, ...quiz]));
  };

  const handleSubmit = async (
    quizzesToSubmit: QuizWithUserAnswer[],
    customTitle?: string,
  ) => {
    if (!session?.user?.email) {
      showNotification('请先登录', 'error');
      return;
    }

    if (!quizzesToSubmit || quizzesToSubmit.length === 0) {
      showNotification('请先添加试题', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/quiz/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: customTitle || `试卷-${new Date().toLocaleString('zh-CN')}`,
          quizIds: quizzesToSubmit.map((quiz) => quiz._id),
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || '保存失败');
      }

      const result = await response.json();
      setCurrentQuizSetId(result.id);
      setQuizStateUpdateTrigger((prev) => prev + 1);
      showNotification('试卷创建成功', 'success');
      // Reload history after successful creation
      await loadHistory();
    } catch (error) {
      console.error(error);
      showNotification(
        error instanceof Error ? error.message : '保存试卷时出错',
        'error',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    // Removed full quiz set synchronization
    // Only individual quiz answers are now synchronized
    console.log(
      'Full quiz set synchronization disabled - only individual answers are synced',
    );
  };

  const handleAnswerChange = async (
    quizId: string,
    answer: answerType,
    silent: boolean = false,
    quizzesForQuizSet?: QuizWithUserAnswer[],
  ) => {
    if (!session?.user?.email) {
      if (!silent) {
        showNotification('请先登录', 'error');
      }
      return;
    }

    // Use provided quizzes or fall back to local state
    const quizzesToUse = quizzesForQuizSet || quizzes;

    // If no quiz set ID exists, create a minimal quiz set first
    let effectiveQuizSetId = currentQuizSetId;
    if (!effectiveQuizSetId) {
      if (quizzesToUse.length === 0) {
        if (!silent) {
          showNotification('请先添加试题', 'error');
        }
        return;
      }

      try {
        // Create a minimal quiz set with current quizzes
        const response = await fetch('/api/quiz/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: `练习-${new Date().toLocaleString('zh-CN')}`,
            quizIds: quizzesToUse.map((quiz) => quiz._id),
          }),
        });

        if (!response.ok) {
          const errorResult = await response.json();
          throw new Error(errorResult.error || '创建练习记录失败');
        }

        const result = await response.json();
        effectiveQuizSetId = result.id;
        setCurrentQuizSetId(effectiveQuizSetId);

        if (!silent) {
          showNotification('练习记录已创建', 'success');
        }
      } catch (error) {
        console.error('创建练习记录时出错:', error);
        if (!silent) {
          showNotification(
            error instanceof Error
              ? error.message
              : '创建练习记录时发生未知错误',
            'error',
          );
        }
        return;
      }
    }

    try {
      const response = await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quizId, answer, quizSetId: effectiveQuizSetId }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '保存答案失败');
      }

      setQuizzes((prevQuizzes) =>
        prevQuizzes.map((quiz) =>
          quiz._id === quizId ? { ...quiz, userAnswer: answer } : quiz,
        ),
      );

      // Trigger UI update to reflect the submitted state
      setQuizStateUpdateTrigger((prev) => prev + 1);

      if (!silent) {
        showNotification('答案保存成功', 'success');
      }
    } catch (error) {
      console.error('保存答案时出错:', error);
      if (!silent) {
        showNotification(
          error instanceof Error ? error.message : '保存答案时发生未知错误',
          'error',
        );
      }
    }
  };

  const loadHistory = async () => {
    if (!session?.user?.email) {
      showNotification('请先登录', 'error');
      return;
    }

    setLoadingOperation('history');
    setIsLoadingHistory(true);
    try {
      const response = await fetch('/api/quiz/page_history');
      if (!response.ok) {
        throw new Error('加载历史试卷失败');
      }
      const result = await response.json();
      setHistory(result.data);
    } catch (error) {
      console.error(error);
      showNotification('加载历史试卷时出错', 'error');
    } finally {
      setLoadingOperation(null);
      setIsLoadingHistory(false);
    }
  };

  const handleRestoreQuizSet = async (quizSetId: string) => {
    setLoadingOperation('restore');
    setIsRestoring(true);
    console.log('恢复试卷');
    try {
      const response = await fetch(`/api/quiz/create/${quizSetId}`);
      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || '恢复试卷失败');
      }
      const result = await response.json();
      setCurrentQuizSetId(quizSetId);
      setQuizzes(
        sortQuizzesByType(
          result.data.quizzes.map((q: any) => ({
            ...q.quiz,
            userAnswer: q.answer || null,
          })),
        ),
      );
      setQuizStateUpdateTrigger((prev) => prev + 1);

      showNotification('试卷恢复成功', 'success');

      // Close the history drawer after successful restoration
      // This will be handled in the parent component
    } catch (error) {
      console.error(error);
      showNotification(
        error instanceof Error ? error.message : '恢复试卷时出错',
        'error',
      );
    } finally {
      setLoadingOperation(null);
      setIsRestoring(false);
    }
  };

  // Removed auto-save functionality
  // Only individual quiz answers are now synchronized
  useEffect(() => {
    // Clean up timer on unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Removed manual quiz set update effect
  // Only individual quiz answers are now synchronized
  useEffect(() => {
    prevQuizzesRef.current = quizzes;
  }, [quizzes]);
  useEffect(() => {
    (async () => {
      if (session?.user?.email) {
        await loadHistory();
      }
      setIsInitializing(false);
    })();
  }, [session]);

  const sendCurrentQuizToChat = (withAnswer?: boolean): string | null => {
    if (selectedQuizIndex === null || !quizzes[selectedQuizIndex]) {
      showNotification('请先选择试题', 'error');
      return null;
    }
    const quiz = quizzes[selectedQuizIndex];

    let quizContent = '';
    if (withAnswer) {
      quizContent +=
        `\n\n>[!note] 题目解析\n` +
        `>请分析题目并给出详细解析，包括：\n` +
        `>1. 正确答案的解释\n` +
        `>2. 相关知识点总结\n` +
        `>3. 易错点说明\n`;
    }
    quizContent = formQuizContent(quiz, withAnswer);

    showNotification('试题已发送到聊天面板', 'success');

    return quizContent;
  };

  const sendCurrentQuizToChatDirect = (withAnswer?: boolean) => {
    const quizContent = sendCurrentQuizToChat(withAnswer);
    if (quizContent) {
      // This function will be replaced with the actual send function when used in QuizApp
      // For now, we'll just return the content
      return quizContent;
    }
  };

  const resetQuizzes = () => {
    setQuizzes([]);
    setCurrentQuizSetId(null);
    showNotification('已重置所有题目', 'success');
  };

  return {
    // State
    quizzes,
    isInitializing,
    isLoading,
    isQuizFetching,
    loadingOperation,
    currentQuizSetId,
    history,
    isLoadingHistory,
    isRestoring,
    notification,
    notificationVisible,
    currentPage,
    isTabsExpanded,
    selectedQuizIndex,
    filterDrawerOpen,
    selectorDrawerOpen,
    historyDrawerOpen,

    // Actions
    setQuizzes,
    setCurrentQuizSetId,
    setSelectedQuizIndex,
    setFilterDrawerOpen,
    setSelectorDrawerOpen,
    setHistoryDrawerOpen,
    setCurrentPage,
    showNotification,
    addQuizToPage,
    handleSubmit,
    handleUpdate,
    handleAnswerChange,
    loadHistory,
    handleRestoreQuizSet,
    sendCurrentQuizToChat,
    sendCurrentQuizToChatDirect,
    resetQuizzes,
    setQuizStateUpdateTrigger,
  };

  return {
    // State
    quizzes,
    isInitializing,
    isLoading,
    isQuizFetching,
    loadingOperation,
    currentQuizSetId,
    history,
    isLoadingHistory,
    isRestoring,
    notification,
    notificationVisible,
    currentPage,
    isTabsExpanded,
    selectedQuizIndex,
    filterDrawerOpen,
    selectorDrawerOpen,
    historyDrawerOpen,
    quizStateUpdateTrigger,

    // Actions
    setQuizzes,
    setCurrentQuizSetId,
    setSelectedQuizIndex,
    setFilterDrawerOpen,
    setSelectorDrawerOpen,
    setHistoryDrawerOpen,
    setCurrentPage,
    showNotification,
    addQuizToPage,
    handleSubmit,
    handleUpdate,
    handleAnswerChange,
    loadHistory,
    handleRestoreQuizSet,
    sendCurrentQuizToChat,
    sendCurrentQuizToChatDirect,
    resetQuizzes,
    setQuizStateUpdateTrigger,
  };
};
