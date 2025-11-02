import { Collection, MongoClient } from "mongodb";
import { quiz, A1, A2, A3, X, B } from "../../../types/quizData.types";

/**
 * 检查多个集合中是否存在与上传数据相同的记录（并行版本）
 * @param quiz 用户上传的题目数据
 * @param collections MongoDB 集合数组
 * @returns 如果任何集合中存在重复记录则返回 true，否则返回 false
 */
export async function isDuplicateQuizInCollectionsParallel(
  quiz: quiz,
  collections: Collection[],
): Promise<boolean> {
  // 并行检查所有集合
  const results = await Promise.all(
    collections.map((collection) => isDuplicateQuiz(quiz, collection)),
  );

  // 如果任何集合返回 true，则表示存在重复
  return results.some((result) => result === true);
}

/**
 * 检查数据库中是否存在与上传数据相同的记录
 * @param quiz 用户上传的题目数据
 * @param collection MongoDB 集合
 * @returns 如果存在重复记录则返回 true，否则返回 false
 */
export async function isDuplicateQuiz(
  quiz: quiz,
  collection: Collection,
): Promise<boolean> {
  // 构建基础查询条件
  const baseQuery = {
    type: quiz.type,
    class: quiz.class,
    unit: quiz.unit,
  };

  // 根据题目类型构建特定查询条件（使用 $size 操作符匹配数组长度）
  let specificQuery: Record<string, any> = {};

  switch (quiz.type) {
    case "A1":
    case "A2":
      specificQuery = {
        question: (quiz as A1 | A2).question,
        options: { $size: (quiz as A1 | A2).options.length },
      };
      break;

    case "A3":
      specificQuery = {
        mainQuestion: (quiz as A3).mainQuestion,
        subQuizs: { $size: (quiz as A3).subQuizs.length },
      };
      break;

    case "X":
      specificQuery = {
        question: (quiz as X).question,
        options: { $size: (quiz as X).options.length },
        answer: { $size: (quiz as X).answer.length },
      };
      break;

    case "B":
      specificQuery = {
        questions: { $size: (quiz as B).questions.length },
        options: { $size: (quiz as B).options.length },
      };
      break;
  }

  // 合并基础和特定查询条件
  const query = { ...baseQuery, ...specificQuery };

  // 查询数据库，看是否有匹配的记录
  const count = await collection.countDocuments(query);

  // 如果找到潜在重复记录，则进行更详细的深度比较
  if (count > 0) {
    const potentialDuplicates = await collection.find(query).toArray();

    for (const existingQuiz of potentialDuplicates) {
      if (isDeepDuplicate(quiz, existingQuiz)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 深度比较两个题目是否重复
 * @param newQuiz 新上传的题目
 * @param existingQuiz 数据库中已存在的题目
 * @returns 如果题目重复则返回 true，否则返回 false
 */
function isDeepDuplicate(newQuiz: quiz, existingQuiz: any): boolean {
  // 排除 _id 字段的比较
  const { _id: newId, ...newQuizWithoutId } = newQuiz;
  const { _id: existingId, ...existingQuizWithoutId } = existingQuiz;

  switch (newQuiz.type) {
    case "A1":
    case "A2": {
      const typedNewQuiz = newQuiz as A1 | A2;
      return (
        typedNewQuiz.question === existingQuizWithoutId.question &&
        areOptionsEqual(typedNewQuiz.options, existingQuizWithoutId.options) &&
        typedNewQuiz.answer === existingQuizWithoutId.answer
      );
    }
    case "A3": {
      const typedNewQuiz = newQuiz as A3;
      if (typedNewQuiz.mainQuestion !== existingQuizWithoutId.mainQuestion) {
        return false;
      }

      if (
        typedNewQuiz.subQuizs.length !== existingQuizWithoutId.subQuizs.length
      ) {
        return false;
      }

      for (let i = 0; i < typedNewQuiz.subQuizs.length; i++) {
        const newSubQuiz = typedNewQuiz.subQuizs[i];
        const existingSubQuiz = existingQuizWithoutId.subQuizs[i];

        if (
          newSubQuiz.question !== existingSubQuiz.question ||
          !areOptionsEqual(newSubQuiz.options, existingSubQuiz.options) ||
          newSubQuiz.answer !== existingSubQuiz.answer
        ) {
          return false;
        }
      }
      return true;
    }
    case "X": {
      const typedNewQuiz = newQuiz as X;
      return (
        typedNewQuiz.question === existingQuizWithoutId.question &&
        areOptionsEqual(typedNewQuiz.options, existingQuizWithoutId.options) &&
        areArraysEqual(typedNewQuiz.answer, existingQuizWithoutId.answer)
      );
    }
    case "B": {
      const typedNewQuiz = newQuiz as B;
      if (
        !areOptionsEqual(typedNewQuiz.options, existingQuizWithoutId.options)
      ) {
        return false;
      }

      if (
        typedNewQuiz.questions.length !== existingQuizWithoutId.questions.length
      ) {
        return false;
      }

      for (let i = 0; i < typedNewQuiz.questions.length; i++) {
        const newQuestion = typedNewQuiz.questions[i];
        const existingQuestion = existingQuizWithoutId.questions[i];

        if (
          newQuestion.questionText !== existingQuestion.questionText ||
          newQuestion.answer !== existingQuestion.answer
        ) {
          return false;
        }
      }

      return true;
    }
    default:
      return false;
  }
}

/**
 * 比较两个选项数组是否相等
 */
function areOptionsEqual(
  options1: { oid: string; text: string }[],
  options2: { oid: string; text: string }[],
): boolean {
  if (options1.length !== options2.length) {
    return false;
  }

  // 对选项按 oid 排序，确保顺序一致
  const sortedOptions1 = [...options1].sort((a, b) =>
    a.oid.localeCompare(b.oid),
  );
  const sortedOptions2 = [...options2].sort((a, b) =>
    a.oid.localeCompare(b.oid),
  );

  for (let i = 0; i < sortedOptions1.length; i++) {
    if (
      sortedOptions1[i].oid !== sortedOptions2[i].oid ||
      sortedOptions1[i].text !== sortedOptions2[i].text
    ) {
      return false;
    }
  }
  return true;
}

/**
 * 比较两个数组是否相等（不考虑顺序）
 */
function areArraysEqual<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) {
    return false;
  }
  const sorted1 = [...arr1].sort();
  const sorted2 = [...arr2].sort();
  for (let i = 0; i < sorted1.length; i++) {
    if (sorted1[i] !== sorted2[i]) {
      return false;
    }
  }
  return true;
}
