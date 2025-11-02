import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'src/**/*.stories.ts'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    deps: {
      inline: ['vitest'],
    },
  },
  optimizeDeps: {
    include: ['vitest'],
  },
  resolve: {
    alias: {
      '@': resolve(process.cwd(), './src'),
    },
  },
  ssr: {
    noExternal: ['vitest']
  }
});