import { createLoggerWithPrefix } from "@/lib/console/logger";
import { S3SyncService } from "./wiki/note_s3_syncing";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";
import { LinkIntegrationService } from "./services/linkIntegrationService";

export interface note_s3_sync_config {
  s3Bucket: string;
  s3Prefix: string;
  mongoCollection: string;
  syncDirection: "download-only" | "upload-only" | "bidirectional";
}

export interface TextDocument {
  id: string;
  key: string;
  title: string;
  content: string;
  lastModified: Date;
  metadata?: {
    size?: number;
    contentType?: string;
    tags?: string[];
  };
}

export interface SearchOptions {
  query?: string;
  limit?: number;
  offset?: number;
  tags?: string[];
  sortBy?: "lastModified" | "title" | "key";
  sortOrder?: "asc" | "desc";
}

export interface SearchResult {
  documents: TextDocument[];
  total: number;
  hasMore: boolean;
}

export interface KnowledgeBaseStats {
  totalDocuments: number;
  totalSize: number;
  lastSync: Date | null;
  tags: string[];
}

export default class knowledgeBase {
  private syncService: S3SyncService;
  private linkService: LinkIntegrationService;
  logger = createLoggerWithPrefix("knowledgeBase");

  constructor() {
    this.syncService = new S3SyncService();
    this.linkService = new LinkIntegrationService();
  }

  async s3_sync(config: note_s3_sync_config) {
    await this.syncService.sync(config);
  }

  /**
   * 获取单个文档内容
   * @param key 文档键名（通常是文件路径）
   * @param collectionName MongoDB集合名称
   * @returns 文档内容或null
   */
  async getDocument(
    key: string,
    collectionName: string = "notes",
  ): Promise<TextDocument | null> {
    try {
      this.logger.info("获取文档", { key, collectionName });
      const { db } = await connectToDatabase();
      const collection = db.collection(collectionName);

      const document = await collection.findOne({ key });

      if (!document) {
        this.logger.warn("文档未找到", { key, collectionName });
        return null;
      }

      return {
        id: document._id.toString(),
        key: document.key,
        title: this.extractTitleFromKey(document.key),
        content: document.content || "",
        lastModified: document.lastModified || new Date(),
        metadata: document.metadata || {},
      };
    } catch (error) {
      this.logger.error("获取文档失败", { error, key, collectionName });
      throw error;
    }
  }

