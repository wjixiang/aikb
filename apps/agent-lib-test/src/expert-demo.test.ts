/**
 * Expert Demo Test - Run via vitest to avoid tsx/esbuild decorator issues
 *
 * Usage:
 *   pnpm vitest run src/expert-demo.test.ts
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

describe('Expert Demo', () => {
    it('should load expert config', async () => {
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');

        expect(existsSync(expertDir)).toBe(true);

        const configPath = join(expertDir, 'config.json');
        expect(existsSync(configPath)).toBe(true);

        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        expect(config.id).toBe('hi-agent');
        expect(config.displayName).toBeDefined();
    });

    it('should have valid index.ts with createExpertConfig', async () => {
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');
        const indexPath = join(expertDir, 'index.ts');

        expect(existsSync(indexPath)).toBe(true);

        // Try to import the expert
        const expertModule = await import(`file://${indexPath}`);
        expect(expertModule.default).toBeDefined();
    });

    it('should be able to load ExpertConfig from index.ts', async () => {
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');
        const indexPath = join(expertDir, 'index.ts');

        // Import the expert factory - createSimpleExpertConfig is called at module load time
        const expertModule = await import(`file://${indexPath}`);
        const expertConfig = expertModule.default;

        // createSimpleExpertConfig returns ExpertConfig directly (not a factory function)
        expect(expertConfig.expertId).toBe('hi-agent');
        expect(expertConfig.displayName).toBeDefined();
        expect(expertConfig.description).toBeDefined();
    });

    it('should have Workspace.ts for custom components', async () => {
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');
        const workspacePath = join(expertDir, 'Workspace.ts');

        expect(existsSync(workspacePath)).toBe(true);

        // Try to import the workspace
        const workspaceModule = await import(`file://${workspacePath}`);
        expect(workspaceModule.HiAgentWorkspace).toBeDefined();
    });
});
