import { useState, useCallback, useEffect } from "react";
import { QuizWithUserAnswer, answerType } from "@/types/quizData.types";
import { toast } from "sonner";

interface ValidationError {
  quizId: string;
  type: "invalid_answer" | "missing_data" | "sync_error";
  message: string;
  recoverable: boolean;
}

interface UseQuizValidationProps {
  quizSet: QuizWithUserAnswer[];
  onValidate?: (errors: ValidationError[]) => void;
}

interface UseQuizValidationReturn {
  errors: ValidationError[];
  isValidating: boolean;
  validateQuiz: (quizId: string, answer: answerType) => ValidationError[];
  validateAll: () => Promise<ValidationError[]>;
  recoverFromError: (quizId: string) => void;
  clearErrors: () => void;
}

export const useQuizValidation = ({
  quizSet,
  onValidate,
}: UseQuizValidationProps): UseQuizValidationReturn => {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const validateAnswer = useCallback(
    (quiz: QuizWithUserAnswer, answer: answerType): ValidationError[] => {
      const errors: ValidationError[] = [];

      if (answer === null || answer === undefined) {
        return errors;
      }

      switch (quiz.type) {
        case "A1":
        case "A2":
          if (typeof answer !== "string") {
            errors.push({
              quizId: quiz._id,
              type: "invalid_answer",
              message: "答案格式错误：应为字符串",
              recoverable: true,
            });
          }
          break;

        case "X":
          if (!Array.isArray(answer)) {
            errors.push({
              quizId: quiz._id,
              type: "invalid_answer",
              message: "答案格式错误：应为数组",
              recoverable: true,
            });
          } else {
            const options = quiz.options || [];
            const invalidOptions = (answer as string[]).filter(
              (oid) => !options.some((opt) => opt.oid === oid),
            );
            if (invalidOptions.length > 0) {
              errors.push({
                quizId: quiz._id,
                type: "invalid_answer",
                message: `无效选项: ${invalidOptions.join(", ")}`,
                recoverable: true,
              });
            }
          }
          break;

        case "A3":
          if (
            typeof answer !== "object" ||
            answer === null ||
            Array.isArray(answer)
          ) {
            errors.push({
              quizId: quiz._id,
              type: "invalid_answer",
              message: "答案格式错误：应为对象",
              recoverable: true,
            });
          } else {
            const subQuizs = quiz.subQuizs || [];
            const answerObj = answer as Record<string, string>;

            subQuizs.forEach((subQuiz) => {
              const subAnswer = answerObj[subQuiz.subQuizId];
              if (
                subAnswer &&
                !subQuiz.options.some((opt) => opt.oid === subAnswer)
              ) {
                errors.push({
                  quizId: quiz._id,
                  type: "invalid_answer",
                  message: `子题 ${subQuiz.subQuizId} 答案无效`,
                  recoverable: true,
                });
              }
            });
          }
          break;

        case "B":
          if (
            typeof answer !== "object" ||
            answer === null ||
            Array.isArray(answer)
          ) {
            errors.push({
              quizId: quiz._id,
              type: "invalid_answer",
              message: "答案格式错误：应为对象",
              recoverable: true,
            });
          } else {
            const questions = quiz.questions || [];
            const options = quiz.options || [];
            const answerObj = answer as Record<string, string>;

            questions.forEach((question) => {
              const qAnswer = answerObj[question.questionId];
              if (qAnswer && !options.some((opt) => opt.oid === qAnswer)) {
                errors.push({
                  quizId: quiz._id,
                  type: "invalid_answer",
                  message: `问题 ${question.questionId} 答案无效`,
                  recoverable: true,
                });
              }
            });
          }
          break;
      }

      return errors;
    },
    [],
  );

  const validateQuiz = useCallback(
    (quizId: string, answer: answerType): ValidationError[] => {
      const quiz = quizSet.find((q) => q._id === quizId);
      if (!quiz) {
        return [
          {
            quizId,
            type: "missing_data",
            message: "试题不存在",
            recoverable: false,
          },
        ];
      }

      return validateAnswer(quiz, answer);
    },
    [quizSet, validateAnswer],
  );

  const validateAll = useCallback(async (): Promise<ValidationError[]> => {
    setIsValidating(true);

    try {
      const allErrors: ValidationError[] = [];

      quizSet.forEach((quiz) => {
        if (quiz.userAnswer !== undefined && quiz.userAnswer !== null) {
          const quizErrors = validateAnswer(quiz, quiz.userAnswer);
          allErrors.push(...quizErrors);
        }
      });

      setErrors(allErrors);
      onValidate?.(allErrors);

      return allErrors;
    } finally {
      setIsValidating(false);
    }
  }, [quizSet, validateAnswer, onValidate]);

  const recoverFromError = useCallback((quizId: string) => {
    setErrors((prev) => prev.filter((error) => error.quizId !== quizId));
    toast.success("已清除错误状态");
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Auto-validate on quizSet changes
  useEffect(() => {
    if (quizSet.length > 0) {
      validateAll();
    }
  }, [quizSet, validateAll]);

  return {
    errors,
    isValidating,
    validateQuiz,
    validateAll,
    recoverFromError,
    clearErrors,
  };
};
