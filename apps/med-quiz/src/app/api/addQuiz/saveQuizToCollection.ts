import { MongoClient, Db, Collection } from 'mongodb';
import { quiz, A1, A2, A3, B, X } from '@/types/quizData.types';
import { isDuplicateQuiz } from './isDuplicateQuiz';

/**
 * 将题目保存到对应的集合中
 * @param quiz 用户上传的题目数据
 * @param db MongoDB 数据库实例
 * @returns 保存结果，包含成功状态、消息和插入的ID
 */
export async function saveQuizToCollection(
  quiz: quiz,
  db: Db,
): Promise<{ success: boolean; message: string; id?: string }> {
  try {
    // 根据题目类型确定目标集合名称
    const collectionName = getCollectionNameByType(quiz.type);

    // 获取目标集合
    const collection = db.collection(collectionName);

    // 检查是否存在重复记录
    const isDuplicate = await isDuplicateQuiz(quiz, collection);

    if (isDuplicate) {
      return {
        success: false,
        message: `数据库中已存在相同的${quiz.type}类型题目`,
      };
    }

    // 移除 _id 字段，让 MongoDB 自动生成
    const { _id, ...quizWithoutId } = quiz;

    // 插入新记录
    const result = await collection.insertOne(quizWithoutId);

    return {
      success: true,
      message: `${quiz.type}类型题目保存成功`,
      id: result.insertedId.toString(),
    };
  } catch (error) {
    console.error('Error saving quiz:', error);
    return {
      success: false,
      message: `保存${quiz.type}类型题目时发生错误: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 根据题目类型获取对应的集合名称
 * @param type 题目类型
 * @returns 集合名称
 */
function getCollectionNameByType(type: string): string {
  switch (type) {
    case 'A1':
      return 'a1';
    case 'A2':
      return 'a2';
    case 'A3':
      return 'a3';
    case 'B':
      return 'bx';
    case 'X':
      return 'xes';
    default:
      throw new Error(`未知的题目类型: ${type}`);
  }
}

/**
 * 在所有集合中检查是否存在重复题目
 * @param quiz 用户上传的题目数据
 * @param db MongoDB 数据库实例
 * @returns 如果存在重复记录则返回 true，否则返回 false
 */
export async function isDuplicateQuizInAllCollections(
  quiz: quiz,
  db: Db,
): Promise<boolean> {
  // 获取所有集合
  const collections = [
    db.collection('a1'),
    db.collection('a2'),
    db.collection('a3'),
    db.collection('bx'),
    db.collection('xes'),
  ];

  // 检查每个集合
  for (const collection of collections) {
    const isDuplicate = await isDuplicateQuiz(quiz, collection);
    if (isDuplicate) {
      return true;
    }
  }

  return false;
}
