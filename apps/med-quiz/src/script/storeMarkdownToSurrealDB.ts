import fs from "fs";
import path from "path";
import pLimit from "p-limit";
import { surrealDBClient } from "@/kgrag/database/surrrealdbClient";
import { embedding } from "@/kgrag/lib/embedding";
import ChunkStorage from "@/kgrag/database/chunkStorage";
import { createLoggerWithPrefix } from "@/lib/console/logger";

const logger = createLoggerWithPrefix("MarkdownToDB");

interface MarkdownFile {
  filePath: string;
  content: string;
}

async function readMarkdownFiles(dirPath: string): Promise<MarkdownFile[]> {
  const files: MarkdownFile[] = [];

  async function walkDirectory(currentPath: string) {
    const entries = await fs.promises.readdir(currentPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walkDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        let content = await fs.promises.readFile(fullPath, "utf-8");
        // Remove YAML frontmatter if exists
        if (content.startsWith("---")) {
          const endOfYaml = content.indexOf("---", 3);
          if (endOfYaml !== -1) {
            content = content.slice(endOfYaml + 3).trim();
          }
        }
        files.push({
          filePath: path.basename(fullPath),
          content: `# ${path.basename(fullPath, ".md")}\n\n${content}`,
        });
      }
    }
  }

  await walkDirectory(dirPath);
  return files;
}

async function storeMarkdownToDB(
  tableName: string,
  markdownFiles: MarkdownFile[],
) {
  try {
    await surrealDBClient.connect();
    const db = await surrealDBClient.getDb();

    const chunkStorage = new ChunkStorage(
      db,
      tableName,
      embedding,
      0.2, // cosine_better_than_threshold
    );

    // Limit concurrency to 5 operations at a time
    const limit = pLimit(20);

    const storagePromises = markdownFiles.map((file) =>
      limit(async () => {
        try {
          logger.info(`Processing file: ${file.filePath}`);

          const fileEmbedding = await embedding(file.content);
          if (!fileEmbedding) {
            logger.error(
              `Failed to generate embedding for file: ${file.filePath}`,
            );
            return;
          }

          await chunkStorage.create({
            referenceIds: [],
            embedding: fileEmbedding as number[],
            content: file.content,
            filePath: file.filePath,
            title: path.basename(file.filePath, ".md"),
          });

          logger.info(`Successfully stored: ${file.filePath}`);
        } catch (error) {
          logger.error(`Error processing file ${file.filePath}:`, error);
        }
      }),
    );

    await Promise.all(storagePromises);
  } finally {
    await surrealDBClient.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(
      "Usage: tsx storeMarkdownToSurrealDB.ts <directory_path> <table_name>",
    );
    process.exit(1);
  }

  const [dirPath, tableName] = args;

  try {
    if (!fs.existsSync(dirPath)) {
      console.error(`Directory does not exist: ${dirPath}`);
      process.exit(1);
    }

    logger.info(`Reading markdown files from: ${dirPath}`);
    const markdownFiles = await readMarkdownFiles(dirPath);

    if (markdownFiles.length === 0) {
      logger.warn("No markdown files found in the specified directory");
      return;
    }

    logger.info(
      `Found ${markdownFiles.length} markdown files, storing to table: ${tableName}`,
    );
    await storeMarkdownToDB(tableName, markdownFiles);
    logger.info("All files processed successfully");
  } catch (error) {
    logger.error("Error in main process:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error("Unhandled error:", err);
  process.exit(1);
});
