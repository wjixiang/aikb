/**
 * Link indexing service for bidirectional link management
 */

import { connectToDatabase } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";
import { LinkExtractor } from "../lib/linkExtractor";
import {
  LinkRelationship,
  DocumentWithLinks,
  LinkValidationResult,
} from "../types/linkTypes";
import { createLoggerWithPrefix } from "@/lib/console/logger";
import * as dotenv from "dotenv";
dotenv.config();

export class LinkIndexingService {
  private logger = createLoggerWithPrefix("LinkIndexingService");
  private readonly LINKS_COLLECTION = "links";
  private readonly DOCUMENTS_COLLECTION =
    process.env.KB_MONGO_COLLECTION_NAME ?? "knowledgeBase";

  /**
   * Index all links in a document
   * @param documentId Document ID to index
   * @param content Document content
   * @param title Document title
   */
  async indexDocument(
    documentId: string,
    content: string,
    title: string,
  ): Promise<void> {
    try {
      this.logger.info(
        `Indexing document links: documentId=${documentId}, title=${title}`,
      );

      const links = LinkExtractor.extract(content);

      // Start transaction-like operation
      await this.removeExistingLinks(documentId);

      if (links.length === 0) {
        this.logger.info(`No links found in document: ${documentId}`);
        await this.updateDocumentLinkMetadata(documentId, []);
        return;
      }

      this.logger.info(
        `Found ${links.length} links in document: ${documentId}`,
      );

      // Create forward links
      const forwardLinks = await this.createForwardLinks(
        documentId,
        title,
        links,
      );

      // Create backward links for each target
      await this.createBackwardLinks(documentId, title, forwardLinks);

      // Update document metadata
      await this.updateDocumentLinkMetadata(documentId, forwardLinks);

      this.logger.info(
        `Document links indexed successfully: documentId=${documentId}, linkCount=${links.length}`,
      );
    } catch (error) {
      this.logger.error(`Failed to index document links: ${error}`);
      throw error;
    }
  }

  /**
   * Remove all existing links for a document
   * @param documentId Document ID
   */
  private async removeExistingLinks(documentId: string): Promise<void> {
    try {
      const { db } = await connectToDatabase();
      const linksCollection = db.collection(this.LINKS_COLLECTION);

      const result = await linksCollection.deleteMany({
        $or: [{ sourceId: documentId }, { targetId: documentId }],
      });

      this.logger.info(
        `Removed existing links: documentId=${documentId}, deletedCount=${result.deletedCount}`,
      );
    } catch (error) {
      this.logger.error(`Failed to remove existing links: ${error}`);
      throw error;
    }
  }

  /**
   * Create forward links (document -> linked documents)
   * @param documentId Source document ID
   * @param sourceTitle Source document title
   * @param links Extracted links
   */
  private async createForwardLinks(
    documentId: string,
    sourceTitle: string,
    links: Array<{
      title: string;
      alias?: string;
      position: number;
      context?: string;
    }>,
  ): Promise<Array<{ targetId: string; targetTitle: string }>> {
    const forwardLinks: Array<{ targetId: string; targetTitle: string }> = [];

    try {
      const { db } = await connectToDatabase();
      const linksCollection = db.collection(this.LINKS_COLLECTION);
      const documentsCollection = db.collection(this.DOCUMENTS_COLLECTION);

      this.logger.info(
        `Creating forward links: documentId=${documentId}, sourceTitle=${sourceTitle}, linkCount=${links.length}`,
      );

      for (const link of links) {
        if (!LinkExtractor.validateTitle(link.title)) {
          this.logger.info(`Skipping invalid link title: ${link.title}`);
          continue;
        }

        // Find target document by title - try multiple approaches
        const searchTitle = link.title.trim();
        this.logger.info(`Searching for target document: title=${searchTitle}`);

        // Try multiple matching strategies
        let targetDoc = null;

        // Strategy 1: Exact title match
        targetDoc = await documentsCollection.findOne({ title: searchTitle });

        // Strategy 2: Case-insensitive title match
        if (!targetDoc) {
          targetDoc = await documentsCollection.findOne({
            title: {
              $regex: new RegExp(`^${this.escapeRegExp(searchTitle)}$`, "i"),
            },
          });
        }

        // Strategy 3: Key contains title (extract filename)
        if (!targetDoc) {
          const filenameMatch = await documentsCollection.findOne({
            key: {
              $regex: new RegExp(`${this.escapeRegExp(searchTitle)}`, "i"),
            },
          });
          if (filenameMatch) targetDoc = filenameMatch;
        }

        // Strategy 4: Extract title from key
        if (!targetDoc) {
          const keyTitleMatch = await documentsCollection.findOne({
            $expr: {
              $regexMatch: {
                input: { $arrayElemAt: [{ $split: ["$key", "/"] }, -1] },
                regex: new RegExp(`^${this.escapeRegExp(searchTitle)}`, "i"),
              },
            },
          });
          if (keyTitleMatch) targetDoc = keyTitleMatch;
        }

        // Strategy 5: Remove extension and match
        if (!targetDoc) {
          const cleanTitle = searchTitle.replace(/\.(md|txt|markdown)$/i, "");
          targetDoc = await documentsCollection.findOne({
            $or: [
              { title: cleanTitle },
              {
                title: {
                  $regex: new RegExp(`^${this.escapeRegExp(cleanTitle)}$`, "i"),
                },
              },
              {
                key: {
                  $regex: new RegExp(`${this.escapeRegExp(cleanTitle)}`, "i"),
                },
              },
            ],
          });
        }

        if (targetDoc) {
          const targetId = targetDoc._id.toString();
          const targetTitle = targetDoc.title || link.title;

          // Create forward link with upsert to handle duplicates
          const result = await linksCollection.updateOne(
            {
              sourceId: documentId,
              targetId,
              linkType: "forward",
            },
            {
              $set: {
                sourceTitle,
                targetTitle,
                alias: link.alias,
                position: link.position,
                context: link.context,
                updatedAt: new Date(),
              },
              $setOnInsert: {
                createdAt: new Date(),
              },
            },
            { upsert: true },
          );

          this.logger.info(
            `Updated/created forward link: sourceId=${documentId}, targetId=${targetId}, upserted=${result.upsertedCount}`,
          );

          forwardLinks.push({ targetId, targetTitle });
        } else {
          this.logger.info(`Target document not found: title=${searchTitle}`);
        }
      }

      this.logger.info(
        `Forward links created: documentId=${documentId}, createdCount=${forwardLinks.length}`,
      );

      return forwardLinks;
    } catch (error) {
      this.logger.error(`Failed to create forward links: ${error}`);
      throw error;
    }
  }

