import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

export const config = {
  port: Number(process.env["PORT"]) || 3000,
  host: process.env["APP_HOST"] || "0.0.0.0",
  databaseUrl: process.env["DATABASE_URL"],
  corsOrigin: process.env["CORS_ORIGIN"] || "http://localhost:5173",
} as const;

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}
