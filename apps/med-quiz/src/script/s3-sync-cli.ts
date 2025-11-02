#!/usr/bin/env tsx
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import knowledgeBase from "../kgrag/knowledgeBase";
import * as dotenv from "dotenv";
dotenv.config();

function validateEnvVars(argv: any) {
  if (!argv.s3Bucket && !process.env.KB_BUCKET_NAME) {
    console.error(
      "Error: Either provide --s3Bucket or set KB_BUCKET_NAME in .env",
    );
    process.exit(1);
  }

  if (!argv.mongoCollection && !process.env.KB_MONGO_COLLECTION_NAME) {
    console.error(
      "Error: Either provide --mongoCollection or set KB_MONGO_COLLECTION_NAME in .env",
    );
    process.exit(1);
  }

  if (process.env.KB_BUCKET_NAME?.trim() === "") {
    console.error("Error: KB_BUCKET_NAME in .env cannot be empty");
    process.exit(1);
  }

  if (process.env.KB_MONGO_COLLECTION_NAME?.trim() === "") {
    console.error("Error: KB_MONGO_COLLECTION_NAME in .env cannot be empty");
    process.exit(1);
  }
}

const kb = new knowledgeBase();

yargs(hideBin(process.argv))
  .command(
    "sync",
    "Sync data between S3 and MongoDB",
    (yargs) => {
      return yargs
        .option("s3Bucket", {
          type: "string",
          description: "S3 bucket name",
          default: process.env.KB_BUCKET_NAME,
        })
        .option("s3Prefix", {
          type: "string",
          description: "S3 prefix/path",
          default: "",
        })
        .option("mongoCollection", {
          type: "string",
          description: "MongoDB collection name",
          default: process.env.KB_MONGO_COLLECTION_NAME,
        })
        .option("direction", {
          type: "string",
          choices: ["download-only", "upload-only", "bidirectional"],
          description: "Sync direction",
          default: "download-only"
        });
    },
    async (argv) => {
      validateEnvVars(argv);
      try {
        await kb.s3_sync({
          s3Bucket: argv.s3Bucket || process.env.KB_BUCKET_NAME!,
          s3Prefix: argv.s3Prefix as string,
          mongoCollection:
            argv.mongoCollection || process.env.KB_MONGO_COLLECTION_NAME!,
          syncDirection: argv.direction as any,
        });
        console.log("Sync completed successfully");
      } catch (error) {
        console.error("Sync failed:", error);
        process.exit(1);
      }
    },
  )
  .demandCommand(1, "You need at least one command")
  .strict()
  .help()
  .parse();
