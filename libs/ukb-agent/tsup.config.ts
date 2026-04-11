import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'components/index': 'src/components/index.ts',
    'client/index': 'src/client/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: true,
  target: 'node16',
  external: [
    'inversify',
    'reflect-metadata',
    'agent-lib',
    'agent-lib/core',
    'agent-lib/components',
    'component-hub',
    'zod',
  ],
});
