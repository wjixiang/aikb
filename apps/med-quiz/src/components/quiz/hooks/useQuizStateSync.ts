import { useState, useEffect, useCallback, useRef } from "react";
import { QuizWithUserAnswer, answerType } from "@/types/quizData.types";
import { toast } from "sonner";

interface UseQuizStateSyncProps {
  quiz: QuizWithUserAnswer;
  onAnswerChange: (quizId: string, answer: answerType) => Promise<void>;
  debounceMs?: number;
  maxRetries?: number;
}

interface UseQuizStateSyncReturn {
  localAnswer: answerType;
  isSaving: boolean;
  saveError: string | null;
  lastSaved: Date | null;
  updateAnswer: (answer: answerType) => void;
  forceSave: () => Promise<void>;
  retrySave: () => Promise<void>;
  isSynced: boolean;
}

export const useQuizStateSync = ({
  quiz,
  onAnswerChange,
  debounceMs = 500,
  maxRetries = 3,
}: UseQuizStateSyncProps): UseQuizStateSyncReturn => {
  const [localAnswer, setLocalAnswer] = useState<answerType>(
    quiz.userAnswer || "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<answerType | null>(null);
  const isMountedRef = useRef(true);

  // Check if local state matches server state
  const isSynced =
    JSON.stringify(localAnswer) === JSON.stringify(quiz.userAnswer) &&
    !isSaving &&
    !saveError;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Sync with server state when quiz changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setLocalAnswer(quiz.userAnswer || "");
    setSaveError(null);
    setRetryCount(0);
    setLastSaved(quiz.userAnswer ? new Date() : null);
  }, [quiz._id, quiz.userAnswer]);

  const performSave = useCallback(
    async (answer: answerType) => {
      if (!isMountedRef.current) return;

      setIsSaving(true);
      setSaveError(null);

      try {
        await onAnswerChange(quiz._id, answer);

        if (isMountedRef.current) {
          setLastSaved(new Date());
          setRetryCount(0);
          setIsSaving(false);
        }
      } catch (error) {
        if (isMountedRef.current) {
          const errorMessage =
            error instanceof Error ? error.message : "保存失败";
          setSaveError(errorMessage);
          setIsSaving(false);

          if (retryCount < maxRetries) {
            setRetryCount((prev) => prev + 1);
          }
        }
      }
    },
    [quiz._id, onAnswerChange, retryCount, maxRetries],
  );

  const updateAnswer = useCallback(
    (answer: answerType) => {
      setLocalAnswer(answer);
      setSaveError(null);

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Store pending save
      pendingSaveRef.current = answer;

      // Debounce the save
      debounceRef.current = setTimeout(() => {
        if (isMountedRef.current && pendingSaveRef.current !== null) {
          performSave(pendingSaveRef.current);
          pendingSaveRef.current = null;
        }
      }, debounceMs);
    },
    [debounceMs, performSave],
  );

  const forceSave = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (pendingSaveRef.current !== null) {
      await performSave(pendingSaveRef.current);
      pendingSaveRef.current = null;
    } else {
      await performSave(localAnswer);
    }
  }, [localAnswer, performSave]);

  const retrySave = useCallback(async () => {
    if (saveError) {
      setRetryCount(0);
      await forceSave();
    }
  }, [saveError, forceSave]);

  // Show toast notifications for save states
  useEffect(() => {
    if (saveError && retryCount >= maxRetries) {
      toast.error("同步失败", {
        description: "无法保存答案，请检查网络连接",
        action: {
          label: "重试",
          onClick: retrySave,
        },
        duration: 5000,
      });
    }
  }, [saveError, retryCount, maxRetries, retrySave]);

  return {
    localAnswer,
    isSaving,
    saveError,
    lastSaved,
    updateAnswer,
    forceSave,
    retrySave,
    isSynced,
  };
};
