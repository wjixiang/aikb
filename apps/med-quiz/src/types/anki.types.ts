import { ObjectId } from "mongodb";

export interface AnkiCollectionPreset {
  _id: ObjectId;
  creator: string;
  collectionName: string;
  description: string;
  cards: {
    oid: string;
    title: string;
  }[];
}

export interface UserSubscription {
  _id?: ObjectId;
  userId: string;
  collectionId: string;
  collectionName: string;
  collectionDescription: string;
  cardCount: number;
  fsrsParams?: {
    requestRetention: number; // 默认0.9
    maximumInterval: number; // 默认36500
    weights: number[]; // FSRS算法权重
  };
  scheduleParams?: {
    newCardsPerDay: number; // 每日新卡片学习上限，默认20
    maxReviewsPerDay: number; // 每日复习上限，默认200
    learningSteps: number[]; // 学习阶段的时间间隔（分钟），默认[1, 10]
    lapseSteps: number[]; // 遗忘后的重学阶段时间间隔（分钟），默认[10]
  };
  createdAt: Date;
  dueCount: number;
  reviewedToday: number; // 今日已复习的新卡片数量
  reviewCardsCount: number;
  newCardsToday: number; // 今日已新学习的新卡片数量
  newCardsCount: number; // 今日待学新卡片数量
  lastRefreshed: Date; // 上次刷新学习状态的时间
}

export interface CardState {
  userId: string;
  cardOid: string;
  collectionId: string;
  state: {
    due: null;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    state: number; // 0: New, 1: Learning, 2: Review, 3: Relearning
    last_review: Date | null;
  };
}

export interface ReviewLog {
  userId: string;
  cardOid: string;
  rating: number; // 1-4评分
  reviewedAt: Date;
  elapsedTime: number; // 毫秒
}
