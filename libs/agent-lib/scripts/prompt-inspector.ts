/**
 * System Prompt Inspector Script
 *
 * Outputs the full system prompt for an Expert, useful for debugging
 * and refining prompts.
 *
 * Usage:
 *   npx tsx scripts/prompt-inspector.ts <expert-name>
 *   npx tsx scripts/prompt-inspector.ts meta-analysis-article-retrieval
 *   npx tsx scripts/prompt-inspector.ts test-expert
 */

import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { AgentFactory } from '../src/core/agent/AgentFactory.js';
import { createExpertConfig } from '../src/core/expert/ExpertFactory.js';

// Import prompt sections for standalone rendering
import { generateWorkspaceGuide } from '../src/core/prompts/sections/workspaceGuide.js';
import { generateMailTaskGuide } from '../src/core/prompts/sections/mailTaskGuide.js';
import { generateActionPhaseGuidance } from '../src/core/prompts/sections/actionPhaseGuidance.js';

/**
 * Get experts directories to search
 */
function getExpertsDirs(): string[] {
    return [
        join(process.cwd(), 'src', 'core', 'expert', 'builtin'),
        join(process.cwd(), 'src', 'core', 'expert', 'templates'),
    ].filter(dir => existsSync(dir));
}

/**
 * Find expert directory by name
 */
function findExpertDirByName(expertName: string): string | null {
    for (const expertsDir of getExpertsDirs()) {
        const expertDir = join(expertsDir, expertName);
        if (existsSync(expertDir)) {
            return expertDir;
        }
    }
    return null;
}

/**
 * Load Expert configuration
 */
async function loadExpert(expertName: string): Promise<any> {
    const expertDir = findExpertDirByName(expertName);

    if (!expertDir) {
        const searchedDirs = getExpertsDirs();
        throw new Error(
            `Expert not found: ${expertName}\n` +
            `Searched in: ${searchedDirs.join(', ')}`
        );
    }

    // Try new format first (index.ts)
    const newFormatPath = join(expertDir, 'index.ts');
    if (existsSync(newFormatPath)) {
        const expertModule = await import(`file://${newFormatPath}`);
        const createExpert = expertModule.createExpertConfig || expertModule.default;
        if (!createExpert) {
            throw new Error(`Expert factory not found: ${newFormatPath}`);
        }
        return typeof createExpert === 'function' ? createExpert() : createExpert;
    }

    // Fallback to old format (expert.ts)
    const oldFormatPath = join(expertDir, 'expert.ts');
    if (existsSync(oldFormatPath)) {
        const expertModule = await import(`file://${oldFormatPath}`);
        const createExpert = expertModule.createExpertConfig || expertModule.default;
        if (!createExpert) {
            throw new Error(`Expert factory not found: ${oldFormatPath}`);
        }
        return typeof createExpert === 'function' ? createExpert() : createExpert;
    }

    throw new Error(
        `Expert entry point not found: ${expertDir}\n` +
        `Expected index.ts or expert.ts`
    );
}

/**
 * Build system prompt sections
 */
function buildSystemPrompt(config: any): string {
    // Use sop directly
    const sop = config.sop || '';

    // Render agent prompt section
    const agentPromptSection = `
---
SOP
---
${sop}

`;

    // Mail task guide (if mail is enabled)
    const mailTaskGuide = config.mailConfig?.enabled
        ? `\n${generateMailTaskGuide()}\n`
        : '';

    // Workspace guide
    const workspaceGuide = generateWorkspaceGuide();

    return `${workspaceGuide}${agentPromptSection}${mailTaskGuide}`;
}

/**
 * Build the full system prompt with action phase guidance
 */
async function buildFullSystemPrompt(config: any): Promise<string> {
    // Build base system prompt
    const baseSystemPrompt = buildSystemPrompt(config);

    // Generate action phase guidance (without thinking summary for inspection)
    const actionPhaseGuidance = generateActionPhaseGuidance();

    // Full prompt with action guidance prepended
    return `${actionPhaseGuidance}\n\n${baseSystemPrompt}`;
}

/**
 * Output the system prompt for an Expert
 */
