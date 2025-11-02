import { language } from "@/kgrag/core/type";
import { quiz_to_chunk } from "../quiz_to_chunk";
import Logger from "../../console/logger";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { surrealDBClient } from "@/kgrag/database/surrrealdbClient";
import ChunkStorage from "@/kgrag/database/chunkStorage";
import { embedding } from "@/kgrag/lib/embedding";
import KnowledgeGraphRetriever from "@/kgrag/core/KnowledgeGraphRetriever";

async function main() {
  const logger = new Logger("quiz_to_chunk_cli");

  // Parse command line arguments
  const argv = await yargs(hideBin(process.argv))
    .option("className", {
      type: "string",
      description: "Class name to filter quizzes",
      required: true,
    })
    .option("source", {
      type: "string",
      description: "Source to filter quizzes",
      required: true,
    }).argv;

  try {
    try {
      await surrealDBClient.connect();
    } catch (error) {
      console.error("Failed to connect to SurrealDB:", error);
      return; // Exit if connection fails
    }

    // Instantiate ChunkStorage
    const chunkTableName = "test_chunks"; // Replace with your actual chunk table name
    const chunkStorage = new ChunkStorage(
      await surrealDBClient.getDb(),
      chunkTableName,
      embedding,
      0.2, // cosine_better_than_threshold
    );

    // Instantiate KnowledgeGraphRetriever
    const retrieverConfig = {
      chunkTableName: chunkTableName,
      property_table_name: "test_properties", // Placeholder
      entity_table_name: "test_entities", // Placeholder
      semantic_search_threshold: 0.2, // Placeholder
      language: "en" as language, // Explicitly cast to language type
    };

    logger.info("Initializing KnowledgeGraphRetriever...");
    const retriever = new KnowledgeGraphRetriever(retrieverConfig);

    logger.info(
      `Processing quizzes for class: ${argv.className}, source: ${argv.source}`,
    );
    const results = await quiz_to_chunk(retriever, argv.className, argv.source);

    logger.info(`Completed processing ${results.length} quizzes`);
    console.log(JSON.stringify(results, null, 2));

    process.exit(0);
  } catch (error) {
    logger.error(`Error in quiz_to_chunk CLI: ${error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
