export type oid = 'A' | 'B' | 'C' | 'D' | 'E';

export interface analysis {
  point: string | null;
  discuss: string | null;
  ai_analysis?: string;
  link: string[];
}

export interface A1 {
  _id: string;
  type: 'A1';
  class: string;
  unit: string;
  tags: string[];
  question: string;
  options: { oid: oid; text: string }[];
  answer: oid;
  analysis: analysis;
  source: string;
}

export interface A2 {
  _id: string;
  type: 'A2';
  class: string;
  unit: string;
  tags: string[];
  question: string;
  options: { oid: oid; text: string }[];
  answer: oid;
  analysis: analysis;
  source: string;
}
export interface A3 {
  _id: string;
  type: 'A3';
  class: string;
  unit: string;
  tags: string[];
  mainQuestion: string;
  subQuizs: {
    subQuizId: number;
    question: string;
    options: { oid: oid; text: string }[];
    answer: oid;
  }[];
  analysis: analysis;
  source: string;
}

export interface X {
  _id: string;
  type: 'X';
  class: string;
  unit: string;
  tags: string[];
  question: string;
  options: { oid: oid; text: string }[];
  answer: oid[];
  analysis: analysis;
  source: string;
}

export interface B {
  _id: string;
  type: 'B';
  class: string;
  unit: string;
  tags: string[];
  questions: {
    questionId: number;
    questionText: string;
    answer: oid;
  }[];
  options: { oid: oid; text: string }[];
  analysis: analysis;
  source: string;
}

export type quiz = A1 | A2 | A3 | B | X;
export type quizTypeID = 'A1' | 'A2' | 'A3' | 'B' | 'X';
export type answerType = string | string[];

export type QuizWithUserAnswer = quiz & {
  userAnswer?: answerType;
};

export interface QuizHistoryItem {
  id: string;
  title: string;
  createdAt: Date;
  quizCount: number;
}


/**
 * @interface PracticeRecord
 * @description Represents a record of a user's practice attempt on a quiz.
 */
export interface PracticeRecord {
  /**
   * @property {string} _id - The unique identifier for the practice record.
   */
  _id: string;
  /**
   * @property {string} userid - The ID of the user who attempted the quiz.
   */
  userid: string;
  /**
   * @property {string} quizid - The ID of the quiz that was attempted.
   */
  quizid: string;
  /**
   * @property {boolean} correct - Indicates whether the user answered the quiz correctly.
   */
  correct: boolean;
  /**
   * @property {Date} timestamp - The timestamp when the practice attempt was recorded.
   */
  timestamp: Date;
  /**
   * The answer record
   */
  selectrecord: oid[];
  subject: string;
}

/**
 * @interface PracticeRecordData
 * @description For database returned format: Represents a record of a user's practice attempt on a quiz.
 */
export interface PracticeRecordData {
  /**
   * @property {string} _id - The unique identifier for the practice record.
   */
  _id: string;
  /**
   * @property {string} userid - The ID of the user who attempted the quiz.
   */
  userid: string;
  /**
   * @property {string} quizid - The ID of the quiz that was attempted.
   */
  quizid: string;
  /**
   * @property {boolean} correct - Indicates whether the user answered the quiz correctly.
   */
  correct: boolean;
  /**
   * @property {Date} timestamp - The timestamp when the practice attempt was recorded.
   */
  timestamp: Date;
  /**
   * The answer record
   */
  selectrecord: oid[] | '';
  subject: string;
  tags?: string[];
}