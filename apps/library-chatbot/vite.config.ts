/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/library-chatbot',
  server: {
    host: true,
    cors: true,
    proxy: {
      // API proxy configuration
      '/api': {
        target: 'http://192.168.123.98:3000', // Backend server IP and port
        changeOrigin: true,
        secure: false, // Allow connections to HTTP (not HTTPS)
        // No rewrite needed since backend already has /api prefix
        configure: (proxy, options) => {
          // Log proxy requests for debugging
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, (options.target || '') + proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Receiving Response from the Target:', req.method, (options.target || '') + (req.url || ''));
          });
          proxy.on('error', (err, req, res) => {
            console.log('Proxy Error:', err);
          });
        }
      },
      // WebSocket proxy for real-time communication
      '/socket.io': {
        target: 'ws://192.168.123.98:3000',
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    host: true,
  },
  watch: {
    usePolling: true
  },
  plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  build: {
    outDir: '../../dist/apps/library-chatbot',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'library-chatbot',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/library-chatbot',
      provider: 'v8' as const,
    },
  },
}));
