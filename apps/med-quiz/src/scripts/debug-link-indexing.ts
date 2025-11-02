/**
 * Debug script for link indexing issues
 */

import { connectToDatabase } from "@/lib/db/mongodb";
import { LinkIndexingService } from "@/kgrag/services/linkIndexingService";
import { LinkExtractor } from "@/kgrag/lib/linkExtractor";
import { createLoggerWithPrefix } from "@/lib/console/logger";

const logger = createLoggerWithPrefix("DebugLinkIndexing");

async function debugLinkIndexing() {
  try {
    logger.info("Starting link indexing debug...");

    const { db } = await connectToDatabase();
    const documentsCollection = db.collection("knowledgeBase");
    const linksCollection = db.collection("links");

    // Check existing documents
    const documents = await documentsCollection.find({}).limit(5).toArray();
    logger.info(`Found ${documents.length} documents`);

    for (const doc of documents) {
      logger.info(
        `Document: id=${doc._id.toString()}, key=${doc.key}, title=${doc.title || "N/A"}`,
      );

      if (doc.content) {
        // Extract links from content
        const links = LinkExtractor.extract(doc.content);
        logger.info(
          `Extracted ${links.length} links from document ${doc._id.toString()}`,
        );

        for (const link of links) {
          logger.info(
            `Link found: title=${link.title}, alias=${link.alias || "N/A"}`,
          );

          // Test document lookup for each link
          const searchTitle = link.title.trim();
          let targetDoc = null;

          // Try exact title match
          targetDoc = await documentsCollection.findOne({ title: searchTitle });

          // Try case-insensitive title match
          if (!targetDoc) {
            targetDoc = await documentsCollection.findOne({
              title: { $regex: new RegExp(`^${searchTitle}$`, "i") },
            });
          }

          // Try key contains title
          if (!targetDoc) {
            targetDoc = await documentsCollection.findOne({
              key: { $regex: new RegExp(searchTitle, "i") },
            });
          }

          // Try filename extraction
          if (!targetDoc) {
            const filename = searchTitle.replace(/\.(md|txt|markdown)$/i, "");
            targetDoc = await documentsCollection.findOne({
              $or: [
                { title: filename },
                { key: { $regex: new RegExp(filename, "i") } },
              ],
            });
          }

          if (targetDoc) {
            logger.info(
              `✅ Found target: ${searchTitle} -> ${targetDoc._id.toString()}`,
            );
          } else {
            logger.info(`❌ No target found: ${searchTitle}`);
          }
        }
      }
    }

    // Check existing links
    const existingLinks = await linksCollection.find({}).toArray();
    logger.info(`Found ${existingLinks.length} existing links`);

    // Test indexing a specific document
    if (documents.length > 0) {
      const testDoc = documents[0];
      logger.info(`Testing indexing for document: ${testDoc._id.toString()}`);

      const service = new LinkIndexingService();
      await service.indexDocument(
        testDoc._id.toString(),
        testDoc.content || "",
        testDoc.title || testDoc.key,
      );

      // Check if links were created
      const newLinks = await linksCollection.find({}).toArray();
      logger.info(`Links after indexing: ${newLinks.length}`);

      for (const link of newLinks) {
        logger.info(
          `Link: source=${link.sourceTitle} -> target=${link.targetTitle}, type=${link.linkType}`,
        );
      }
    }

    logger.info("Debug completed");
  } catch (error) {
    logger.error(`Debug failed: ${error}`);
    console.error("Debug error:", error);
  }
}

// Run debug if called directly
if (require.main === module) {
  debugLinkIndexing();
}

export { debugLinkIndexing };
