import { QuizWithUserAnswer } from '@/types/quizData.types';
import { DocumentTab } from '@/components/wiki/workspace/types';

// 标签页类型枚举
export enum TabType {
  QUIZ = 'quiz',
  DOCUMENT = 'document',
}

// 统一的标签页接口
export interface UnifiedTab {
  id: string;
  title: string;
  type: TabType;
  isActive: boolean;

  // 试卷标签页特有属性
  quizzes?: QuizWithUserAnswer[];

  // 文档标签页特有属性
  path?: string;
  content?: string;
  isDirty?: boolean;
  lastModified?: Date;
}

// 标签页内容组件的属性
export interface TabContentProps {
  tab: UnifiedTab;
  onAnswerChange?: (
    quizId: string,
    answer: any,
    silent?: boolean,
    quizzesForQuizSet?: QuizWithUserAnswer[],
  ) => Promise<void>;
  onContentChange?: (content: string) => void;
  onTitleChange?: (title: string) => void;
  onReset?: () => void;
  onQuizSelect?: (index: number) => void;
  isQuizFetching?: boolean;
  setQuizzes?: React.Dispatch<React.SetStateAction<QuizWithUserAnswer[]>>;
  isTestMode?: boolean;
  quizStateUpdateTrigger?: number;
  quizPageRef?: React.RefObject<any>;
  onOpenDocument?: (path: string) => void;
  showNotification?: (message: string, type: 'success' | 'error') => void;
  currentQuizSetId?: string;
}

// 统一标签页组件的属性
export interface UnifiedTabsProps {
  onAnswerChange?: (
    quizId: string,
    answer: any,
    silent?: boolean,
    quizzesForQuizSet?: QuizWithUserAnswer[],
  ) => Promise<void>;
  showNotification?: (message: string, type: 'success' | 'error') => void;
  currentQuizSetId?: string;
  loadingOperation?: string | null;
  setSelectedQuizIndex?: (index: number | null) => void;
  isTestMode?: boolean;
  quizStateUpdateTrigger?: number;
  handleSubmit?: (
    quizzes: QuizWithUserAnswer[],
    title?: string,
  ) => Promise<void>;
  onOpenDocument?: (path: string) => void;
}

// 统一标签页组件的引用接口
export interface UnifiedTabsRef {
  addQuizToPage: (quizzesToAdd: QuizWithUserAnswer[]) => void;
  addTab: (type?: TabType) => void;
  createTabWithQuizzes: (
    quizzes: QuizWithUserAnswer[],
    title?: string,
    createNewSet?: boolean,
  ) => void;
  createTabWithDocument: (path: string, title?: string) => void;
  getCurrentTabQuizzes: () => QuizWithUserAnswer[];
  getCurrentTabId: () => string | null;
  getCurrentQuiz: () => QuizWithUserAnswer | null;
  getCurrentDocument: () => {
    path: string;
    content: string;
    title: string;
  } | null;
}
