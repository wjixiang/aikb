import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'node16',
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: [
    'inversify',
    'reflect-metadata',
    'agent-lib',
    'agent-soul-hub',
    'llm-api-client',
    'component-hub',
  ],
});
