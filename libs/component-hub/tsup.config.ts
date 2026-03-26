// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: true,
  target: 'node16',
  external: [
    'pino',
    '@anthropic-ai/sdk',
    '@apollo/client',
    'graphql',
    '@apollo/client/dev',
    'ioredis',
    'events',
    'inversify',
    'reflect-metadata',
    'bibliography-search',
  ],
});
