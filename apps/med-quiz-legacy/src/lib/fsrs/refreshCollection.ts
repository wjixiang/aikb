import { UserSubscription } from '@/types/anki.types';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db/mongodb';

/**
 * 刷新用户指定的fsrs卡组全局状态，fsrs功能的核心组件，需要再所有fsrs操作前后进行调用
 * @param userEmail
 * @param collectionId
 * @returns
 */
export async function refreshCollection(
  userEmail: string,
  collectionId: string,
) {
  const { db } = await connectToDatabase();

  // 检查订阅是否存在
  const subscription = await db
    .collection<UserSubscription>('userSubscriptions')
    .findOne({
      userId: userEmail,
      collectionId: collectionId,
    });

  if (!subscription) {
    return null;
  }

  // 检查是否是新的一天（重置每日计数）
  const lastRefreshed = subscription.lastRefreshed
    ? new Date(subscription.lastRefreshed)
    : null;
  const now = new Date();
  const isNewDay =
    !lastRefreshed ||
    now.getDate() !== lastRefreshed.getDate() ||
    now.getMonth() !== lastRefreshed.getMonth() ||
    now.getFullYear() !== lastRefreshed.getFullYear();

  // 如果是新的一天，重置每日计数
  const newCardsToday = isNewDay ? 0 : subscription.newCardsToday || 0; // 今日已学新卡片数
  const reviewedToday = isNewDay ? 0 : subscription.reviewedToday || 0; // 今日已复习新卡片数

  // 获取调度参数
  const scheduleParams = subscription.scheduleParams || {
    newCardsPerDay: 20,
    maxReviewsPerDay: 200,
    learningSteps: [1, 10],
    lapseSteps: [10],
  };

  // 计算可用的复习卡片数量
  const availableReviews = Math.max(
    0,
    scheduleParams.maxReviewsPerDay - reviewedToday,
  );
  console.log('availableReviews', availableReviews);

  // 获取所有到期的卡片
  const dueCards = await db
    .collection('cardStates')
    .find({
      userId: userEmail,
      'state.due': { $lte: new Date() },
      collectionId: collectionId,
    })
    .toArray();

  // console.log("dueCards",dueCards)

  // 分类卡片：新卡片、学习中卡片和复习卡片

  const dueLearningCards = dueCards.filter(
    (card: any) => card.state.state === 1 || card.state.state === 3,
  );
  const dueReviewCards = dueCards.filter((card: any) => card.state.state === 2);

  // console.log("dueNewCards", dueNewCards)
  // console.log("dueLearningCards", dueLearningCards)
  // console.log("dueReviewCards", dueReviewCards)

  // 计算当前可学习的卡片数量
  // 计算可用的新卡片数量
  const NewCardsAvaliableCount = await db
    .collection('cardStates')
    .countDocuments({
      userId: userEmail,
      'state.state': 0,
      collectionId: collectionId,
    });

  const newCardCount = Math.min(
    NewCardsAvaliableCount,
    Math.max(scheduleParams.newCardsPerDay - newCardsToday, 0),
  );
  const reviewCardCount = Math.min(
    availableReviews,
    dueLearningCards.length + dueReviewCards.length,
  );
  console.log('newCardCount', newCardCount);
  // 计算总的到期卡片数量（考虑每日限制）
  const totalDueCount = newCardCount + reviewCardCount;

  // 更新订阅信息
  await db.collection('userSubscriptions').updateOne(
    { _id: new ObjectId(subscription._id) },
    {
      $set: {
        dueCount: totalDueCount,
        reviewCardsCount: reviewCardCount,
        reviewedToday: reviewedToday,
        newCardsToday: newCardsToday,
        newCardsCount: newCardCount,
        lastRefreshed: now,
      },
    },
  );
}

export async function refreshAllCollection(userid_email: string) {
  // 获取用户的所有订阅
  const { db } = await connectToDatabase();

  const subscriptions = await db
    .collection<UserSubscription>('userSubscriptions')
    .find({ userId: userid_email })
    .toArray();

  await Promise.all(
    subscriptions.map((e) => refreshCollection(userid_email, e.collectionId)),
  );
}
