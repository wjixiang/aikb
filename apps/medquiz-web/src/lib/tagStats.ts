import { connectToDatabase } from '@/lib/db/mongodb';

// 更新标签使用统计的辅助函数
export async function updateTagUsageStats(
  tagName: string,
  operation: 'increment' | 'decrement' = 'increment',
) {
  try {
    const { db } = await connectToDatabase();

    const updateOperation =
      operation === 'increment'
        ? { $inc: { usageCount: 1 }, $set: { lastUsed: new Date() } }
        : { $inc: { usageCount: -1 } };

    const result = await db
      .collection('publictags')
      .updateOne({ name: tagName }, updateOperation);

    return result.modifiedCount > 0;
  } catch (error) {
    console.error('Error updating tag usage stats:', error);
    return false;
  }
}

// 批量更新标签使用统计
export async function batchUpdateTagUsageStats(
  tagNames: string[],
  operation: 'increment' | 'decrement' = 'increment',
) {
  try {
    const { db } = await connectToDatabase();

    const updateOperation =
      operation === 'increment'
        ? { $inc: { usageCount: 1 }, $set: { lastUsed: new Date() } }
        : { $inc: { usageCount: -1 } };

    const result = await db
      .collection('publictags')
      .updateMany({ name: { $in: tagNames } }, updateOperation);

    return result.modifiedCount;
  } catch (error) {
    console.error('Error batch updating tag usage stats:', error);
    return 0;
  }
}
