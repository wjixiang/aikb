import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

export const config = {
  port: Number(process.env["PORT"]) || 4000,
  host: process.env["APP_HOST"] || "0.0.0.0",
  databaseUrl: process.env["DATABASE_URL"],
  corsOrigin: process.env["CORS_ORIGIN"] || "http://localhost:5173",
  s3: {
    endpoint: process.env["S3_ENDPOINT"],
    region: process.env["S3_REGION"] || "us-east-1",
    bucket: process.env["S3_BUCKET"],
    accessKeyId: process.env["S3_ACCESS_KEY_ID"],
    secretAccessKey: process.env["S3_SECRET_ACCESS_KEY"],
    forcePathStyle: process.env["S3_FORCE_PATH_STYLE"] === "true",
    publicUrl: process.env["S3_PUBLIC_URL"],
  },
} as const;

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}