  /**
   * Create backward links (documents linking to this document)
   * @param documentId Source document ID
   * @param sourceTitle Source document title
   * @param forwardLinks Array of forward links to create backward links for
   */
  private async createBackwardLinks(
    documentId: string,
    sourceTitle: string,
    forwardLinks: Array<{ targetId: string; targetTitle: string }>,
  ): Promise<void> {
    try {
      const { db } = await connectToDatabase();
      const linksCollection = db.collection(this.LINKS_COLLECTION);

      for (const link of forwardLinks) {
        // Create backward link with upsert to handle duplicates
        const result = await linksCollection.updateOne(
          {
            sourceId: link.targetId,
            targetId: documentId,
            linkType: "backward",
          },
          {
            $set: {
              sourceTitle: link.targetTitle,
              targetTitle: sourceTitle,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              position: 0,
              createdAt: new Date(),
            },
          },
          { upsert: true },
        );

        this.logger.info(
          `Updated/created backward link: sourceId=${link.targetId}, targetId=${documentId}, upserted=${result.upsertedCount}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to create backward links: ${error}`);
      throw error;
    }
  }

  /**
   * Update document metadata with link information
   * @param documentId Document ID
   * @param forwardLinks Array of forward links
   */
  private async updateDocumentLinkMetadata(
    documentId: string,
    forwardLinks: Array<{ targetId: string; targetTitle: string }>,
  ): Promise<void> {
    try {
      const { db } = await connectToDatabase();
      const documentsCollection = db.collection(this.DOCUMENTS_COLLECTION);

      // Get backward links count
      const linksCollection = db.collection(this.LINKS_COLLECTION);
      const backwardLinks = await linksCollection
        .find({ targetId: documentId, linkType: "backward" })
        .toArray();

      const result = await documentsCollection.updateOne(
        { _id: new ObjectId(documentId) },
        {
          $set: {
            "metadata.forwardLinks": forwardLinks.map((link) => link.targetId),
            "metadata.backwardLinks": backwardLinks.map(
              (link) => link.sourceId,
            ),
            "metadata.linkCount": forwardLinks.length + backwardLinks.length,
            "metadata.lastLinkUpdate": new Date(),
          },
        },
      );

      this.logger.info(
        `Updated document metadata: documentId=${documentId}, modifiedCount=${result.modifiedCount}`,
      );
    } catch (error) {
      this.logger.error(`Failed to update document link metadata: ${error}`);
      throw error;
    }
  }

  /**
   * Get forward links for a document
   * @param documentId Document ID
   * @returns Array of linked documents
   */
  async getForwardLinks(documentId: string): Promise<LinkRelationship[]> {
    try {
      const { db } = await connectToDatabase();
      const linksCollection = db.collection(this.LINKS_COLLECTION);

      const links = await linksCollection
        .find({ sourceId: documentId, linkType: "forward" })
        .sort({ position: 1 })
        .toArray();

      return links.map((link) => ({
        sourceId: link.sourceId,
        targetId: link.targetId,
        sourceTitle: link.sourceTitle,
        targetTitle: link.targetTitle,
        alias: link.alias,
        linkType: link.linkType,
        position: link.position,
        context: link.context,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      }));
    } catch (error) {
      this.logger.error(`Failed to get forward links: ${error}`);
      throw error;
    }
  }

  /**
   * Get backward links for a document
   * @param documentId Document ID
   * @returns Array of documents linking to this document
   */
  async getBackwardLinks(documentId: string): Promise<LinkRelationship[]> {
    try {
      const { db } = await connectToDatabase();
      const linksCollection = db.collection(this.LINKS_COLLECTION);

      const links = await linksCollection
        .find({ targetId: documentId, linkType: "backward" })
        .sort({ updatedAt: -1 })
        .toArray();

      return links.map((link) => ({
        sourceId: link.sourceId,
        targetId: link.targetId,
        sourceTitle: link.sourceTitle,
        targetTitle: link.targetTitle,
        alias: link.alias,
        linkType: link.linkType,
        position: link.position,
        context: link.context,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      }));
    } catch (error) {
      this.logger.error(`Failed to get backward links: ${error}`);
      throw error;
    }
  }

  /**
   * Get complete link graph for a document
   * @param documentId Document ID
   * @returns Link graph with forward and backward links
   */
  async getLinkGraph(documentId: string) {
    try {
      const [forwardLinks, backwardLinks] = await Promise.all([
        this.getForwardLinks(documentId),
        this.getBackwardLinks(documentId),
      ]);

      return {
        documentId,
        forwardLinks,
        backwardLinks,
        totalLinks: forwardLinks.length + backwardLinks.length,
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get link graph: ${error}`);
      throw error;
    }
  }

  /**
   * Validate links in a document
   * @param content Document content
   * @returns Validation result with broken links
   */
  async validateLinks(content: string): Promise<LinkValidationResult> {
    try {
      const links = LinkExtractor.extract(content);
      const brokenLinks: LinkValidationResult["brokenLinks"] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      const { db } = await connectToDatabase();
      const documentsCollection = db.collection(this.DOCUMENTS_COLLECTION);

      for (const link of links) {
        if (!LinkExtractor.validateTitle(link.title)) {
          errors.push(`Invalid link title: ${link.title}`);
          continue;
        }

        const searchTitle = link.title.trim();
        const targetDoc = await documentsCollection.findOne({
          $or: [
            { title: searchTitle },
            {
              title: {
                $regex: new RegExp(`^${this.escapeRegExp(searchTitle)}$`, "i"),
              },
            },
            {
              key: {
                $regex: new RegExp(`${this.escapeRegExp(searchTitle)}`, "i"),
              },
            },
          ],
        });

        if (!targetDoc) {
          brokenLinks.push({
            title: link.title,
            position: link.position,
            context: link.context,
          });
        }
      }

      return {
        valid: brokenLinks.length === 0 && errors.length === 0,
        errors,
        warnings,
        brokenLinks,
      };
    } catch (error) {
      this.logger.error(`Failed to validate links: ${error}`);
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

      const { db } = await connectToDatabase();
      const documentsCollection = db.collection(this.DOCUMENTS_COLLECTION);

      // Clear all existing links
      await db.collection(this.LINKS_COLLECTION).deleteMany({});

      // Reset document link metadata
      await documentsCollection.updateMany(
        {},
        {
          $unset: {
            "metadata.forwardLinks": "",
            "metadata.backwardLinks": "",
            "metadata.linkCount": "",
            "metadata.lastLinkUpdate": "",
          },
        },
      );

      // Reindex all documents
      const documents = await documentsCollection.find({}).toArray();
      let processedCount = 0;

      for (const doc of documents) {
        if (doc.content) {
          await this.indexDocument(
            doc._id.toString(),
            doc.content,
            doc.title || this.extractTitleFromKey(doc.key),
          );
          processedCount++;
        }
      }

      this.logger.info(
        `Full link index rebuild completed: processedCount=${processedCount}`,
      );
      return processedCount;
    } catch (error) {
      this.logger.error(`Failed to rebuild link index: ${error}`);
      throw error;
    }
  }

  /**
   * Helper method to extract title from key
   */
  private extractTitleFromKey(key: string): string {
    const filename = key.split("/").pop() || key;
    return filename.replace(/\.(md|txt|markdown)$/i, "");
  }

  /**
   * Escape special characters for regex
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