export async function inspectPrompt(expertName: string, options: {
    showActionGuidance?: boolean;
    showWorkspaceGuide?: boolean;
    showMailGuide?: boolean;
    outputFile?: string;
} = {}): Promise<string> {
    const {
        showActionGuidance = true,
        showWorkspaceGuide = true,
        showMailGuide = true,
    } = options;

    console.log(chalk.cyan(`\n🔍 Loading expert: ${expertName}...\n`));

    // Load expert config
    const expertConfig = await loadExpert(expertName);

    console.log(chalk.green(`✓ Expert loaded: ${expertConfig.displayName}`));
    console.log(chalk.gray(`   ID: ${expertConfig.expertId}`));
    console.log(chalk.gray(`   Description: ${expertConfig.description || 'N/A'}`));
    console.log(chalk.gray(`   Components: ${expertConfig.components?.length || 0}`));
    console.log(chalk.gray(`   Mail-enabled: ${expertConfig.mailConfig?.enabled || false}`));

    // Build prompt sections
    console.log(chalk.cyan('\n📝 Building system prompt...\n'));

    const parts: string[] = [];

    // 1. Action Phase Guidance
    if (showActionGuidance) {
        const actionGuidance = generateActionPhaseGuidance();
        parts.push(`[ACTION PHASE GUIDANCE]\n${actionGuidance}`);
    }

    // 2. Workspace Guide
    if (showWorkspaceGuide) {
        const workspaceGuide = generateWorkspaceGuide();
        parts.push(`[WORKSPACE GUIDE]\n${workspaceGuide}`);
    }

    // 3. Expert Capability & Direction
    const capability = expertConfig.prompt?.capability || expertConfig.responsibilities || '';
    const direction = expertConfig.prompt?.direction || '';
    parts.push(`[EXPERT CAPABILITY]\n------------\nCapabilities\n------------\n${capability}\n\n[EXPERT DIRECTION]\n--------------
Work Direction\n--------------
${direction}`);

    // 4. Mail Task Guide
    if (showMailGuide && expertConfig.mailConfig?.enabled) {
        const mailGuide = generateMailTaskGuide();
        parts.push(`[MAIL TASK GUIDE]\n${mailGuide}`);
    }

    // 5. Toolbox and Component Tools (from AgentFactory)
    // Note: These require actual component instantiation
    parts.push(`[TOOLBOX & COMPONENT TOOLS]
To see the full Toolbox and Component Tools sections,
run the agent with --verbose or inspect the VirtualWorkspace directly.`);

    const fullPrompt = parts.join('\n\n');

    return fullPrompt;
}

/**
 * CLI entry point
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        console.log(chalk.bold.cyan('\nSystem Prompt Inspector\n'));
        console.log(chalk.gray('Usage:'));
        console.log(chalk.gray('  npx tsx scripts/prompt-inspector.ts <expert-name> [options]'));
        console.log(chalk.gray('  npx tsx scripts/prompt-inspector.ts meta-analysis-article-retrieval'));
        console.log(chalk.gray('  npx tsx scripts/prompt-inspector.ts test-expert\n'));
        console.log(chalk.gray('Options:'));
        console.log(chalk.gray('  --no-action    Hide action phase guidance'));
        console.log(chalk.gray('  --no-workspace Hide workspace guide'));
        console.log(chalk.gray('  --no-mail      Hide mail task guide'));
        console.log(chalk.gray('  -o <file>      Output to file\n'));
        return;
    }

    const expertName = args[0];
    const options = {
        showActionGuidance: !args.includes('--no-action'),
        showWorkspaceGuide: !args.includes('--no-workspace'),
        showMailGuide: !args.includes('--no-mail'),
        outputFile: args.includes('-o') ? args[args.indexOf('-o') + 1] : undefined,
    };

    try {
        const prompt = await inspectPrompt(expertName, options);

        console.log(chalk.bold.cyan('\n' + '='.repeat(80)));
        console.log(chalk.bold.cyan('SYSTEM PROMPT OUTPUT'));
        console.log(chalk.bold.cyan('='.repeat(80) + '\n'));

        if (options.outputFile) {
            const { writeFileSync } = await import('fs');
            writeFileSync(options.outputFile, prompt, 'utf-8');
            console.log(chalk.green(`✓ Prompt written to: ${options.outputFile}`));
        } else {
            console.log(prompt);
        }

        console.log(chalk.bold.cyan('\n' + '='.repeat(80) + '\n'));

    } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
