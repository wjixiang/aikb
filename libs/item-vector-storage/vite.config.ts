import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/item-vector-storage',
  plugins: [
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
      pathsToAliases: false,
    }),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  // Configuration for building your library.
  // See: https://vitejs.dev/guide/build.html#library-mode
  build: {
    outDir: '../../dist/libs/item-vector-storage',
    emptyOutDir: true,
    reportCompressedSize: true,
    target: 'node18', // Target Node.js environment instead of browser
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: 'src/index.ts',
      name: 'item-vector-storage',
      fileName: 'index',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['cjs' as const], // Use CommonJS for Node.js compatibility
    },
    rollupOptions: {
      // External packages that should not be bundled into your library.
      external: ['fs', '@prisma/client', 'bibliography-db', 'path', 'url', 'module', 'process', 'crypto', 'util', 'buffer', 'stream', 'events', 'os'],
    },
  },
  resolve: {
    alias: {
      // Add Node.js polyfills for browser compatibility
      'node:fs': 'fs',
      'node:path': 'path',
      'node:url': 'url',
      'node:module': 'module',
      'node:process': 'process',
      'node:crypto': 'crypto',
      'node:util': 'util',
      'node:buffer': 'buffer',
      'node:stream': 'stream',
      'node:events': 'events',
      'node:os': 'os',
    },
  },
  define: {
    // Define global variables for Node.js compatibility
    global: 'globalThis',
  },
  test: {
    name: 'item-vector-storage',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/item-vector-storage',
      provider: 'v8' as const,
    },
  },
}));
