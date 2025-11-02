import KnowGraphRetriever, {
  KnowGraphRetrieverConfig,
} from "../lib/GraphRAG/KnowGraphRetriever";
import CacheManager from "../lib/GraphRAG/CacheManager";
import milvusCollectionOperator from "@/lib/milvus/milvusCollectionOperator";
import { embeddings } from "@/lib/langchain/provider";

async function testCacheLoading() {
  console.log("Testing KnowGraphRetriever cache loading...");

  // Instantiate CacheManager (assuming it connects to a local Redis or uses in-memory cache for testing)
  // For a real test, you might need to configure Redis URI
  const cacheManager = new CacheManager();

  // Instantiate KnowGraphRetriever
  const restrieverConfig: KnowGraphRetrieverConfig = {
    chat_modal_name: "glm-4-flash",
    exampleNumber: 2,
    language: "English",
  };
  const retriever = new KnowGraphRetriever(
    restrieverConfig,
    new milvusCollectionOperator("test"),
  );

  const testQuery = "What are the keywords for this test?";
  const cachedKeywords = {
    high_level_keywords: ["test"],
    low_level_keywords: ["cache", "loading"],
  };

  // Step 1: Put data into the cache
  console.log(`Putting data into cache for query: "${testQuery}"`);
  await cacheManager.set("query", testQuery, cachedKeywords);
  console.log("Data put into cache.");

  // Step 2: Call get_keywords_from_query, which should now hit the cache
  console.log(`Calling get_keywords_from_query for query: "${testQuery}"`);
  const result = await retriever.extract_keywords_only(testQuery, {
    mode: "local",
  });

  // Step 3: Verify the result
  console.log("Received result:", result);

  if (result && JSON.stringify(result) === JSON.stringify(cachedKeywords)) {
    console.log("Cache loading test PASSED: Received cached data.");
  } else {
    console.error(
      "Cache loading test FAILED: Did not receive expected cached data.",
    );
    console.error("Expected:", cachedKeywords);
    console.error("Received:", result);
  }

  // Clean up the cache entry (optional, but good practice for tests)
  console.log(`Cleaning up cache entry for query: "${testQuery}"`);
  await cacheManager.delete("query", testQuery);
  console.log("Cache entry cleaned up.");
}

testCacheLoading().catch(console.error);
