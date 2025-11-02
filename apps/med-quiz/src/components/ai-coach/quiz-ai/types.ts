import { QuizWithUserAnswer } from "@/types/quizData.types";
import { QuizHistoryItem } from "@/types/quizSet.types";

export interface NotificationState {
  message: string;
  type: "success" | "error";
}

export interface QuizAIState {
  quizzes: QuizWithUserAnswer[];
  isInitializing: boolean;
  isLoading: boolean;
  isQuizFetching: boolean;
  loadingOperation: string | null;
  currentQuizSetId: string | null;
  history: QuizHistoryItem[];
  isLoadingHistory: boolean;
  isRestoring: boolean;
  notification: NotificationState;
  notificationVisible: boolean;
  currentPage: number;
  isTabsExpanded: boolean;
  selectedQuizIndex: number | null;
  filterDrawerOpen: boolean;
  selectorDrawerOpen: boolean;
  historyDrawerOpen: boolean;
}
