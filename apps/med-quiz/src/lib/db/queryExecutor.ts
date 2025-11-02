// types/queryExecutor.ts
import { Model, FilterQuery, PipelineStage } from "mongoose";
import quizModal from "./quizModal";
import { quizTypeID } from "@/types/quizData.types";

interface QueryResult {
  filter: FilterQuery<any>;
  options: {
    sort?: { [key: string]: 1 | -1 };
    limit?: number | null;
    skip?: number | null;
    select?: string;
  };
}

interface ProjectionType {
  [key: string]: 1 | 0;
}

export class QueryExecutor {
  private models: { [key in quizTypeID]: Model<any> };

  constructor() {
    this.models = {
      A1: quizModal.a1,
      A2: quizModal.a2,
      A3: quizModal.a3,
      B: quizModal.b,
      X: quizModal.x,
    };
  }

  // 构建基础管道
  private buildBasePipeline(
    query: QueryResult,
    randomCount?: number,
  ): PipelineStage[] {
    const pipeline: PipelineStage[] = [];

    // 1. 匹配条件
    if (Object.keys(query.filter).length > 0) {
      pipeline.push({ $match: query.filter });
    }

    // 2. 随机采样（如果需要）
    if (randomCount !== undefined) {
      pipeline.push({ $sample: { size: randomCount } });
    }

    // 3. 排序
    if (query.options.sort && Object.keys(query.options.sort).length > 0) {
      pipeline.push({ $sort: query.options.sort });
    }

    // 4. 分页
    if (typeof query.options.skip === "number") {
      pipeline.push({ $skip: query.options.skip });
    }
    if (typeof query.options.limit === "number") {
      pipeline.push({ $limit: query.options.limit });
    }

    // 5. 字段投影
    if (query.options.select) {
      const projection: ProjectionType = {};
      query.options.select.split(" ").forEach((field) => {
        projection[field] = 1;
      });
      pipeline.push({ $project: projection });
    }

    return pipeline;
  }

  // 执行聚合查询
  private async executeAggregate(model: Model<any>, pipeline: PipelineStage[]) {
    try {
      return await model.aggregate(pipeline);
    } catch (error) {
      console.error("Aggregate execution error:", error);
      throw error;
    }
  }

  // 查询所有类型
  async findAll(query: QueryResult) {
    const pipeline = this.buildBasePipeline(query);
    const queries = Object.values(this.models).map((model) =>
      this.executeAggregate(model, pipeline),
    );
    const results = await Promise.all(queries);
    return results.flat();
  }

  // 按类型查询
  async findByType(type: quizTypeID, query: QueryResult) {
    const model = this.models[type];
    if (!model) {
      throw new Error(`Invalid quiz type: ${type}`);
    }
    const pipeline = this.buildBasePipeline(query);
    return await this.executeAggregate(model, pipeline);
  }

  // 随机查询
  async findRandom(
    type: quizTypeID | undefined,
    query: QueryResult,
    count: number,
  ) {
    try {
      const pipeline = this.buildBasePipeline(query, count);

      if (type) {
        const model = this.models[type];
        if (!model) {
          throw new Error(`Invalid quiz type: ${type}`);
        }
        return await this.executeAggregate(model, pipeline);
      } else {
        const queries = Object.values(this.models).map((model) =>
          this.executeAggregate(model, pipeline),
        );
        const results = await Promise.all(queries);
        const allResults = results.flat();

        // 如果总结果数量超过请求数量，随机选择指定数量
        if (allResults.length > count) {
          // Fisher-Yates shuffle
          for (let i = allResults.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allResults[i], allResults[j]] = [allResults[j], allResults[i]];
          }
          return allResults.slice(0, count);
        }
        return allResults;
      }
    } catch (error) {
      console.error("Random query execution error:", error);
      throw error;
    }
  }

  // 计数查询
  async count(query: QueryResult, type?: quizTypeID) {
    const countPipeline: PipelineStage[] = [
      { $match: query.filter },
      { $count: "total" },
    ];

    try {
      if (type) {
        const model = this.models[type];
        const result = await this.executeAggregate(model, countPipeline);
        return result[0]?.total || 0;
      }

      const counts = await Promise.all(
        Object.values(this.models).map((model) =>
          this.executeAggregate(model, countPipeline),
        ),
      );
      return counts.reduce(
        (total, result) => total + (result[0]?.total || 0),
        0,
      );
    } catch (error) {
      console.error("Count execution error:", error);
      throw error;
    }
  }

  /**
   * Processes a search query using semantic, keyword, and hybrid search methods
   * @param query - The search query string
   * @returns Promise containing array of search results
   */
  async processQuery(query: string): Promise<any[]> {
    // Execute searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      semanticSearch(query),
      keywordSearch(query),
    ]);

    // Combine and return results
    return hybridMerge(semanticResults, keywordResults);
  }
}

// Helper functions for search implementations
async function semanticSearch(query: string): Promise<any[]> {
  // TODO: Implement semantic search using vector embeddings
  return [];
}

async function keywordSearch(query: string): Promise<any[]> {
  // TODO: Implement keyword search using traditional text search
  return [];
}

async function hybridMerge(
  semanticResults: any[],
  keywordResults: any[],
): Promise<any[]> {
  // TODO: Implement hybrid merging algorithm
  return [...semanticResults, ...keywordResults];
}
