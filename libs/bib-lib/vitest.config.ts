/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(() => ({
    cacheDir: '../../node_modules/.vite/libs/bib-lib',
    build: {
        target: 'node18',
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'BibLib',
            fileName: (format) => `bib-lib.${format}.js`,
            formats: ['es', 'cjs']
        },
        rollupOptions: {
            external: [
                // Node.js built-in modules
                'fs', 'path', 'url', 'os', 'crypto', 'stream', 'net', 'dns', 'http', 'https', 'tls',
                'zlib', 'events', 'buffer', 'util', 'querystring', 'child_process', 'cluster',
                'worker_threads', 'module', 'perf_hooks', 'readline', 'timers', 'v8', 'process', 'assert',
                // Node.js prefixed modules
                'node:fs', 'node:path', 'node:url', 'node:os', 'node:crypto', 'node:stream',
                'node:net', 'node:dns', 'node:http', 'node:https', 'node:tls', 'node:zlib',
                'node:events', 'node:buffer', 'node:util', 'node:querystring', 'node:child_process',
                'node:cluster', 'node:worker_threads', 'node:module', 'node:perf_hooks',
                'node:readline', 'node:timers', 'node:v8', 'node:process', 'node:assert', 'node:async_hooks',
                // Prisma and database related
                '@prisma/client', '@prisma/adapter-pg', 'pg', '@prisma/client/runtime/library',
                // NestJS and server-side packages
                '@nestjs/common', '@nestjs/core', '@nestjs/platform-express',
                // Other Node.js-only packages
                'dotenv', 'reflect-metadata',
                // Workspace packages
                /node:.*/
            ],
            output: {
                globals: {}
            }
        }
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, '../..'),
            'bib-lib': resolve(__dirname, './src'),
            'bib-lib/*': resolve(__dirname, './src/*'),
        },
    },
    test: {
        name: 'bib-lib',
        watch: false,
        globals: true,
        environment: 'node',
        root: __dirname,
        include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: ['{src,tests}/**/*.{integrated,e2e}.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        reporters: ['default'],
        coverage: {
            reportsDirectory: '../../coverage/libs/bib-lib',
            provider: 'v8' as const,
        },
    },
}));
