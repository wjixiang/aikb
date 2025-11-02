import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { QuizAnalysisChain } from "../lib/langchain/chains/quizAnalysis.chain";
import { Document } from "@langchain/core/documents";

async function main() {
  try {
    const argv = await yargs(hideBin(process.argv))
      .option("query", {
        alias: "q",
        type: "string",
        description: "The query to analyze",
        demandOption: true,
      })
      .option("verbose", {
        alias: "v",
        type: "boolean",
        description: "Show verbose output including documents",
        default: false,
      }).argv;

    const chain = new QuizAnalysisChain({});
    const result = await chain.call({ query: argv.query });

    console.log("Summary:");
    console.log(result.summary);

    if (argv.verbose) {
      console.log("\nDocuments:");
      result.documents.forEach((doc: Document, i: number) => {
        console.log(`\nDocument ${i + 1}:`);
        console.log(doc.pageContent);
        console.log("Metadata:", JSON.stringify(doc.metadata));
      });
    }
  } catch (error) {
    console.error("Error running quiz analysis:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(console.error);
