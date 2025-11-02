import KnowGraphRetriever from "../lib/GraphRAG/KnowGraphRetriever";
import milvusCollectionOperator from "@/lib/milvus/milvusCollectionOperator";
import { getEmbeddings } from "../lib/langchain/provider";
import { QueryParam } from "../lib/GraphRAG/KnowGraphRetriever";

async function testExtractKeywords() {
  // Basic configuration for KnowGraphRetriever
  const config = {
    debug: true, // Enable debug output
    chat_modal_name: "glm-4-flash", // Specify a chat model name
    exampleNumber: 3, // Number of examples to use
    language: "English", // Language for extraction
    // redisUri: "redis://localhost:6379" // Uncomment and configure if using Redis cache
  };

  // Create milvus operator instance for testing
  const embeddingInstance = getEmbeddings()("text-embedding-3-large");
  const milvusOperator = new milvusCollectionOperator("test_collection");

  const retriever = new KnowGraphRetriever(config, milvusOperator);

  // Sample query and query parameters
  const sampleQuery = "肝硬化的临床表现有哪些？";
  const sampleQueryParam: QueryParam = {
    mode: "test",
    // You can add pre-defined keywords here if needed for testing the direct return path
    // high_level_keywords: ["common cold"],
    // low_level_keywords: ["symptoms"]
  };

  console.log(`Testing extract_keywords_only with query: "${sampleQuery}"`);
  console.log(`Query parameters: ${JSON.stringify(sampleQueryParam)}`);

  try {
    const [highLevelKeywords, lowLevelKeywords] =
      await retriever.extract_keywords_only(sampleQuery, sampleQueryParam);

    console.log("\n--- Extracted Keywords ---");
    console.log("High-level keywords:", highLevelKeywords);
    console.log("Low-level keywords:", lowLevelKeywords);
    console.log("--------------------------");
  } catch (error) {
    console.error("Error during keyword extraction test:", error);
  }
}

testExtractKeywords();

// To run this script, use the following command in your terminal:
// npx tsx src/script/test-extract-keywords.ts
