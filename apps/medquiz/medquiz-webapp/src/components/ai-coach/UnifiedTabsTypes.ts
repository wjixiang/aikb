import { QuizType } from 'quiz-shared';

export enum TabType {
  QUIZ = 'quiz',
  DOCUMENT = 'document',
}

export interface UnifiedTabsRef {
  createTabWithQuizzes: (
    quizzes: QuizType.QuizWithUserAnswer[],
    title: string,
    createNewQuizSet?: boolean,
  ) => void;
  addTab: (type: TabType) => void;
  getCurrentTabQuizzes: () => QuizType.QuizWithUserAnswer[];
  getCurrentQuiz: () => QuizType.QuizWithUserAnswer | null;
  createTabWithDocument: (path: string, title?: string) => void;
}
