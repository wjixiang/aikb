import { useState, useCallback, useRef, useEffect } from 'react';
import { QuizWithUserAnswer, answerType } from '@/types/quizData.types';
import { toast } from 'sonner';

interface BatchUpdate {
  quizId: string;
  answer: answerType;
  timestamp: number;
}

interface UseQuizBatchSyncProps {
  quizSet: QuizWithUserAnswer[];
  onAnswerChange: (quizId: string, answer: answerType) => Promise<void>;
  batchDelay?: number;
  maxBatchSize?: number;
  onSyncComplete?: () => void;
}

interface UseQuizBatchSyncReturn {
  pendingUpdates: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncErrors: Record<string, string>;
  updateQuizAnswer: (quizId: string, answer: answerType) => void;
  forceSync: () => Promise<void>;
  retryFailed: (quizId: string) => Promise<void>;
  clearErrors: () => void;
}

export const useQuizBatchSync = ({
  quizSet,
  onAnswerChange,
  batchDelay = 1000,
  maxBatchSize = 10,
  onSyncComplete,
}: UseQuizBatchSyncProps): UseQuizBatchSyncReturn => {
  const [pendingUpdates, setPendingUpdates] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({});

  const batchRef = useRef<BatchUpdate[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const processBatch = useCallback(
    async (batch: BatchUpdate[]) => {
      if (!isMountedRef.current || batch.length === 0) return;

      setIsSyncing(true);
      const errors: Record<string, string> = {};

      // Group by quizId to handle the latest update per quiz
      const latestUpdates = new Map<string, answerType>();
      batch.forEach(({ quizId, answer }) => {
        latestUpdates.set(quizId, answer);
      });

      // Process all updates
      const promises = Array.from(latestUpdates.entries()).map(
        async ([quizId, answer]) => {
          try {
            await onAnswerChange(quizId, answer);
            return { quizId, success: true };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : '保存失败';
            errors[quizId] = errorMessage;
            return { quizId, success: false, error: errorMessage };
          }
        },
      );

      const results = await Promise.allSettled(promises);

      if (isMountedRef.current) {
        setIsSyncing(false);
        setLastSyncTime(new Date());
        setSyncErrors((prev) => ({ ...prev, ...errors }));

        const successful = results.filter(
          (r) => r.status === 'fulfilled' && r.value.success,
        ).length;
        const failed = results.filter(
          (r) =>
            r.status === 'rejected' ||
            (r.status === 'fulfilled' && !r.value.success),
        ).length;

        if (failed > 0) {
          toast.error(`同步失败: ${failed}个答案`, {
            description: '部分答案未能保存，将自动重试',
            duration: 3000,
          });
        } else if (successful > 0) {
          toast.success(`已同步: ${successful}个答案`, {
            duration: 1000,
          });
        }
      }

      // Call onSyncComplete callback if provided
      if (onSyncComplete) {
        onSyncComplete();
      }
    },
    [onAnswerChange],
  );

  const flushBatch = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const currentBatch = [...batchRef.current];
    batchRef.current = [];
    setPendingUpdates(0);

    if (currentBatch.length > 0) {
      await processBatch(currentBatch);
    }
  }, [processBatch]);

  const updateQuizAnswer = useCallback(
    (quizId: string, answer: answerType) => {
      if (!isMountedRef.current) return;

      // Add to batch
      batchRef.current.push({
        quizId,
        answer,
        timestamp: Date.now(),
      });

      setPendingUpdates(batchRef.current.length);

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout if batch is not full
      if (batchRef.current.length < maxBatchSize) {
        timeoutRef.current = setTimeout(() => {
          flushBatch();
        }, batchDelay);
      } else {
        // Batch is full, process immediately
        flushBatch();
      }
    },
    [batchDelay, maxBatchSize, flushBatch],
  );

  const forceSync = useCallback(async () => {
    await flushBatch();
  }, [flushBatch]);

  const retryFailed = useCallback(
    async (quizId: string) => {
      if (syncErrors[quizId]) {
        const quiz = quizSet.find((q) => q._id === quizId);
        if (quiz) {
          setSyncErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[quizId];
            return newErrors;
          });

          try {
            await onAnswerChange(quizId, quiz.userAnswer || '');
            toast.success('重试成功');
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : '重试失败';
            setSyncErrors((prev) => ({ ...prev, [quizId]: errorMessage }));
            toast.error('重试失败', { description: errorMessage });
          }
        }
      }
    },
    [syncErrors, quizSet, onAnswerChange],
  );

  const clearErrors = useCallback(() => {
    setSyncErrors({});
  }, []);

  // Force sync on unmount
  useEffect(() => {
    return () => {
      if (batchRef.current.length > 0) {
        flushBatch();
      }
    };
  }, [flushBatch]);

  return {
    pendingUpdates,
    isSyncing,
    lastSyncTime,
    syncErrors,
    updateQuizAnswer,
    forceSync,
    retryFailed,
    clearErrors,
  };
};
