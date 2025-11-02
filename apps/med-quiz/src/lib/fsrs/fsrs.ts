import { Card, FSRS, Rating, Grade, fsrs } from "ts-fsrs";

/**
 * 根据参数获取FSRS实例
 */
export const getFsrsInstance = (params: {
  requestRetention: number;
  maximumInterval: number;
  weights: number[];
}) => {
  return new FSRS({
    request_retention: params.requestRetention,
    maximum_interval: params.maximumInterval,
    w: params.weights,
  });
};

/**
 * 处理复习并返回更新后的卡片状态
 */
export const processReview = (
  fsrsInstance: FSRS,
  item: Card,
  rating: number,
  reviewedAt: Date,
): Card => {
  // 在ts-fsrs中，Rating.Again = 1, Rating.Hard = 2, Rating.Good = 3, Rating.Easy = 4
  // 需要确保评分值在合法范围内（1-4）并转换为Grade类型
  const grade = Math.min(Math.max(rating, 1), 4) as Grade;
  const result = fsrsInstance.next(item, reviewedAt, grade);
  return result.card;
};

/**
 * 将数据库卡片状态转换为FSRS可用的格式
 */
export const convertToFsrsItem = (cardState: any): Card => {
  return {
    due: new Date(cardState.state.due),
    stability: cardState.state.stability,
    difficulty: cardState.state.difficulty,
    elapsed_days: cardState.state.elapsed_days,
    scheduled_days: cardState.state.scheduled_days,
    reps: cardState.state.reps,
    lapses: cardState.state.lapses,
    state: cardState.state.state,
    last_review: cardState.state.last_review
      ? new Date(cardState.state.last_review)
      : undefined,
  };
};

/**
 * 将FSRS项转换为数据库可存储的格式
 */
export const convertFromFsrsItem = (fsrsItem: Card): any => {
  return {
    due: fsrsItem.due,
    stability: fsrsItem.stability,
    difficulty: fsrsItem.difficulty,
    elapsed_days: fsrsItem.elapsed_days,
    scheduled_days: fsrsItem.scheduled_days,
    reps: fsrsItem.reps,
    lapses: fsrsItem.lapses,
    state: fsrsItem.state,
    last_review: fsrsItem.last_review,
  };
};
