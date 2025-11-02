import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import UMLSAgent from "../lib/GraphRAG/UMLSAgent";

const argv = yargs(hideBin(process.argv))
  .command(
    "normalize <term>",
    "Normalize a medical term using UMLS",
    (yargs) => {
      return yargs.positional("term", {
        describe: "The medical term to normalize",
        type: "string",
      });
    },
    async (argv) => {
      // Logic for normalization
      const apiKey = process.env.UMLS_API_KEY; // Assuming API key is in environment variable
      if (!apiKey) {
        console.error("UMLS_API_KEY environment variable not set.");
        process.exit(1);
      }
      const agent = new UMLSAgent(apiKey);
      const result = await agent.normalizeTerm(argv.term as string);
      console.log("Normalization Result:", result);
    },
  )
  .command(
    "chat <query>",
    "Chat with the UMLS agent",
    (yargs) => {
      return yargs.positional("query", {
        describe: "The conversational query",
        type: "string",
      });
    },
    async (argv) => {
      // Logic for chat
      const apiKey = process.env.UMLS_API_KEY; // Assuming API key is in environment variable
      if (!apiKey) {
        console.error("UMLS_API_KEY environment variable not set.");
        process.exit(1);
      }
      const agent = new UMLSAgent(apiKey);
      const response = await agent.chat(argv.query as string);
      console.log("Chat Response:", response);
    },
  )
  .demandCommand(1, "You need at least one command before moving on")
  .help().argv;
