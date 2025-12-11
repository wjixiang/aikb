import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.e2e.test.ts', '**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000, // 30 seconds timeout for e2e tests
    hookTimeout: 30000, // 30 seconds timeout for hooks
    pool: 'threads', // Use threads pool
    poolOptions: {
      threads: {
        singleThread: true, // Run tests sequentially to avoid RabbitMQ interference
      },
    },
  },
  resolve: {
    alias: {
      bibliography: resolve(__dirname, '../../libs/bibliography/src/index.ts'),
      'log-management': resolve(
        __dirname,
        '../../libs/log-management/src/index.ts',
      ),
      '@aikb/rabbitmq': resolve(__dirname, '../../libs/rabbitmq/src/index.ts'),
      'llm-shared/': resolve(
        __dirname,
        '../../libs/library-shared/src/index.ts',
      ),
    },
  },
});
