import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';
console.log(__dirname);
export default defineConfig({
  schema:
    '/workspace/libs/knowledgeBase/knowledge-db/entity-db/src/prisma/schema.prisma',
  migrations: {
    path: './src/prisma/migrations',
  },
  datasource: {
    url: env('ENTITY_DATABASE_URL'),
  },
});
