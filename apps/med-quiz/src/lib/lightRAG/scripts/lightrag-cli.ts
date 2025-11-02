#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { LightRAGManager } from "../lightRAGmanager";
import type { QueryRequest } from "../lightRAGmanager";
import fs from "fs";
import readline from "readline";

const manager = new LightRAGManager(
  process.env.LIGHTRAG_API_URL || "http://localhost:3000",
);

yargs(hideBin(process.argv))
  .scriptName("lightrag")
  .usage("$0 <cmd> [args]")
  .command(
    "insert-file <file>",
    "Upload a single file",
    (yargs) => {
      return yargs.positional("file", {
        type: "string",
        describe: "Path to the file to upload",
      });
    },
    async (argv) => {
      try {
        const filePath = argv.file as string;
        if (!filePath) {
          console.error("Error: File path is required");
          process.exit(1);
        }
        const fileStream = fs.createReadStream(filePath);
        const stats = fs.statSync(filePath);
        const file = {
          stream: () => fileStream,
          size: stats.size,
          name: filePath.split("/").pop() || filePath,
          type: "application/octet-stream",
        } as unknown as File;

        const result = await manager.insertFile(file);
        console.log("File uploaded successfully:", result);
      } catch (err) {
        console.error("Error uploading file:", err);
      }
    },
  )
  .command(
    "insert-batch <files..>",
    "Upload multiple files",
    (yargs) => {
      return yargs.positional("files", {
        type: "string",
        describe: "Paths to files to upload",
        array: true,
      });
    },
    async (argv) => {
      try {
        const files = (argv.files as string[]).map((filePath) => {
          const fileStream = fs.createReadStream(filePath);
          const stats = fs.statSync(filePath);
          return {
            stream: () => fileStream,
            size: stats.size,
            name: filePath.split("/").pop(),
          } as unknown as File;
        });

        const result = await manager.insertBatchFiles(files);
        console.log("Batch upload result:", result);
      } catch (err) {
        console.error("Error uploading files:", err);
      }
    },
  )
  .command(
    "upload <file>",
    "Upload file to input directory",
    (yargs) => {
      return yargs.positional("file", {
        type: "string",
        describe: "Path to the file to upload",
        demandOption: true,
      });
    },
    async (argv) => {
      try {
        const filePath = argv.file as string;
        if (!filePath) {
          console.error("Error: File path is required");
          process.exit(1);
        }
        const fileStream = fs.createReadStream(filePath);
        const stats = fs.statSync(filePath);
        const file = {
          stream: () => fileStream,
          size: stats.size,
          name: filePath.split("/").pop() || filePath,
          type: "application/octet-stream",
        } as unknown as File;

        const result = await manager.uploadToInputDir(file);
        console.log("File uploaded to input directory:", result);
      } catch (err) {
        console.error("Error uploading file:", err);
      }
    },
  )
  .command("status", "Get document processing statuses", {}, async () => {
    try {
      const statuses = await manager.getDocumentStatuses();
      console.log("Document statuses:");
      console.log(JSON.stringify(statuses, null, 2));
    } catch (err) {
      console.error("Error getting document statuses:", err);
    }
  })
  .command(
    "query <text>",
    "Query the RAG system",
    (yargs) => {
      return yargs
        .positional("text", {
          type: "string",
          describe: "Query text",
        })
        .option("mode", {
          type: "string",
          choices: ["local", "global", "hybrid", "naive", "mix", "bypass"],
          default: "hybrid",
          describe: "Query mode",
        })
        .option("stream", {
          type: "boolean",
          default: false,
          describe: "Stream the response",
        });
    },
    async (argv) => {
      try {
        const queryRequest: QueryRequest = {
          query: argv.text as string,
          mode: argv.mode as
            | "local"
            | "global"
            | "hybrid"
            | "naive"
            | "mix"
            | "bypass",
        };

        if (argv.stream) {
          const stream = await manager.queryStream(queryRequest);
          const reader = stream.getReader();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            process.stdout.write(new TextDecoder().decode(value));
          }
        } else {
          const response = await manager.query(queryRequest);
          console.log("Response:", response.response);
        }
      } catch (err) {
        console.error("Error querying:", err);
      }
    },
  )
  .command("graph-labels", "List graph labels", {}, async () => {
    try {
      const labels = await manager.getGraphLabels();
      console.log("Graph labels:");
      console.log(JSON.stringify(labels, null, 2));
    } catch (err) {
      console.error("Error getting graph labels:", err);
    }
  })
  .command("knowledge-graph", "Get knowledge graph", {}, async () => {
    try {
      const graph = await manager.getKnowledgeGraph();
      console.log("Knowledge graph:");
      console.log(JSON.stringify(graph, null, 2));
    } catch (err) {
      console.error("Error getting knowledge graph:", err);
    }
  })
  .command("ollama-version", "Get Ollama version", {}, async () => {
    try {
      const version = await manager.getOllamaVersion();
      console.log("Ollama version:", version.version);
    } catch (err) {
      console.error("Error getting Ollama version:", err);
    }
  })
  .command("ollama-tags", "List Ollama models", {}, async () => {
    try {
      const tags = await manager.getOllamaTags();
      console.log("Ollama models:");
      console.log(JSON.stringify(tags, null, 2));
    } catch (err) {
      console.error("Error getting Ollama models:", err);
    }
  })
  .command(
    "generate <model> <prompt>",
    "Generate text with Ollama",
    (yargs) => {
      return yargs
        .positional("model", {
          type: "string",
          describe: "Model name",
        })
        .positional("prompt", {
          type: "string",
          describe: "Prompt text",
        });
    },
    async (argv) => {
      try {
        const stream = await manager.generateText({
          model: argv.model as string,
          prompt: argv.prompt as string,
          stream: true,
        });

        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          process.stdout.write(new TextDecoder().decode(value));
        }
      } catch (err) {
        console.error("Error generating text:", err);
      }
    },
  )
  .command(
    "chat <model>",
    "Chat with Ollama",
    (yargs) => {
      return yargs
        .positional("model", {
          type: "string",
          describe: "Model name",
        })
        .option("message", {
          type: "string",
          describe: "Message to send",
          array: true,
        });
    },
    async (argv) => {
      try {
        const messages = ((argv.message as string[]) || []).map((msg) => ({
          role: "user",
          content: msg,
        }));

        const stream = await manager.chat({
          model: argv.model as string,
          messages,
          stream: true,
        });

        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          process.stdout.write(new TextDecoder().decode(value));
        }
      } catch (err) {
        console.error("Error in chat:", err);
      }
    },
  )
  .command("auth-status", "Check authentication status", {}, async () => {
    try {
      const status = await manager.getAuthStatus();
      console.log("Auth status:", status);
    } catch (err) {
      console.error("Error checking auth status:", err);
    }
  })
  .command(
    "login <username> <password>",
    "Login to system",
    (yargs) => {
      return yargs
        .positional("username", {
          type: "string",
          describe: "Username",
        })
        .positional("password", {
          type: "string",
          describe: "Password",
        });
    },
    async (argv) => {
      try {
        const result = await manager.login({
          username: argv.username as string,
          password: argv.password as string,
        });
        console.log("Login successful. Access token:", result.access_token);
      } catch (err) {
        console.error("Login failed:", err);
      }
    },
  )
  .command("health", "Check system health", {}, async () => {
    try {
      const health = await manager.getHealthStatus();
      console.log("System health:", health);
    } catch (err) {
      console.error("Error checking health:", err);
    }
  })
  .demandCommand(1, "You need at least one command before moving on")
  .help().argv;
