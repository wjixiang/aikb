import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import GraphStorage from "@/kgrag/database/graphStorage";
import { surrealDBClient } from "@/kgrag/database/surrrealdbClient";
import KnowledgeGraphRetriever from "@/kgrag/core/KnowledgeGraphRetriever"; // Import KnowledgeGraphRetriever
import ChunkStorage from "@/kgrag/database/chunkStorage"; // Import ChunkStorage
import { RecordId } from "surrealdb";
import { embedding } from "@/kgrag/lib/embedding";
import { KnowledgeGraphRetriever_Config } from "@/setting";
import { QuizQueryService } from "../quiz_graph_query_service";

async function runCli() {
  // Get API key and base URL from environment variables

  // Create Embeddings instance
  const embeddings = embedding;

  await surrealDBClient.connect();
  await surrealDBClient.connect();
  const db = await surrealDBClient.getDb();
  const graphStorage = new GraphStorage(db);

  // Create ChunkStorage and KnowledgeGraphRetriever instances
  const chunkStorage = new ChunkStorage(db, "chunks_test", embeddings); // Pass embedText as embedding_func
  const knowledgeGraphRetriever = new KnowledgeGraphRetriever(
    KnowledgeGraphRetriever_Config,
  );

  const queryService = new QuizQueryService(db, knowledgeGraphRetriever); // Pass both db and retriever

  yargs(hideBin(process.argv))
    .command(
      "get-chunks <quizId>",
      "Get related chunks for a quiz ID",
      (yags) => {
        yags.positional("quizId", {
          describe: "The SurrealDB RecordId of the quiz",
          type: "string",
          demandOption: true,
        });
      },
      async (argv) => {
        try {
          const quizId = new RecordId("quiz", argv.quizId as string);
          const chunks = await queryService.getRelatedChunksForQuiz(quizId);
          console.log("Related Chunks:", JSON.stringify(chunks, null, 2));
        } catch (error) {
          console.error("Error getting related chunks:", error);
        } finally {
          await surrealDBClient.close();
        }
      },
    )
    .command(
      "find-similar <quizId>",
      "Find similar quizzes based on shared chunks",
      (yags) => {
        yags.positional("quizId", {
          describe: "The SurrealDB RecordId of the quiz",
          type: "string",
          demandOption: true,
        });
        yags.option("limit", {
          describe: "Maximum number of similar quizzes to return",
          type: "number",
          default: 5,
        });
      },
      async (argv) => {
        try {
          const quizId = new RecordId("quiz", argv.quizId as string);
          const similarQuizzes = await queryService.findSimilarQuizzes(
            quizId,
            argv.limit as number,
          );
          console.log(
            "Similar Quizzes:",
            JSON.stringify(similarQuizzes, null, 2),
          );
        } catch (error) {
          console.error("Error finding similar quizzes:", error);
        } finally {
          await surrealDBClient.close();
        }
      },
    )
    .command(
      "generate-variants <quizId>",
      "Generate question variants for a quiz ID",
      (yags) => {
        yags.positional("quizId", {
          describe: "The SurrealDB RecordId of the quiz",
          type: "string",
          demandOption: true,
        });
        yags.option("variantCount", {
          describe: "Number of variants to generate",
          type: "number",
          default: 3,
        });
        yags.option("similarityThreshold", {
          describe: "Minimum similarity score for similar quizzes to consider",
          type: "number",
          default: 0.7,
        });
        yags.option("maxChunkDistance", {
          describe: "Maximum chunk distance to consider",
          type: "number",
          default: 2,
        });
      },
      async (argv) => {
        try {
          const quizId = new RecordId("quiz", argv.quizId as string);
          const options = {
            variantCount: argv.variantCount as number,
            similarityThreshold: argv.similarityThreshold as number,
            maxChunkDistance: argv.maxChunkDistance as number,
          };
          const result = await queryService.generateQuestionVariants(
            quizId,
            options,
          );
          console.log("Generated Variants:", JSON.stringify(result, null, 2));
        } catch (error) {
          console.error("Error generating variants:", error);
        } finally {
          await surrealDBClient.close();
        }
      },
    )
    .command(
      "get-quizzes <userQuery>",
      "Get relevant quizzes based on a user query using RAG and the knowledge graph",
      (yags) => {
        yags.positional("userQuery", {
          describe: "The user query string",
          type: "string",
          demandOption: true,
        });
        yags.option("top_k", {
          describe: "Number of top relevant chunks to retrieve",
          type: "number",
          default: 10,
        });
      },
      async (argv) => {
        try {
          const quizzes = await queryService.getQuizzesFromUserQuery(
            argv.userQuery as string,
            argv.top_k as number,
          );
          console.log(
            "Relevant Quizzes:",
            quizzes.map((e) =>
              e.type === "A3"
                ? e.mainQuestion
                : e.type == "B"
                  ? e.questions
                  : e.question,
            ),
          );
        } catch (error) {
          console.error("Error getting relevant quizzes:", error);
        } finally {
          await surrealDBClient.close();
        }
      },
    )
    .demandCommand()
    .help().argv;
}

runCli().catch(async (error) => {
  console.error("CLI execution failed:", error);
  await surrealDBClient.close();
});
