export type TagType = "private" | "public";

export interface QuizTag {
  value: string;
  type: TagType;
  createdAt: Date;
  userId: string;
  quizId: string;
}

export interface PrivateTagData {
  type: "private_tag";
  content: string;

  /**
   * userId
   */
  creator: string;
  createTime: Date;
}

export default class quizTagger {}
