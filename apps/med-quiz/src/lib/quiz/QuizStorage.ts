import winston from "winston";
import { Db, ObjectId, WithId, Filter } from "mongodb";
import { createLoggerWithPrefix } from "../console/logger";
import { quizSelector } from "@/types/quizSelector.types";
import pLimit from "p-limit";
import { connectToDatabase } from "../db/mongodb";
import { oid, quiz, SurrealQuizRecord } from "@/types/quizData.types";
import { surrealDBClient } from "@/kgrag/database/surrrealdbClient";
import { r, RecordId } from "surrealdb";
import { formQuizContent } from "../utils";

/**
 * @interface PracticeRecord
 * @description Represents a record of a user's practice attempt on a quiz.
 */
export interface PracticeRecord {
  /**
   * @property {ObjectId} _id - The unique identifier for the practice record.
   */
  _id: ObjectId;
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
   * @property {ObjectId} _id - The unique identifier for the practice record.
   */
  _id: ObjectId;
  /**
   * @property {string} userid - The ID of the user who attempted the quiz.
   */
  userid: string;
  /**
   * @property {ObjectId} quizid - The ID of the quiz that was attempted.
   */
  quizid: ObjectId;
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
  selectrecord: oid[] | "";
  subject: string;
  tags?: string[];
}

/**
 * @class QuizStorage
 * @description Manages storage and retrieval of quiz-related data, including practice records and quiz content,
 * from MongoDB and SurrealDB.
 */
export default class QuizStorage {
  /**
   * @property {winston.Logger} logger - Logger instance for logging messages.
   */
  logger: winston.Logger;
  /**
   * @property {boolean} isDev - Flag indicating if the application is in development mode.
   */
  isDev = true;

  /**
   * @constructor
   * @description Initializes the QuizStorage class and sets up the logger.
   */
  constructor() {
    this.logger = createLoggerWithPrefix("QuizStorage");
  }

  /**
   * Pushes a new practice record to the database
   * @param record Practice record data to insert
   */
  async pushRecord(record: Omit<PracticeRecord, "_id"> & { tags?: string[] }) {
    try {
      const { db } = await connectToDatabase();
      const result = await db
        .collection<
          Omit<PracticeRecordData, "_id" | "subject">
        >("practicerecords")
        .insertOne({
          userid: record.userid, // userId is now a string
          quizid: new ObjectId(record.quizid), // Convert quizId string to ObjectId
          timestamp: new Date(),
          selectrecord: record.selectrecord || [], // Convert selectrecord IDs to ObjectId
          // subject: record.subject || '',
          correct: record.correct,
        });

      this.logger.debug(
        `Inserted practice record ${JSON.stringify({
          id: result.insertedId,
          quizId: record.quizid,
          correct: record.correct,
          tags: record.tags,
        })}`,
      );

      return result.insertedId;
    } catch (error) {
      this.logger.error("Failed to insert practice record:", error);
      throw error;
    }
  }

