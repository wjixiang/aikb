import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';
console.log(__dirname);
export default defineConfig({
  schema: './src/prisma/schema.prisma',
  migrations: {
    path: './src/prisma/migrations',
  },
  datasource: {
    url: env('QUIZ_DATABASE_URL'),
  },
});
