#!/usr/bin/env tsx
import rag_workflow, {
  rag_config,
} from "../kgrag/lib/llm_workflow/rag_workflow";
import { SupportedLLM } from "@/lib/LLM/LLMProvider";
import { ChatMessage } from "@/lib/agents/agent.types";

// Sample queries from the sample-queries.txt file
const SAMPLE_QUERIES = [
  "急性心肌梗死的病理生理机制",
  "高血压危象的诊断和治疗",
  "糖尿病肾病的发病机制",
  "心力衰竭的药物治疗指南",
  "脑卒中的急救处理流程",
  "抗生素耐药机制",
  "免疫治疗在非小细胞肺癌中的应用",
  "COVID-19长期心血管并发症",
];

async function testRagWorkflow(query: string, config: rag_config) {
  console.log(`Testing RAG workflow with query: "${query}"`);
  console.log(`Configuration:`, config);
  console.log("----------------------------------------");

  try {
    const result = await rag_workflow(query, config);

    console.log(`Retrieved ${result.bamlDocuments.length} documents`);

    // Log first few documents
    if (result.bamlDocuments.length > 0) {
      console.log("\nFirst 3 retrieved documents:");
      result.bamlDocuments.slice(0, 3).forEach((doc, index) => {
        console.log(`  ${index + 1}. Title: ${doc.title}`);
        console.log(`     Page: ${doc.page_number}`);
        console.log(`     Score: ${doc.score}`);
        console.log(
          `     Content preview: ${doc.content.substring(0, 100)}...`,
        );
        console.log("");
      });
    }

    console.log("Answer stream:");
    // Handle the stream
    for await (const chunk of result.stream) {
      process.stdout.write(chunk);
    }
    console.log("\n----------------------------------------");
    console.log("Test completed successfully");
  } catch (error) {
    console.error("Error during RAG workflow test:", error);
    throw error;
  }
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let query = args[0];

  // If no query provided, use a random sample query
  if (!query) {
    query = SAMPLE_QUERIES[Math.floor(Math.random() * SAMPLE_QUERIES.length)];
    console.log(`No query provided. Using random sample query: "${query}"`);
  }

  // Configuration for the RAG workflow
  const config: rag_config = {
    useHyDE: true,
    useHybrid: true,
    topK: 5,
    language: "zh",
    llm: "QiniuDeepseekV3", // Using the same LLM as set in LLMProvider
  };

  // Optional: Add chat history for context
  const messages: ChatMessage[] = [
    {
      sender: "user",
      content: "我想了解一些医学知识",
      timestamp: new Date(),
      isVisible: true,
      messageType: "content",
    },
    {
      sender: "ai",
      content: "好的，我可以帮您解答医学相关的问题。",
      timestamp: new Date(),
      isVisible: true,
      messageType: "content",
    },
  ];

  await testRagWorkflow(query, config);
}

// Run the main function
if (require.main === module) {
  main().catch(console.error);
}
