#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { embeddings } from "@/lib/langchain/provider";
import type { embeddingInstance } from "@/lib/langchain/provider";
import milvusCollectionOperator from "./milvusCollectionOperator";

interface CliArgs {
  collection: string;
  query: string;
  limit?: number;
  output?: string;
  expr?: string;
  partitionNames?: string[];
}

// 命令行参数配置
const argv = yargs(hideBin(process.argv))
  .parserConfiguration({
    "parse-numbers": true,
    "parse-positional-numbers": false,
  })
  .option("collection", {
    alias: "c",
    type: "string",
    description: "Milvus collection name",
    default: "default_collection",
    demandOption: false,
  })
  .option("query", {
    alias: "q",
    type: "string",
    description: "Search query text",
    demandOption: true,
  })
  .option("limit", {
    alias: "l",
    type: "number",
    description: "Maximum number of results to return",
    default: 10,
  })
  .option("output", {
    alias: "o",
    type: "string",
    description: "Output format (json|text)",
    default: "text",
  })
  .option("expr", {
    alias: "e",
    type: "string",
    description: "Filter expression",
  })
  .option("partitionNames", {
    alias: "p",
    type: "array",
    description: "Partition names to search",
  })
  .help()
  .parseSync() as CliArgs;

// 主函数
async function main() {
  try {
    // 实例化集合操作器
    if (!embeddings) {
      throw new Error("Embedding instance not initialized");
    }
    const operator = new milvusCollectionOperator(argv.collection);

    // 确保集合存在
    await operator.ensureCollectionExists();

    // 执行BM25搜索
    const searchParams = {
      collection_name: argv.collection,
      data: [argv.query],
      anns_field: "bm25_vector",
      limit: argv.limit || 10,
      output_fields: ["title", "content", "tags"],
      params: {
        metric_type: "BM25",
        params: {
          bm25_k1: 1.2,
          bm25_b: 0.75,
        },
      },
      expr: argv.expr,
      partition_names: argv.partitionNames,
    };

    // 调试输出搜索参数
    console.debug("BM25 Search Parameters:", {
      collection: argv.collection,
      query: argv.query,
      limit: argv.limit,
      expr: argv.expr,
      partitionNames: argv.partitionNames,
      bm25_params: { bm25_k1: 1.2, bm25_b: 0.75 },
    });

    // 处理中文查询参数
    const encodedQuery = encodeURIComponent(argv.query);
    const result = await operator.milvusClient.search({
      ...searchParams,
      data: [encodedQuery],
      params: {
        metric_type: "BM25",
        params: JSON.stringify({
          bm25_k1: 1.2,
          bm25_b: 0.75,
        }),
      },
    });
    if (!result || result.status.error_code !== "Success") {
      throw new Error(
        `Search failed: ${result?.status?.reason || "Unknown error"}`,
      );
    }
    // 处理输出
    if (argv.output === "json") {
      console.log(
        JSON.stringify(
          {
            query: argv.query,
            collection: argv.collection,
            total_results: result.results.length,
            results: result.results.map((doc: any) => ({
              title: doc.title,
              content: doc.content,
              tags: doc.tags,
              score: doc.distance,
              oid: doc.oid,
            })),
          },
          null,
          2,
        ),
      );
    } else {
      console.log("BM25 Search Results:");
      console.log(
        `Found ${result.results.length} results for query: "${argv.query}"`,
      );
      result.results.forEach((doc: any, index: number) => {
        console.log(`\nResult ${index + 1}:`);
        console.log(`Title: ${doc.title || "Untitled"}`);
        console.log(
          `Content: ${doc.content?.substring(0, 200) || "No content"}...`,
        );
        console.log(`Tags: ${doc.tags?.join(", ") || "None"}`);
        console.log(`Score: ${doc.distance?.toFixed(4) || "N/A"}`);
      });
    }
  } catch (error) {
    console.error("Error performing BM25 search:", error);
    process.exit(1);
  }
}

main();
