import { connectToDatabase } from "./mongodb";

export default class quizDB {
  /**
   * 将字符串中的连续多个空格替换为单个空格
   * @param input - 输入字符串
   * @returns 处理后的字符串，连续多个空格被替换为单个空格
   */
  normalizeSpaces(input: string): string {
    if (!input || typeof input !== "string") {
      return input;
    }

    // 使用正则表达式将连续的两个或更多空格替换为单个空格
    return input.replace(/\s{2,}/g, " ");
  }

  /**
   * 更新MongoDB集合中指定字段的连续空格
   * @param collection - MongoDB集合
   * @param fieldName - 需要处理的字段名
   * @returns 更新的文档数量
   */
  async normalizeFieldSpaces(fieldName: string): Promise<number> {
    const { db } = await connectToDatabase();
    let updatedCount = 0;

    // 查找所有具有该字段的文档
    const cursor = db
      .collection("quiz")
      .find({ [fieldName]: { $type: "string" } });

    // 遍历每个文档并更新
    for await (const doc of cursor) {
      const field = doc[fieldName] as unknown as string;
      const normalized = this.normalizeSpaces(field);

      // 只有当字段值有变化时才更新
      if (field !== normalized) {
        const result = await db
          .collection("quiz")
          .updateOne({ _id: doc._id }, { $set: { [fieldName]: normalized } });

        updatedCount += result.modifiedCount;
      }
    }

    return updatedCount;
  }
}
