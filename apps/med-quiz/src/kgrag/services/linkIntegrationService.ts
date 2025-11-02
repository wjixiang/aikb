/**
 * Integration service for adding link indexing to knowledge base
 */

import { LinkIndexingService } from "./linkIndexingService";
import { LinkSchemaManager } from "../database/linkSchema";
import { createLoggerWithPrefix } from "@/lib/console/logger";

export class LinkIntegrationService {
  private logger = createLoggerWithPrefix("LinkIntegrationService");
  private linkService = new LinkIndexingService();

  /**
   * Initialize the link indexing system
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info("Initializing link indexing system");

      // Initialize database schema
      await LinkSchemaManager.initializeCollection();

      this.logger.info("Link indexing system initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize link indexing system", { error });
      throw error;
    }
  }

  /**
   * Index a document's links after save/update
   * @param documentId Document ID
   * @param content Document content
   * @param title Document title
   */
  async indexDocumentLinks(
    documentId: string,
    content: string,
    title: string,
  ): Promise<void> {
    try {
      this.logger.debug("Indexing document links", { documentId, title });

      await this.linkService.indexDocument(documentId, content, title);

      this.logger.debug("Document links indexed successfully", { documentId });
    } catch (error) {
      this.logger.error("Failed to index document links", {
        error,
        documentId,
      });
      throw error;
    }
  }

  /**
   * Batch index multiple documents
   * @param documents Array of documents to index
   */
  async batchIndexDocuments(
    documents: Array<{
      id: string;
      content: string;
      title: string;
    }>,
  ): Promise<void> {
    try {
      this.logger.info("Starting batch link indexing", {
        count: documents.length,
      });

      for (const doc of documents) {
        await this.indexDocumentLinks(doc.id, doc.content, doc.title);
      }

      this.logger.info("Batch link indexing completed", {
        count: documents.length,
      });
    } catch (error) {
      this.logger.error("Failed to batch index documents", { error });
      throw error;
    }
  }

  /**
   * Rebuild entire link index
   * @returns Number of documents processed
   */
  async rebuildIndex(): Promise<number> {
    try {
      this.logger.info("Starting full link index rebuild");

      const processedCount = await this.linkService.rebuildIndex();

      this.logger.info("Full link index rebuild completed", { processedCount });
      return processedCount;
    } catch (error) {
      this.logger.error("Failed to rebuild link index", { error });
      throw error;
    }
  }

  /**
   * Validate all links in the system
   * @returns Validation results
   */
  async validateAllLinks() {
    try {
      this.logger.info("Starting link validation");

      const { connectToDatabase } = await import("@/lib/db/mongodb");
      const { db } = await connectToDatabase();
      const documentsCollection = db.collection("knowledgeBase");

      const documents = await documentsCollection.find({}).toArray();
      const results = [];

      for (const doc of documents) {
        if (doc.content) {
          const validation = await this.linkService.validateLinks(doc.content);
          results.push({
            documentId: doc._id.toString(),
            title: doc.title || doc.key,
            ...validation,
          });
        }
      }

      this.logger.info("Link validation completed", {
        documents: results.length,
      });
      return results;
    } catch (error) {
      this.logger.error("Failed to validate all links", { error });
      throw error;
    }
  }

  /**
   * Get link indexing status
   * @returns Status information
   */
  async getStatus() {
    try {
      const { connectToDatabase } = await import("@/lib/db/mongodb");
      const { db } = await connectToDatabase();

      const documentsCollection = db.collection("knowledgeBase");
      const linksCollection = db.collection("links");

      const [totalDocuments, indexedDocuments, totalLinks] = await Promise.all([
        documentsCollection.countDocuments(),
        documentsCollection.countDocuments({
          "metadata.lastLinkUpdate": { $exists: true },
        }),
        linksCollection.countDocuments({ linkType: "forward" }),
      ]);

      return {
        totalDocuments,
        indexedDocuments,
        totalLinks,
        indexingProgress:
          totalDocuments > 0 ? (indexedDocuments / totalDocuments) * 100 : 0,
        systemReady: true,
      };
    } catch (error) {
      this.logger.error("Failed to get link indexing status", { error });
      throw error;
    }
  }
}
