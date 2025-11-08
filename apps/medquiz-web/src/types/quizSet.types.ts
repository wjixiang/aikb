import { answerType, quiz } from './quizData.types';
import { ObjectId } from 'mongodb';

export interface QuizSetDocument {
  _id?: ObjectId;
  title: string;
  quizzes: {
    quizId: string;
    answer: answerType | null;
  }[];
  createdAt: Date;
  creator?: string;
}

export interface QuizSetItem {
  quizId: string;
  answer: answerType | null;
}

export interface QuizSetData {
  id: string;
  title: string;
  quizzes: {
    quiz: quiz;
    answer: answerType | null;
  }[];
  createdAt: Date;
}

export interface QuizSetSummary {
  id: string;
  title: string;
  createdAt: Date;
  quizCount: number;
}

export interface QuizHistoryItem {
  id: string;
  title: string;
  createdAt: Date;
  quizCount: number;
}

export interface CreateQuizSetRequest {
  title: string;
  quizIds: string[];
}

export interface UpdateQuizAnswerRequest {
  quizId: string;
  answer: answerType;
  quizSetId: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  id?: string;
}
