/**
 * Expert Demo CLI - Run Expert tasks with real API
 *
 * Usage:
 *   npx tsx src/expert/cli/index.ts demo <expert-name> <input>
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import dotenv from 'dotenv';

// Early output - show we're starting
console.log(chalk.cyan('Loading...'));

// Load environment variables
dotenv.config();

import { ExpertInstance } from '../ExpertInstance.js';
import type { ExpertConfig, ExpertTask, ExpertResult } from '../types.js';
import { AgentFactory } from '../../agent/AgentFactory.js';
import { ProviderSettings } from '../../types/provider-settings.js';

/**
 * Get experts directories to search
 */
function getExpertsDirs(): string[] {
    return [
        join(process.cwd(), 'src', 'expert', 'builtin'),
        join(process.cwd(), 'experts'),
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
 * Supports both new format (index.ts) and old format (expert.ts)
 */
async function loadExpert(expertName: string): Promise<ExpertConfig> {
    const expertDir = findExpertDirByName(expertName);

    if (!expertDir) {
        const searchedDirs = getExpertsDirs();
        throw new Error(`Expert not found: ${expertName}\nSearched in: ${searchedDirs.join(', ')}`);
    }

    // Try new format first (index.ts)
    const newFormatPath = join(expertDir, 'index.ts');
    if (existsSync(newFormatPath)) {
        const expertModule = await import(`file://${newFormatPath}`);
        const createExpert = expertModule.default;
        if (!createExpert) {
            throw new Error(`Expert factory not found: ${newFormatPath}`);
        }
        return createExpert();
    }

    // Fallback to old format (expert.ts)
    const oldFormatPath = join(expertDir, 'expert.ts');
    if (existsSync(oldFormatPath)) {
        const expertModule = await import(`file://${oldFormatPath}`);
        const createExpert = expertModule.default;
        if (!createExpert) {
            throw new Error(`Expert factory not found: ${oldFormatPath}`);
        }
        return createExpert();
    }

    throw new Error(`Expert entry point not found: ${expertDir}\nExpected index.ts or expert.ts`);
}

/**
 * Create Agent with real API
 */
async function createAgent(): Promise<any> {
    // Determine API key and provider type
    let apiKey = process.env['ANTHROPIC_API_KEY'] || process.env['OPENAI_API_KEY'] || process.env['GLM_API_KEY'] || process.env['MINIMAX_API_KEY'];

    if (!apiKey) {
        throw new Error('No API key found. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GLM_API_KEY, or MINIMAX_API_KEY');
    }

    const providerSettings: Partial<ProviderSettings> = {
        apiKey: apiKey,
    };

    // Use createWithContainer which handles workspace creation internally
    const agent = AgentFactory.createWithContainer(
        {
            capability: 'You are a helpful assistant.',
            direction: 'Complete the given task.',
        },
        {
            apiConfiguration: providerSettings,
            virtualWorkspaceConfig: {
                id: `demo-${Date.now()}`,
                name: 'Demo Workspace',
                expertMode: true, // Disable all skill-related features for Expert
                disableBuiltinSkills: true, // Expert should NOT have access to builtin skills
                renderMode: 'markdown'
            }
        }
    );

    return agent;
}

/**
 * Run Expert demo
 */
export async function runDemo(
    expertName: string,
    inputJson: string,
    options: { verbose?: boolean } = {}
): Promise<void> {
    // Check API key
    const apiKey = process.env['ANTHROPIC_API_KEY'] || process.env['OPENAI_API_KEY'] || process.env['GLM_API_KEY'] || process.env['MINIMAX_API_KEY'];

    if (!apiKey) {
        console.log(chalk.red('\n❌ No API key found'));
        console.log(chalk.gray('  Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GLM_API_KEY, MINIMAX_API_KEY\n'));
        process.exit(1);
    }

    // Detect which provider
    let provider = 'Unknown';
    if (process.env['ANTHROPIC_API_KEY']) provider = 'Anthropic';
    else if (process.env['OPENAI_API_KEY']) provider = 'OpenAI';
    else if (process.env['GLM_API_KEY']) provider = 'GLM';
    else if (process.env['MINIMAX_API_KEY']) provider = 'MiniMax';

    // Clear the "Loading..." line and show header
    process.stdout.write('\r' + ' '.repeat(20) + '\r');

    console.log(chalk.bold.cyan('\n⚡ Expert Demo'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.gray(`  Expert: ${expertName}`));
    console.log(chalk.gray(`  Provider: ${provider}`));
    console.log(chalk.cyan('  → Loading expert config...'));

    // Parse input
    let input: Record<string, any>;
    try {
        input = JSON.parse(inputJson);
    } catch {
        // Try to parse as key=value pairs
        input = {};
        const pairs = inputJson.split(',');
        for (const pair of pairs) {
            const [key, ...valueParts] = pair.split('=');
            if (key && valueParts.length > 0) {
                input[key.trim()] = valueParts.join('=').trim();
            } else if (key) {
                input[key.trim()] = true;
            }
        }
    }

    console.log(chalk.gray(`  Input: ${JSON.stringify(input)}\n`));

    const spinner = ora({
        text: chalk.cyan('Loading expert...'),
        spinner: 'dots'
    });

    let expertInstance: ExpertInstance | null = null;
    let agent: any = null;

    try {
        // Load expert config
        console.log(chalk.cyan('  → Loading expert module...'));
        spinner.start();
        const expertConfig = await loadExpert(expertName);
        spinner.succeed(chalk.green('  ✓ Expert config loaded'));

        // Show expert info
        console.log(chalk.bold('\n📦 Expert Info:'));
        console.log(chalk.gray(`   ID: ${expertConfig.expertId}`));
        console.log(chalk.gray(`   Name: ${expertConfig.displayName}`));
        console.log(chalk.gray(`   Description: ${expertConfig.description}`));
        console.log(chalk.gray(`   Components: ${expertConfig.components?.length || 0}`));

        if (expertConfig.prompt?.capability) {
            console.log(chalk.gray(`\n   Capability:`));
            const capLines = expertConfig.prompt.capability.split('\n').slice(0, 5);
            for (const line of capLines) {
                console.log(chalk.gray(`     ${line}`));
            }
        }

        // Create agent with real API
        console.log(chalk.cyan('  → Creating agent with real API...'));
        spinner.text = chalk.cyan('Creating agent with real API...');
        spinner.start();
        agent = await createAgent();
        spinner.succeed(chalk.green('  ✓ Agent created'));

        // Show the prompt that will be used
        console.log(chalk.bold('\n📝 Task Prompt:'));
        const taskDescription = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
        const taskPrompt = buildTaskPrompt(expertConfig, taskDescription);
        console.log(chalk.gray(taskPrompt.substring(0, 500) + (taskPrompt.length > 500 ? '...' : '')));

        // Create expert instance
        console.log(chalk.cyan('  → Initializing expert...'));
        spinner.text = chalk.cyan('Starting expert...');
        spinner.start();
        expertInstance = new ExpertInstance(expertConfig, agent);
        await expertInstance.activate();
        spinner.succeed(chalk.green('  ✓ Expert activated'));

        // Create task
        const task: ExpertTask = {
            taskId: `demo-${Date.now()}`,
            description: typeof input === 'string' ? input : JSON.stringify(input),
            input
        };

        // Execute task
        console.log(chalk.cyan('\n  → Executing task with LLM (this may take a while)...'));
        spinner.text = chalk.cyan('Executing task...');
        spinner.start();

        const startTime = Date.now();
        const result = await expertInstance.execute(task);
        const duration = Date.now() - startTime;

        spinner.succeed(chalk.green(`  Task completed in ${duration}ms`));

        // Show results
        console.log(chalk.bold('\n📊 Results:'));
        console.log(chalk.gray(`   Success: ${result.success ? chalk.green('✓') : chalk.red('✗')}`));
        console.log(chalk.gray(`   Duration: ${result.duration}ms`));

        if (result.errors && result.errors.length > 0) {
            console.log(chalk.red('\n❌ Errors:'));
            for (const error of result.errors) {
                console.log(chalk.red(`   - ${error}`));
            }
        }

        if (result.summary) {
            console.log(chalk.bold('\n📄 Summary:'));
            console.log(chalk.gray(result.summary));
        }

        if (result.output) {
            console.log(chalk.bold('\n📤 Output:'));
            const outputStr = typeof result.output === 'string'
                ? result.output
                : JSON.stringify(result.output, null, 2);
            console.log(chalk.gray(outputStr.substring(0, 1000) + (outputStr.length > 1000 ? '\n...' : '')));
        }

        if (result.artifacts && result.artifacts.length > 0) {
            console.log(chalk.bold('\n🎁 Artifacts:'));
            for (const artifact of result.artifacts) {
                console.log(chalk.gray(`   - ${artifact.name} (${artifact.type})`));
            }
        }

        console.log(chalk.bold.cyan('\n' + '='.repeat(60)));

    } catch (error) {
        spinner.fail(chalk.red('  Failed'));
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`));

        if (options.verbose) {
            console.log(chalk.red(error instanceof Error ? error.stack : ''));
        }

        process.exit(1);
    } finally {
        // Cleanup
        if (expertInstance) {
            await expertInstance.dispose();
        }
        console.log(chalk.gray('\n✅ Demo completed\n'));
    }
}

/**
 * Build task prompt from expert config and input
 *
 * NOTE: Expert's capability and direction are already set in agentPrompt (systemPrompt)
 * This function only adds task-specific information
 */
function buildTaskPrompt(expertConfig: ExpertConfig, taskDescription: string): string {
    // In demo mode, show the full prompt including capability/direction for visibility
    // In production, these are in systemPrompt via agentPrompt
    let prompt = '';

    if (expertConfig.prompt?.capability) {
        prompt += `## Expert Capability\n${expertConfig.prompt.capability}\n\n`;
    }

    if (expertConfig.prompt?.direction) {
        prompt += `## Expert Direction\n${expertConfig.prompt.direction}\n\n`;
    }

    prompt += `## Task\n${taskDescription}\n`;

    return prompt;
}

/**
 * CLI entry point
 */
export async function createDemoCLI(): Promise<void> {
    const args = process.argv.slice(3); // Skip 'node' and 'cli.ts'

    if (args.length === 0) {
        console.log(chalk.bold.cyan('\nExpert Demo CLI\n'));
        console.log(chalk.gray('Usage:'));
        console.log(chalk.gray('  expert-cli demo <expert-name> <input>'));
        console.log(chalk.gray('  expert-cli demo <expert-name> \'{"key": "value"}\''));
        console.log(chalk.gray('  expert-cli demo meta-analysis-article-retrieval "research_question=diabetes treatment"\n'));
        console.log(chalk.gray('Options:'));
        console.log(chalk.gray('  --verbose, -v   Verbose output\n'));
        return;
    }

    const expertName = args[0];
    const input = args.slice(1).join(' ') || '{}';
    const verbose = args.includes('--verbose') || args.includes('-v');

    await runDemo(expertName, input, { verbose });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    createDemoCLI().catch(console.error);
}
