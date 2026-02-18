import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';
console.log(__dirname);
export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: env('AGENT_DATABASE_URL'),
  },
});
