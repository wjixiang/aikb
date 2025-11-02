#!/usr/bin/env ts-node

import KnowledgeGraphWeaver, {
  defaultKnowledgeGraphWeaverConfig,
  KnowledgeGraphWeaverConfig,
} from "../lib/GraphRAG/KnowledgeGraphWeaver";
import { JanusGraphConfig } from "../lib/GraphRAG/janusGraphClient";

async function main() {
  console.log("Starting test for synchronizeToJanusGraph...");

  // TODO: Replace with your actual JanusGraph configuration
  const janusGraphConfig: JanusGraphConfig = {
    host: "localhost",
    port: 8182,
    // username: 'your_username',
    // password: 'your_password',
  };

  // TODO: Adjust other KnowledgeGraphWeaverConfig parameters as needed for your test
  // const config: KnowledgeGraphWeaverConfig = {
  //     chunkThreshold: 1000, // Example value
  //     chunkOverlap: 200, // Example value
  //     debug: true, // Set to true for detailed logging
  //     janusGraphConfig: janusGraphConfig,
  //     extract_llm_modal_name: 'your_llm_model_name', // Example value
  //     language: 'Chinese', // Example value
  //     tuple_delimiter: '|', // Example value
  //     record_delimiter: '---', // Example value
  //     completion_delimiter: 'DONE', // Example value
  //     parallelLimit: 5, // Example value
  // };

  try {
    const waver = new KnowledgeGraphWeaver(defaultKnowledgeGraphWeaverConfig);
    await waver.synchronizeToJanusGraph();
    console.log("✅ synchronizeToJanusGraph test completed successfully.");
  } catch (error) {
    console.error("❌ synchronizeToJanusGraph test failed:", error);
  }
}

main().catch(console.error);
