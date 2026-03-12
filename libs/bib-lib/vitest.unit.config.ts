/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(() => ({
    cacheDir: '../../node_modules/.vite/libs/bib-lib',
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
