/**
 * Analyze actual document structure and link relationships
 */

import { connectToDatabase } from "@/lib/db/mongodb";
import { LinkExtractor } from "@/kgrag/lib/linkExtractor";
import { createLoggerWithPrefix } from "@/lib/console/logger";

const logger = createLoggerWithPrefix("AnalyzeDocuments");

async function analyzeDocuments() {
  try {
    logger.info("Analyzing document structure and links...");

    const { db } = await connectToDatabase();
    const documentsCollection = db.collection("notes");

    // Get all documents with their details
    const documents = await documentsCollection.find({}).toArray();

    logger.info(`Found ${documents.length} documents`);

    const documentMap = new Map();
    const linkTitles = new Set();

    // Build document map for quick lookup
    for (const doc of documents) {
      const id = doc._id.toString();
      const key = doc.key || "";
      const title = doc.title || "";
      const filename =
        key
          .split("/")
          .pop()
          ?.replace(/\.(md|txt|markdown)$/i, "") || "";

      documentMap.set(id, {
        id,
        key,
        title,
        filename,
        content: doc.content?.substring(0, 100) + "...",
      });

      // Extract links
      if (doc.content) {
        const links = LinkExtractor.extract(doc.content);
        for (const link of links) {
          linkTitles.add(link.title);
          logger.info("Found link:", {
            sourceId: id,
            sourceTitle: title || filename,
            linkTitle: link.title,
            linkAlias: link.alias,
          });
        }
      }
    }

    logger.info("Document map:", Array.from(documentMap.values()));
    logger.info("All link titles found:", Array.from(linkTitles));

    // Test each link title against document titles/keys
    for (const linkTitle of linkTitles) {
      logger.info(`Testing link: "${linkTitle}"`);

      // Try exact matches
      const exactTitle = await documentsCollection.findOne({
        title: linkTitle,
      });
      if (exactTitle) {
        logger.info(
          `✅ Exact title match: "${linkTitle}" -> ${exactTitle._id}`,
        );
        continue;
      }

      const exactKey = await documentsCollection.findOne({
        key: { $regex: new RegExp(`${linkTitle}\\.md$`, "i") },
      });
      if (exactKey) {
        logger.info(`✅ Exact key match: "${linkTitle}" -> ${exactKey._id}`);
        continue;
      }

      // Try case-insensitive
      const caseInsensitive = await documentsCollection.findOne({
        title: { $regex: new RegExp(`^${linkTitle}$`, "i") },
      });
      if (caseInsensitive) {
        logger.info(
          `✅ Case-insensitive match: "${linkTitle}" -> ${caseInsensitive._id}`,
        );
        continue;
      }

      // Try filename extraction
      const filenameMatch = await documentsCollection.findOne({
        key: { $regex: new RegExp(`${linkTitle}`, "i") },
      });
      if (filenameMatch) {
        logger.info(
          `✅ Filename match: "${linkTitle}" -> ${filenameMatch._id}`,
        );
        continue;
      }

      logger.info(`❌ No match found for: "${linkTitle}"`);
    }

    // Show document titles for reference
    logger.info("Available document titles/keys:");
    for (const [id, doc] of documentMap) {
      logger.info(`- ${id}: "${doc.title}" | "${doc.filename}" | "${doc.key}"`);
    }
  } catch (error) {
    logger.error("Analysis failed", { error });
    console.error("Analysis error:", error);
  }
}

// Run analysis if called directly
if (require.main === module) {
  analyzeDocuments();
}

export { analyzeDocuments };