  /**
   * Fetches practice records for a user within a date range
   * @param userId User email/ID
   * @param startDate Start date for records
   * @param endDate End date for records
   * @returns Array of practice records
   */
  async fetchPracticeRecords(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PracticeRecord[]> {
    try {
      const { db } = await connectToDatabase();
      const records = await db
        .collection<PracticeRecordData>("practicerecords")
        .find({
          userid: userId,
          timestamp: { $gte: startDate, $lte: endDate },
          // timestamp: { $gte: new Date(), $lte: new Date() }
        })
        .toArray();
      return records.map((record) => ({
        ...record,
        quizid: record.quizid ? record.quizid.toString() : "",
      })) as PracticeRecord[];
    } catch (error) {
      this.logger.error("Failed to fetch practice records:", error);
      throw error;
    }
  }

  /**
   * Fetches practice records for a specific quiz and user.
   * @param userId User email/ID
   * @param quizId Quiz ID
   * @returns Array of practice records for the given quiz and user
   */
  async fetchPracticeRecordsForQuiz(
    userId: string,
    quizId: string,
  ): Promise<PracticeRecordData[]> {
    try {
      const { db } = await connectToDatabase();
      return (await db
        .collection("practicerecords")
        .find({
          userid: userId,
          quizid: new ObjectId(quizId),
        })
        .sort({ timestamp: 1 })
        .toArray()) as PracticeRecordData[];
    } catch (error) {
      this.logger.error(
        `Failed to fetch practice records for quiz ${quizId} and user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Creates a mapping of quiz IDs to their subjects
   * @param quizIds Array of quiz IDs to map
   * @returns Object mapping quiz IDs to subjects
   */
  async createQuizSubjectMap(
    quizIds: ObjectId[],
  ): Promise<Record<string, string>> {
    try {
      const { db } = await connectToDatabase();
      const quizClassMap: Record<string, string> = {};
      const quizzes = await db
        .collection("quiz")
        .find(
          {
            _id: { $in: quizIds },
          },
          { projection: { _id: 1, class: 1 } },
        )
        .toArray();

      quizzes.forEach((quiz) => {
        quizClassMap[quiz._id.toString()] = quiz.class || "未分类";
      });

      return quizClassMap;
    } catch (error) {
      this.logger.error("Failed to create quiz subject map:", error);
      throw error;
    }
  }

  /**
   * Fetches quizzes from the database based on the selector criteria
   * @param selector Quiz selection criteria
   * @param email User email for filtering practiced quizzes
   * @param isDev Whether in development mode for logging
   * @returns Promise with filtered quizzes
   */
  /**
   * Fetches wrong quizzes for a user with scoring based on error patterns
   * @param userId User email/ID
   * @param selector Quiz selection criteria
   * @param weights Optional scoring weights [errorRate, consecutiveWrong, recency]
   * @returns Array of wrong quizzes with scores
   */
  /**
   * Fetches wrong quizzes for a user with scoring based on error patterns.
   *
   * IMPORTANT: For optimal performance, ensure the following indexes exist:
   *   practicerecords: { userid: 1, timestamp: 1 }
   *   practicerecords: { quizid: 1 }
   *   quiz: { class: 1, type: 1, unit: 1, source: 1, extractedYear: 1 }
   *
   * @param userId User email/ID
   * @param selector Quiz selection criteria
   * @returns Array of wrong quizzes with scores
   */
  async getWrongQuizzes(
    userId: string,
    selector: quizSelector,
  ): Promise<{ quiz: quiz; score: number }[]> {
    // Set default weights if not provided - 降低错误率权重，增加其他因素权重
    const weights = selector.scoringWeights || {
      errorRate: 0.4,      // 降低错误率权重
      consecutiveWrong: 0.3, // 增加连续错误权重
      recency: 0.3,        // 增加时间因素权重
    };

    // Validate weights sum to 1
    const sum = weights.errorRate + weights.consecutiveWrong + weights.recency;
    if (Math.abs(sum - 1) > 0.001) {
      throw new Error("Scoring weights must sum to 1");
    }
    try {
      const { db } = await connectToDatabase();
      this.logger.debug("Starting getWrongQuizzes", {
        userId,
        selector: JSON.stringify(selector),
      });

      // Pre-fetch matching quiz IDs to reduce aggregation complexity
      const quizQuery: Filter<quiz> = {
        ...(selector.cls && selector.cls.length > 0
          ? { class: { $in: selector.cls } }
          : {}),
        ...(selector.mode && selector.mode.length > 0
          ? {
              type: {
                $in: selector.mode as ("A1" | "A2" | "A3" | "B" | "X")[],
              },
            }
          : {}),
        ...(selector.unit && selector.unit.length > 0
          ? { unit: { $in: selector.unit } }
          : {}),
        ...(selector.source && selector.source.length > 0
          ? { source: { $in: selector.source } }
          : {}),
        ...(selector.extractedYear && selector.extractedYear.length > 0
          ? { extractedYear: { $in: selector.extractedYear } }
          : {}),
      };

      // Note: Tag filtering will be applied later after scoring to ensure we have enough quizzes
      // to meet the requested quizNum. We'll collect tag filter info here but apply it later.
      let tagFilterInfo: { tags: (string | { value: string; type?: "private" | "public" })[], filterMode: "AND" | "OR" } | null = null;
      if (selector.tags && selector.tags.length > 0) {
        tagFilterInfo = {
          tags: selector.tags,
          filterMode: selector.tagFilterMode || "AND"
        };
      }
      this.logger.debug("Quiz pre-filter query:", quizQuery);
      const matchingQuizzes = await db
        .collection<quiz>("quiz")
        .find(quizQuery, { projection: { _id: 1 } })
        .toArray();
      const matchingQuizIds = matchingQuizzes.map((q) => q._id.toString());
      this.logger.debug(
        `Found ${matchingQuizIds.length} matching quiz IDs from pre-filter.`,
      );
      this.logger.debug(
        `Sample matching quiz IDs: ${JSON.stringify(matchingQuizIds.slice(0, 5))}`,
      );

      if (matchingQuizIds.length === 0) {
        this.logger.debug(
          "No matching quizzes found after pre-filter, returning empty array.",
        );
        return [];
      }

      // Apply tag filtering early in the aggregation if tags are specified
      let tagFilteredQuizIds: ObjectId[] = [];
      if (tagFilterInfo) {
        // Import the function dynamically to avoid circular dependencies
        const { getQuizIdsByTags } = await import("./getQuizIdsByTags");
        tagFilteredQuizIds = await getQuizIdsByTags(
          tagFilterInfo.tags,
          userId,
          tagFilterInfo.filterMode
        );
        
        if (tagFilteredQuizIds.length === 0) {
          this.logger.debug("No quizzes found with the specified tags for getWrongQuizzes");
          return [];
        }
        
        this.logger.debug(`Found ${tagFilteredQuizIds.length} quizzes matching tag criteria`);
      }

      // Simplified aggregation pipeline
      const pipeline = [
        {
          $match: {
            userid: userId,
            ...(selector.startDate && selector.endDate
              ? {
                  timestamp: {
                    $gte: new Date(selector.startDate),
                    $lte: new Date(selector.endDate),
                  },
                }
              : {}),
            quizid: {
              $in: tagFilterInfo
                ? tagFilteredQuizIds.filter(id => matchingQuizIds.includes(id.toString()))
                : matchingQuizIds.map((id) => new ObjectId(id))
            },
          },
        },
        {
          $group: {
            _id: "$quizid",
            totalAttempts: { $sum: 1 },
            wrongAttempts: { $sum: { $cond: ["$correct", 0, 1] } },
            lastAttemptTimestamp: { $max: "$timestamp" },
            attempts: {
              $push: { correct: "$correct", timestamp: "$timestamp" },
            },
          },
        },
        {
          $project: {
            _id: 1, // Keep _id which is quizid
            totalAttempts: 1,
            wrongAttempts: 1,
            lastAttemptTimestamp: 1,
            attempts: 1,
          },
        },
        {
          $match: {
            wrongAttempts: { $gt: 0 },
          },
        },
      ];

      const aggregatedQuizStats = (await db
        .collection("practicerecords")
        .aggregate(pipeline)
        .toArray()) as {
        _id: ObjectId; // This is the quizid
        totalAttempts: number;
        wrongAttempts: number;
        lastAttemptTimestamp: Date;
        attempts: { correct: boolean; timestamp: Date }[];
      }[];

      this.logger.debug(`Aggregated ${aggregatedQuizStats.length} quiz stats.`);
      if (aggregatedQuizStats.length > 0) {
        this.logger.debug(
          `Sample aggregated quiz stat: ${JSON.stringify(aggregatedQuizStats[0])}`,
        );
      }

      // Fetch quiz details for the aggregated quiz IDs
      const quizIdsToFetch = aggregatedQuizStats.map((item) =>
        item._id.toString(),
      );
      const fetchedQuizzes = await this.fetchQuizzesByOids(quizIdsToFetch);
      const quizMap = new Map<string, quiz>();
      fetchedQuizzes.forEach((q) => quizMap.set(q._id.toString(), q));

      // Calculate score and sort with optimized consecutive wrong calculation
      const scoredQuizzes = aggregatedQuizStats
        .map((item) => {
          // Optimized consecutive wrong calculation
          let maxConsecutiveWrong = 0;
          let currentConsecutive = 0;

          // Sort attempts by timestamp first
          const sortedAttempts = [...item.attempts].sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
          );

          for (const attempt of sortedAttempts) {
            if (attempt.correct) {
              currentConsecutive = 0;
            } else {
              currentConsecutive++;
              maxConsecutiveWrong = Math.max(
                maxConsecutiveWrong,
                currentConsecutive,
              );
            }
          }

          const errorRate = item.wrongAttempts / item.totalAttempts;

          // 改进的时间加权错误率算法：区分正确和错误答案的时间权重
          const now = Date.now();
          let weightedErrors = 0;
          let weightedTotal = 0;

          // 计算时间加权错误率：正确回答使用正向衰减，错误回答使用反向衰减
          for (const attempt of sortedAttempts) {
            const daysAgo =
              (now - attempt.timestamp.getTime()) / (1000 * 60 * 60 * 24);
            
            if (attempt.correct) {
              // 正确回答：使用正向衰减（越近权重越小，避免重复抽取）
              const weight = Math.exp(-0.3 * daysAgo); // 较快的衰减速度
              weightedTotal += weight;
            } else {
              // 错误回答：使用反向衰减（越近权重越大，重点关注近期错误）
              const weight = Math.exp(-0.1 * daysAgo); // 较慢的衰减速度
              weightedTotal += weight;
              weightedErrors += weight;
            }
          }

          const dynamicErrorRate =
            weightedTotal > 0 ? weightedErrors / weightedTotal : 0;

          // 增强的近期练习惩罚因子（防止过度重复）
          const daysSinceLastAttempt =
            (now - new Date(item.lastAttemptTimestamp).getTime()) /
            (1000 * 60 * 60 * 24);
          
          // 计算最早和最晚练习时间，用于动态半衰期
          const firstAttemptTimestamp = sortedAttempts[0]?.timestamp.getTime() || now;
          const practiceDurationDays = (now - firstAttemptTimestamp) / (1000 * 60 * 60 * 24);
          
          // 动态半衰期：练习时间越长，半衰期越长（避免频繁重复）
          const dynamicHalfLife = Math.max(7, Math.min(30, practiceDurationDays / 2));
          
          const recentPracticePenalty = Math.min(
            1.5, // 提高最大惩罚值
            1.2 * Math.exp(-daysSinceLastAttempt / dynamicHalfLife), // 动态半衰期
          );

          // 修正的遗忘因子逻辑：遗忘应该降低优先级
          const forgettingRate = 1.84;
          const power = 0.8;
          const retentionRate = Math.exp(
            -forgettingRate * Math.pow(daysSinceLastAttempt, power),
          );
          // 遗忘因子：保留率越高，优先级越高（遗忘越多，优先级越低）
          const forgettingFactor = Math.max(
            0.1,
            Math.min(1, retentionRate), // 使用保留率而不是遗忘率
          );

          // 成功练习奖励：近期正确回答显著降低优先级
          const recentCorrectAttempts = sortedAttempts
            .filter(attempt => attempt.correct)
            .slice(-3); // 考虑最近3次正确回答
          
          let successReward = 0;
          if (recentCorrectAttempts.length > 0) {
            const mostRecentCorrect = recentCorrectAttempts[recentCorrectAttempts.length - 1];
            const daysSinceLastCorrect =
              (now - mostRecentCorrect.timestamp.getTime()) / (1000 * 60 * 60 * 24);
            
            // 成功奖励：越近的正确回答，奖励越大（降低优先级）
            successReward = Math.min(0.5, 0.4 * Math.exp(-daysSinceLastCorrect / 2));
          }

          // 优化综合评分公式：确保各因素合理平衡
          // 基础分数 = 动态错误率 + 连续错误
          const baseScore =
            dynamicErrorRate * weights.errorRate +
            maxConsecutiveWrong * weights.consecutiveWrong;
          
          // 时间因素调整：遗忘因子和近期惩罚/成功奖励的平衡
          const timeAdjustedScore = baseScore *
            (forgettingFactor * weights.recency) *
            (1 - Math.min(1, recentPracticePenalty + successReward));
          
          // 最终分数确保非负
          const score = Math.max(0, timeAdjustedScore);

          const quiz = quizMap.get(item._id.toString());
          if (!quiz) {
            this.logger.warn(
              `Quiz with ID ${item._id.toString()} not found after fetching.`,
            );
            return null; // Or handle as appropriate
          }

          return {
            quiz: quiz,
            score: score,
          };
        })
        .filter((item) => item !== null) // Filter out nulls if any quiz was not found
        .sort((a, b) => b!.score - a!.score); // Use non-null assertion after filtering

      this.logger.debug(
        `Calculated scores and sorted ${scoredQuizzes.length} quizzes.`,
      );
      if (scoredQuizzes.length > 0) {
        this.logger.debug(
          `Sample scored quiz: ${JSON.stringify(scoredQuizzes[0])}`,
        );
      }

      // Tag filtering is now applied earlier in the aggregation pipeline
      let filteredQuizzes = scoredQuizzes;

      // Truncate the list based on selector.quizNum
      const result =
        selector.quizNum > 0
          ? filteredQuizzes.slice(0, selector.quizNum)
          : filteredQuizzes;

      this.logger.debug("Returning wrong quizzes", {
        count: result.length,
        requested: selector.quizNum,
        sampleIds: result.slice(0, 5).map((q) => q.quiz._id),
      });
      return result;
    } catch (error) {
      this.logger.error("Failed to get wrong quizzes:", error);
      throw error;
    }
  }

  async fetchQuizzes(
    selector: quizSelector,
    email?: string,
    isDev?: boolean,
  ): Promise<quiz[]> {
    try {
      console.log(selector);
      const {
        cls,
        mode,
        quizNum,
        unit,
        source,
        extractedYear,
        onlyHasDone,
        reviewMode,
        randomize,
        tags,
        tagFilterMode,
        excludeTags,
        excludeTagFilterMode
      } = selector;
      if (quizNum > 350) {
        throw new Error(
          `Quizzes fetching failed: cannot fetch more than 350 quizzes in single request`,
        );
      }
      const { db } = await connectToDatabase();

      // Build query
      const pipeline = [];
      const query: Filter<quiz> = {
        ...(cls && cls.length > 0 ? { class: { $in: cls } } : {}),
        ...(mode && mode.length > 0
          ? { type: { $in: mode as ("A1" | "A2" | "A3" | "B" | "X")[] } }
          : {}),
        ...(unit && unit.length > 0 ? { unit: { $in: unit } } : {}),
        ...(source && source.length > 0 ? { source: { $in: source } } : {}),
        ...(extractedYear && extractedYear.length > 0
          ? { extractedYear: { $in: extractedYear } }
          : {}),
      };

      let quizes: quiz[] = [];

      // Handle tags filtering if provided and email is available
      let tagFilteredQuizIds: ObjectId[] = [];
      if (tags && tags.length > 0 && email) {
        // Import the function at the top of the file
        const { getQuizIdsByTags } = await import("./getQuizIdsByTags");
        tagFilteredQuizIds = await getQuizIdsByTags(tags, email, tagFilterMode || "AND");
        
        if (tagFilteredQuizIds.length === 0) {
          this.logger.debug("No quizzes found with the specified tags");
          return [];
        }
        
        // Add tag filter to the query
        query._id = { $in: tagFilteredQuizIds as any };
      }

      // Handle exclude tags filtering if provided and email is available
      let excludeTagFilteredQuizIds: ObjectId[] = [];
      if (excludeTags && excludeTags.length > 0 && email) {
        // Import the function at the top of the file
        const { getQuizIdsToExcludeByTags } = await import("./getQuizIdsByTags");
        excludeTagFilteredQuizIds = await getQuizIdsToExcludeByTags(excludeTags, email, excludeTagFilterMode || "AND");
        
        if (excludeTagFilteredQuizIds.length > 0) {
          // Add exclude tag filter to the query - exclude these quiz IDs
          if (query._id && typeof query._id === 'object' && '$in' in query._id) {
            // If there's already an _id filter (from include tags), combine with $nin
            const includedIds = (query._id as any).$in;
            if (Array.isArray(includedIds)) {
              // Filter out excluded IDs from the included IDs
              const filteredIds = includedIds.filter((id: any) =>
                !excludeTagFilteredQuizIds.some(excludeId => excludeId.equals(id))
              );
              query._id = { $in: filteredIds };
            }
          } else {
            // If no existing _id filter, just exclude the unwanted IDs
            query._id = { $nin: excludeTagFilteredQuizIds as any };
          }
        }
      }

      if (randomize !== false) {
        pipeline.push({ $sample: { size: quizNum } });
      }
      // Filter out practiced quizzes if needed
      // Handle review review mode

      switch (reviewMode) {
        case "unpracticed":
          if (!email) {
            this.logger.warn(
              "Email is required for 'unpracticed' review mode.",
            );
            quizes = [];
            break;
          }
          const practicedQuizIds = await db
            .collection<PracticeRecordData>("practicerecords")
            .distinct("quizid", { userid: email });

          // Add filter to exclude practiced quizzes, converting ObjectId to string
          // If we already have tag filters, we need to combine them
          if (query._id && typeof query._id === 'object' && "$in" in query._id) {
            // Combine with existing tag filters
            const currentIds = (query._id.$in as any[]).map(id => id instanceof ObjectId ? id : new ObjectId(id));
            query._id = {
              $in: currentIds.filter(id =>
                !(practicedQuizIds as ObjectId[]).some(practicedId => practicedId.equals(id))
              ) as any
            };
          } else {
            query._id = { $nin: practicedQuizIds as any };
          }
          
          quizes = await db
            .collection<quiz>("quiz")
            .aggregate<quiz>([{ $match: query }, ...pipeline])
            .limit(quizNum)
            .toArray();
          break;
        case "review":
          if (email) {
            // For review mode, we need to handle tag filtering differently
            // since getWrongQuizzes doesn't directly support tags
            let filteredWrongQuizzes;
            
            if (tags && tags.length > 0) {
              // If tags are provided, we need to filter by tags
              if (tagFilteredQuizIds.length === 0) {
                // No quizzes match the tags, return empty array
                this.logger.debug("No quizzes found with the specified tags for review mode");
                quizes = [];
                break;
              }
              
              // First get wrong quizzes without tag filtering
              filteredWrongQuizzes = await this.getWrongQuizzes(email, {
                ...selector,
                // Temporarily remove tags to avoid conflict
                tags: undefined,
                tagFilterMode: undefined
              });
              
              // Then filter by tags
              filteredWrongQuizzes = filteredWrongQuizzes
                .filter(item => tagFilteredQuizIds.some(id => id.equals(new ObjectId(item.quiz._id))));
            } else {
              // No tags provided, get wrong quizzes normally
              filteredWrongQuizzes = await this.getWrongQuizzes(email, selector);
            }
            
            // Handle exclude tags if provided
            if (excludeTags && excludeTags.length > 0 && excludeTagFilteredQuizIds.length > 0) {
              filteredWrongQuizzes = filteredWrongQuizzes.filter(item =>
                !excludeTagFilteredQuizIds.some(id => id.equals(new ObjectId(item.quiz._id)))
              );
            }
            
            quizes = filteredWrongQuizzes.map(item => item.quiz);
            break;
          }
        default:
          quizes = await db
            .collection<quiz>("quiz")
            .aggregate<quiz>([{ $match: query }, ...pipeline])
            .limit(quizNum)
            .toArray();
          break;
      }

      // Handle unpracticed mode (same as onlyHasDone)

      return quizes;
    } catch (error) {
      this.logger.error("Quiz fetch error:", error);
      throw error;
    }
  }

  /**
   * Fetches quizzes from the database using a cursor, allowing for streaming/pagination
   * @param selector Quiz selection criteria
   * @param email User email for filtering practiced quizzes
   * @param isDev Whether in development mode for logging
   * @returns MongoDB cursor for the filtered quizzes
   */
  async fetchQuizzesWithCursor(
    selector: quizSelector,
    email?: string,
    isDev?: boolean,
  ) {
    try {
      console.log(selector);
      const {
        cls,
        mode,
        quizNum,
        unit,
        source,
        extractedYear,
        onlyHasDone,
        reviewMode,
        randomize,
      } = selector;
      // if(quizNum>350) {
      //     throw new Error(`Quizzes fetching failed: cannot fetch more than 350 quizzes in single request`)
      // }
      const { db } = await connectToDatabase();

      // Build query
      const pipeline = [];
      const query: Filter<quiz> = {
        ...(cls && cls.length > 0 ? { class: { $in: cls } } : {}),
        ...(mode && mode.length > 0
          ? { type: { $in: mode as ("A1" | "A2" | "A3" | "B" | "X")[] } }
          : {}),
        ...(unit && unit.length > 0 ? { unit: { $in: unit } } : {}),
        ...(source && source.length > 0 ? { source: { $in: source } } : {}),
        ...(extractedYear && extractedYear.length > 0
          ? { extractedYear: { $in: extractedYear } }
          : {}),
      };

      // let quizes:quiz[] = [];
      let cursor;

      if (randomize !== false) {
        pipeline.push({ $sample: { size: quizNum } });
      }
      cursor = db
        .collection<quiz>("quiz")
        .aggregate<quiz & { __v: any }>([{ $match: query }, ...pipeline])
        .limit(quizNum);

      return cursor;
    } catch (error) {
      this.logger.error("Quiz fetch error:", error);
      throw error;
    }
  }

  /**
   * Fetches quizzes by their OIDs
   * @param oids Array of quiz OIDs to fetch
   * @param isDev Whether in development mode for logging
   * @returns Promise with requested quizzes
   */
  async fetchQuizzesByOids(oids: string[]) {
    try {
      const { db } = await connectToDatabase();
      if (this.isDev) {
        this.logger.debug("Fetching quizzes by OIDs:", oids);
      }

      const objectIds = oids.map((id) => new ObjectId(id));
      const quizes = (await db
        .collection("quiz")
        .find({ _id: { $in: objectIds } })
        .toArray()) as unknown as quiz[];

      return quizes;
    } catch (error) {
      this.logger.error("Failed to fetch quizzes by OIDs:", error);
      throw error;
    }
  }


  /**
   * Parse quiz into plain text
   * @param quiz
   * @returns
   */
  static formQuizContent: (
    quiz: quiz,
    withAnswer?: boolean,
    withAnalysis?: boolean,
  ) => string = formQuizContent;



  async get_related_cards(mongoId: string): Promise<{
    cards: {
      content: string;
      id: RecordId;
    }[];
    mongoId: string;
  }> {
    const surrealDb = await surrealDBClient.getDb();
    const related_card_record = await surrealDb.query<
      {
        cards: {
          content: string;
          id: RecordId;
        }[];
        mongoId: string;
      }[][]
    >(
      `SELECT mongoId, ->quiz_to_card->markdown_files.{content,id} AS cards FROM quiz WHERE mongoId == "${mongoId}"`,
    );

    return related_card_record[0][0];
  }

  async get_related_quizzes(cardId: RecordId): Promise<
    {
      cardId: RecordId;
      quizzes: {
        id: RecordId;
        mongoId: string;
      };
    }[]
  > {
    const surrealDb = await surrealDBClient.getDb();
    const related_card_record = await surrealDb.query<
      {
        cardId: RecordId;
        quizzes: {
          id: RecordId;
          mongoId: string;
        };
      }[][]
    >(
      `SELECT in AS quizzes, out AS cardId FROM quiz_to_card WHERE out == $cardId fetch quizzes`,
      {
        cardId: cardId,
      },
    );

    return related_card_record[0];
  }

  async get_all_cards() {
    const surrealDb = await surrealDBClient.getDb();
    const cards = await surrealDb.query<{ id: RecordId }[][]>(
      `SELECT id FROM markdown_files`,
    );
    return cards[0];
  }

  /**
   * Fetches quizzes that don't have AI analysis or have empty AI analysis
   * @param selector Quiz selection criteria
   * @returns Promise with filtered quizzes that need AI analysis
   */
  async fetchQuizzesWithoutAIAnalysis(selector: quizSelector): Promise<quiz[]> {
    try {
      console.log(selector);
      const { cls, mode, quizNum, unit, source, extractedYear, randomize } =
        selector;
      if (quizNum > 350) {
        throw new Error(
          `Quizzes fetching failed: cannot fetch more than 350 quizzes in single request`,
        );
      }
      const { db } = await connectToDatabase();

      // Build query
      const pipeline = [];
      const query: Filter<quiz> = {
        ...(cls && cls.length > 0 ? { class: { $in: cls } } : {}),
        ...(mode && mode.length > 0
          ? { type: { $in: mode as ("A1" | "A2" | "A3" | "B" | "X")[] } }
          : {}),
        ...(unit && unit.length > 0 ? { unit: { $in: unit } } : {}),
        ...(source && source.length > 0 ? { source: { $in: source } } : {}),
        ...(extractedYear && extractedYear.length > 0
          ? { extractedYear: { $in: extractedYear } }
          : {}),
        // Add filter for quizzes without AI analysis or with empty AI analysis
        $or: [
          { "analysis.ai_analysis": { $exists: false } },
          { "analysis.ai_analysis": { $eq: null } },
          { "analysis.ai_analysis": { $eq: "" } },
          { "analysis.ai_analysis": { $regex: /^\s*$/ } },
        ],
      };

      let quizes: quiz[] = [];

      if (randomize !== false) {
        pipeline.push({ $sample: { size: quizNum } });
      }

      quizes = await db
        .collection<quiz>("quiz")
        .aggregate<quiz>([{ $match: query }, ...pipeline])
        .limit(quizNum)
        .toArray();

      return quizes;
    } catch (error) {
      this.logger.error("Quiz fetch error:", error);
      throw error;
    }
  }
}
