// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'src/core/index': 'src/core/index.ts',
    'src/components/index': 'src/components/index.ts',
    'src/components/ui/index': 'src/components/ui/index.ts',
    'src/components/utils/index': 'src/components/utils/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [
    '@prisma/client-runtime-utils',
    'pino',
    '@apollo/client',
    'graphql',
    '@apollo/client/dev',
    'ioredis',
    'events',
  ],
});