  /**
   * 搜索文档
   * @param options 搜索选项
   * @param collectionName MongoDB集合名称
   * @returns 搜索结果
   */
  async searchDocuments(
    options: SearchOptions = {},
    collectionName: string = "notes",
  ): Promise<SearchResult> {
    try {
      this.logger.info("搜索文档", { options, collectionName });
      const { db } = await connectToDatabase();
      const collection = db.collection(collectionName);

      const {
        query = "",
        limit = 50,
        offset = 0,
        tags = [],
        sortBy = "lastModified",
        sortOrder = "desc",
      } = options;

      // 构建查询条件
      const filter: any = {};

      if (query) {
        filter.$or = [
          { key: { $regex: query, $options: "i" } },
          { content: { $regex: query, $options: "i" } },
        ];
      }

      if (tags.length > 0) {
        filter["metadata.tags"] = { $in: tags };
      }

      // 构建排序条件
      const sort: any = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      // 获取总数
      const total = await collection.countDocuments(filter);

      // 获取文档
      const documents = await collection
        .find(filter)
        .sort(sort)
        .skip(offset)
        .limit(limit)
        .toArray();

      const textDocuments: TextDocument[] = documents.map((doc) => ({
        id: doc._id.toString(),
        key: doc.key,
        title: this.extractTitleFromKey(doc.key),
        content: doc.content || "",
        lastModified: doc.lastModified || new Date(),
        metadata: doc.metadata || {},
      }));

      return {
        documents: textDocuments,
        total,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      this.logger.error("搜索文档失败", { error, options, collectionName });
      throw error;
    }
  }

  /**
   * 获取所有文档列表
   * @param collectionName MongoDB集合名称
   * @returns 文档列表
   */
  async listDocuments(
    collectionName: string = "notes",
  ): Promise<TextDocument[]> {
    try {
      this.logger.info("获取文档列表", { collectionName });
      const { db } = await connectToDatabase();
      const collection = db.collection(collectionName);

      const documents = await collection
        .find({})
        .sort({ lastModified: -1 })
        .toArray();

      return documents.map((doc) => ({
        id: doc._id.toString(),
        key: doc.key,
        title: this.extractTitleFromKey(doc.key),
        content: doc.content || "",
        lastModified: doc.lastModified || new Date(),
        metadata: doc.metadata || {},
      }));
    } catch (error) {
      this.logger.error("获取文档列表失败", { error, collectionName });
      throw error;
    }
  }

  /**
   * 获取知识库统计信息
   * @param collectionName MongoDB集合名称
   * @returns 统计信息
   */
  async getStats(
    collectionName: string = "notes",
  ): Promise<KnowledgeBaseStats> {
    try {
      this.logger.info("获取知识库统计信息", { collectionName });
      const { db } = await connectToDatabase();
      const collection = db.collection(collectionName);

      const [totalDocuments, documents] = await Promise.all([
        collection.countDocuments(),
        collection.find({}).toArray(),
      ]);

      const totalSize = documents.reduce(
        (sum, doc) => sum + (doc.content?.length || 0),
        0,
      );

      const tags = [
        ...new Set(documents.flatMap((doc) => doc.metadata?.tags || [])),
      ];

      const lastSync =
        documents.length > 0
          ? new Date(
              Math.max(...documents.map((d) => d.lastModified?.getTime() || 0)),
            )
          : null;

      return {
        totalDocuments,
        totalSize,
        lastSync,
        tags,
      };
    } catch (error) {
      this.logger.error("获取统计信息失败", { error, collectionName });
      throw error;
    }
  }

  /**
   * 根据ObjectID获取文档
   * @param id 文档ID
   * @param collectionName MongoDB集合名称
   * @returns 文档内容或null
   */
  async getDocumentById(
    id: string,
    collectionName: string = "notes",
  ): Promise<TextDocument | null> {
    try {
      this.logger.info("根据ID获取文档", { id, collectionName });
      const { db } = await connectToDatabase();
      const collection = db.collection(collectionName);

      const document = await collection.findOne({ _id: new ObjectId(id) });

      if (!document) {
        this.logger.warn("文档未找到", { id, collectionName });
        return null;
      }

      return {
        id: document._id.toString(),
        key: document.key,
        title: this.extractTitleFromKey(document.key),
        content: document.content || "",
        lastModified: document.lastModified || new Date(),
        metadata: document.metadata || {},
      };
    } catch (error) {
      this.logger.error("根据ID获取文档失败", { error, id, collectionName });
      throw error;
    }
  }

  /**
   * 从文件路径提取标题
   * @param key 文件路径
   * @returns 标题
   */
  private extractTitleFromKey(key: string): string {
    // 移除路径和扩展名
    const filename = key.split("/").pop() || key;
    return filename.replace(/\.(md|txt|markdown)$/i, "");
  }

  /**
   * 检查文档是否存在
   * @param key 文档键名
   * @param collectionName MongoDB集合名称
   * @returns 是否存在
   */
  async documentExists(
    key: string,
    collectionName: string = "notes",
  ): Promise<boolean> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments({ key });
      return count > 0;
    } catch (error) {
      this.logger.error("检查文档存在性失败", { error, key, collectionName });
      throw error;
    }
  }

  /**
   * 获取最近修改的文档
   * @param limit 限制数量
   * @param collectionName MongoDB集合名称
   * @returns 最近修改的文档列表
   */
  async getRecentDocuments(
    limit: number = 10,
    collectionName: string = "notes",
  ): Promise<TextDocument[]> {
    try {
      this.logger.info("获取最近文档", { limit, collectionName });
      const { db } = await connectToDatabase();
      const collection = db.collection(collectionName);

      const documents = await collection
        .find({})
        .sort({ lastModified: -1 })
        .limit(limit)
        .toArray();

      return documents.map((doc) => ({
        id: doc._id.toString(),
        key: doc.key,
        title: this.extractTitleFromKey(doc.key),
        content: doc.content || "",
        lastModified: doc.lastModified || new Date(),
        metadata: doc.metadata || {},
      }));
    } catch (error) {
      this.logger.error("获取最近文档失败", { error, limit, collectionName });
      throw error;
    }
  }

  /**
   * 获取文档的前向链接
   * @param documentId 文档ID
   * @returns 前向链接列表
   */
  async getForwardLinks(s3_key: string): Promise<any[]> {
    try {
      this.logger.info(`获取文档前向链接: ${s3_key}}`);
      const { db } = await connectToDatabase();

      const documentId = (
        await db.collection("knowledgeBase").findOne({ key: s3_key })
      )?._id.toString();
      const { LinkIndexingService } = await import(
        "./services/linkIndexingService"
      );
      const service = new LinkIndexingService();
      if (documentId) {
        this.logger.debug(`retrieve documentId: ${documentId}`);
        return await service.getForwardLinks(documentId);
      }
      throw new Error(`cannot find ducument: ${s3_key}`);
    } catch (error) {
      this.logger.error("获取前向链接失败", { error, s3_key });
      throw error;
    }
  }

  /**
   * 获取文档的后向链接
   * @param s3_key 文档ID
   * @returns 后向链接列表
   */
  async getBackwardLinks(s3_key: string): Promise<any[]> {
    try {
      this.logger.info(`获取文档后向链接: ${s3_key}}`);
      const { db } = await connectToDatabase();

      const documentId = (
        await db.collection("knowledgeBase").findOne({ key: s3_key })
      )?._id.toString();
      const { LinkIndexingService } = await import(
        "./services/linkIndexingService"
      );
      const service = new LinkIndexingService();
      if (documentId) {
        this.logger.debug(`retrieve documentId: ${documentId}`);
        return await service.getBackwardLinks(documentId);
      }
      throw new Error(`cannot find ducument: ${s3_key}`);
    } catch (error) {
      this.logger.error("获取后向链接失败", { error, s3_key });
      throw error;
    }
  }

  /**
   * 获取完整的链接图
   * @param documentId 文档ID
   * @returns 链接图信息
   */
  async getLinkGraph(documentId: string): Promise<any> {
    try {
      this.logger.info("获取文档链接图", { documentId });
      const { LinkIndexingService } = await import(
        "./services/linkIndexingService"
      );
      const service = new LinkIndexingService();
      return await service.getLinkGraph(documentId);
    } catch (error) {
      this.logger.error("获取链接图失败", { error, documentId });
      throw error;
    }
  }

  /**
   * 验证文档中的链接
   * @param content 文档内容
   * @returns 验证结果
   */
  async validateLinks(content: string): Promise<any> {
    try {
      this.logger.info("验证文档链接");
      const { LinkIndexingService } = await import(
        "./services/linkIndexingService"
      );
      const service = new LinkIndexingService();
      return await service.validateLinks(content);
    } catch (error) {
      this.logger.error("验证链接失败", { error });
      throw error;
    }
  }

  /**
   * 重建整个链接索引
   * @returns 处理的文档数量
   */
  async rebuildLinkIndex(): Promise<number> {
    try {
      this.logger.info("开始重建链接索引");
      const { LinkIndexingService } = await import(
        "./services/linkIndexingService"
      );
      const service = new LinkIndexingService();
      const count = await service.rebuildIndex();
      this.logger.info("链接索引重建完成", { processedCount: count });
      return count;
    } catch (error) {
      this.logger.error("重建链接索引失败", { error });
      throw error;
    }
  }

  /**
   * 初始化链接索引系统
   */
  async initializeLinkIndexing(): Promise<void> {
    try {
      this.logger.info("初始化链接索引系统");
      const { LinkIntegrationService } = await import(
        "./services/linkIntegrationService"
      );
      const service = new LinkIntegrationService();
      await service.initialize();
      this.logger.info("链接索引系统初始化完成");
    } catch (error) {
      this.logger.error("初始化链接索引系统失败", { error });
      throw error;
    }
  }
}
