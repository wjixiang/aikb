import { answerType, QuizWithUserAnswer } from "@/types/quizData.types";

// Sorting function to order quizzes by type: A1/A2 -> A3 -> B -> X
export const sortQuizzesByType = (
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
