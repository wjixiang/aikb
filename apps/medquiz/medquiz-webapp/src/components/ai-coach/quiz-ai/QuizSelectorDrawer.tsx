// Placeholder for QuizSelectorDrawer component
// This component needs to be implemented based on the original from medquiz-web

import { QuizType } from 'quiz-shared';

interface QuizSelectorDrawerProps {
  selectorDrawerOpen: boolean;
  setSelectorDrawerOpen: (open: boolean) => void;
  addQuizToPage: (quizzes: QuizType.QuizWithUserAnswer[]) => void;
}

const QuizSelectorDrawer = (props: QuizSelectorDrawerProps) => {
  return <div>QuizSelectorDrawer Component - To be implemented</div>;
};

export { QuizSelectorDrawer };
