/// <reference types='vitest' />
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    cacheDir: '../../node_modules/.vite/libs/component-hub-integrated',
    test: {
      name: 'component-hub-integrated',
      watch: false,
      globals: true,
      environment: 'node',
      root: __dirname,
      include: [
        'src/**/*.{integrated,e2e}.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ],
      reporters: ['default'],
      coverage: {
        reportsDirectory: '../../coverage/libs/component-hub-integrated',
        provider: 'v8' as const,
      },
      env: {
        // Load environment variables from agent-mailbox .env for integration tests
        MAILBOX_DATABASE_URL: env.MAILBOX_DATABASE_URL || 'postgresql://admin:fl5ox03@localhost:5432/agent_mailbox',
        MAILBOX_BASE_URL: env.MAILBOX_BASE_URL || 'http://localhost:3000',
      },
    },
  };
});
