/**
 * Expert CLI - Command-line tools for Expert development
 *
 * Usage:
 *   npx expert-cli new <name>     Create a new Expert
 *   npx expert-cli list          List all Experts
 *   npx expert-cli validate      Validate Expert configuration
 *   npx expert-cli test          Run Expert tests
 *   npx expert-cli demo          Run Expert demo
 */

import { Command } from 'commander';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename, relative } from 'path';
import chalk from 'chalk';
import YAML from 'yaml';

// Types
export interface ExpertCLIConfig {
    expertsDir: string;
}

// Re-export types for consumers
export type { ExpertMetadata, ParameterDefinition, StepDefinition, Example } from '../types.js';
export type { ExpertTestDefinition, TestCase, TestExpectation, TestResult, TestSuiteResult } from './test.js';

/**
 * Get experts directories to search
 * Searches multiple locations:
 * - src/expert/builtin (agent-lib built-in experts)
 * - experts (external experts created via CLI)
 */
function getExpertsDirs(): string[] {
    const dirs = [
        join(process.cwd(), 'src', 'expert', 'builtin'),
        join(process.cwd(), 'experts'),
    ];
    return dirs.filter(dir => existsSync(dir));
}

/**
 * Load expert config
 */
function loadExpertConfig(expertDir: string): any {
    const configPath = join(expertDir, 'config.json');
    if (!existsSync(configPath)) {
        throw new Error(`Config not found: ${configPath}`);
    }
    return JSON.parse(readFileSync(configPath, 'utf-8'));
}

/**
 * Load SOP definition
 */
function loadSOP(expertDir: string): any {
    const sopPath = join(expertDir, 'sop.yaml');
    if (!existsSync(sopPath)) {
        return null;
    }
    return YAML.parse(readFileSync(sopPath, 'utf-8'));
}

/**
 * Get all expert directories
 */
function getExpertDirs(expertsDir: string): string[] {
    if (!existsSync(expertsDir)) {
        return [];
    }
    return readdirSync(expertsDir)
        .map(name => join(expertsDir, name))
        .filter(dir => statSync(dir).isDirectory());
}

/**
 * List all Experts
 */
export async function listExperts(): Promise<void> {
    const expertsDirs = getExpertsDirs();

    if (expertsDirs.length === 0) {
        console.log('No Experts found.');
        console.log('  Run "expert-cli new <name>" to create a new Expert\n');
        return;
    }

    console.log('\n📋 Available Experts:\n');
    console.log('  Name'.padEnd(30) + 'Display Name'.padEnd(35) + 'Category');
    console.log('  ' + '-'.repeat(80));

    let totalCount = 0;
    for (const expertsDir of expertsDirs) {
        const expertDirs = getExpertDirs(expertsDir);
        const relPath = relative(process.cwd(), expertsDir);

        if (expertDirs.length > 0) {
            console.log(`\n  📁 ${relPath}/`);
        }

        for (const dir of expertDirs) {
            const name = basename(dir);
            totalCount++;
            try {
                const config = loadExpertConfig(dir);
                console.log(
                    `    ${name.padEnd(26)} ${(config.displayName || '').padEnd(33)} ${config.category || '-'}`
                );
            } catch (e) {
                console.log(`    ${name.padEnd(26)} [Invalid Config]`);
            }
        }
    }

    console.log(`\n  Total: ${totalCount} Expert(s)\n`);
    console.log('');
}

/**
 * Find expert directory by name across all experts directories
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
 * Validate an Expert configuration
 */
export async function validateExpert(expertName?: string): Promise<void> {
    const expertsDirs = getExpertsDirs();

    if (expertName) {
        // Validate specific expert - search across all directories
        const expertDir = findExpertDirByName(expertName);
        if (!expertDir) {
            console.error(`❌ Expert not found: ${expertName}`);
            console.error(`  Searched in:`);
            for (const dir of expertsDirs) {
                console.error(`    - ${relative(process.cwd(), dir)}`);
            }
            process.exit(1);
        }
        await validateSingleExpert(expertDir, expertName);
    } else {
        // Validate all experts across all directories
        let allExpertDirs: string[] = [];
        for (const expertsDir of expertsDirs) {
            allExpertDirs = allExpertDirs.concat(getExpertDirs(expertsDir));
        }

        if (allExpertDirs.length === 0) {
            console.log('No Experts found to validate.');
            console.log('  Run "expert-cli new <name>" to create a new Expert\n');
            return;
        }

        console.log(`\n🔍 Validating ${allExpertDirs.length} Experts...\n`);

        let hasErrors = false;
        for (const dir of allExpertDirs) {
            const name = basename(dir);
            try {
                await validateSingleExpert(dir, name);
            } catch (e) {
                hasErrors = true;
            }
        }

        if (hasErrors) {
            console.log('\n❌ Validation failed for some Experts.');
            process.exit(1);
        } else {
            console.log('\n✅ All Experts validated successfully.');
        }
    }
}

/**
 * Validate a single Expert
 */
async function validateSingleExpert(expertDir: string, name: string): Promise<void> {
    let hasErrors = false;
    let hasWarnings = false;

    // Check config.json
    const configPath = join(expertDir, 'config.json');
    if (!existsSync(configPath)) {
        console.log(`❌ ${name}: config.json not found`);
        return;
    }

    try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));

        // Required fields
        if (!config.id) console.log(`  ⚠️  ${name}: missing 'id'`);
        if (!config.displayName) {
            console.log(`  ❌ ${name}: missing 'displayName'`);
            hasErrors = true;
        }
        if (!config.description) {
            console.log(`  ⚠️  ${name}: missing 'description'`);
            hasWarnings = true;
        }
        if (!config.components || !Array.isArray(config.components)) {
            console.log(`  ⚠️  ${name}: missing or invalid 'components' array`);
            hasWarnings = true;
        }
    } catch (e) {
        console.log(`  ❌ ${name}: invalid JSON in config.json`);
        hasErrors = true;
    }

    // Check sop.yaml
    const sopPath = join(expertDir, 'sop.yaml');
    if (!existsSync(sopPath)) {
        console.log(`  ❌ ${name}: sop.yaml not found`);
        hasErrors = true;
    } else {
        try {
            const sop = YAML.parse(readFileSync(sopPath, 'utf-8'));

            // Required fields
            if (!sop.overview) {
                console.log(`  ⚠️  ${name}: sop.yaml missing 'overview'`);
                hasWarnings = true;
            }
            if (!sop.responsibilities || !Array.isArray(sop.responsibilities)) {
                console.log(`  ⚠️  ${name}: sop.yaml missing 'responsibilities'`);
                hasWarnings = true;
            }
            if (!sop.steps || !Array.isArray(sop.steps)) {
                console.log(`  ⚠️  ${name}: sop.yaml missing 'steps'`);
                hasWarnings = true;
            }
        } catch (e) {
            console.log(`  ❌ ${name}: invalid YAML in sop.yaml`);
            hasErrors = true;
        }
    }

    // Check expert.ts
    const expertTsPath = join(expertDir, 'expert.ts');
    if (!existsSync(expertTsPath)) {
        console.log(`  ⚠️  ${name}: expert.ts not found`);
        hasWarnings = true;
    }

    // Check exportHandler.ts
    const exportHandlerPath = join(expertDir, 'exportHandler.ts');
    if (!existsSync(exportHandlerPath)) {
        console.log(`  ⚠️  ${name}: exportHandler.ts not found (optional)`);
        hasWarnings = true;
    }

    if (!hasErrors && !hasWarnings) {
        console.log(`  ✅ ${name}: valid`);
    } else if (!hasErrors) {
        console.log(`  ⚠️  ${name}: valid with warnings`);
    }
}

/**
 * Show Expert details
 */
export async function showExpert(expertName: string): Promise<void> {
    const expertDir = findExpertDirByName(expertName);

    if (!expertDir) {
        console.error(`❌ Expert not found: ${expertName}`);
        const expertsDirs = getExpertsDirs();
        if (expertsDirs.length > 0) {
            console.error(`  Searched in:`);
            for (const dir of expertsDirs) {
                console.error(`    - ${relative(process.cwd(), dir)}`);
            }
        }
        process.exit(1);
    }

    const config = loadExpertConfig(expertDir);
    const sop = loadSOP(expertDir);

    console.log(`\n📦 Expert: ${expertName}\n`);
    console.log(`   Display Name: ${config.displayName}`);
    console.log(`   Description: ${config.description || '-'}`);
    console.log(`   Category: ${config.category || '-'}`);
    console.log(`   Tags: ${config.tags?.join(', ') || '-'}`);
    console.log(`   Triggers: ${config.triggers?.join(', ') || '-'}`);

    if (sop) {
        console.log(`\n📋 SOP Overview:`);
        console.log(`   ${sop.overview?.substring(0, 200)}${sop.overview?.length > 200 ? '...' : ''}`);

        if (sop.responsibilities?.length) {
            console.log(`\n   Responsibilities:`);
            for (const r of sop.responsibilities) {
                console.log(`     - ${r}`);
            }
        }

        if (sop.parameters?.length) {
            console.log(`\n   Parameters:`);
            for (const p of sop.parameters) {
                const required = p.required ? '(required)' : '(optional)';
                console.log(`     - ${p.name}: ${p.type} ${required}`);
                console.log(`       ${p.description}`);
            }
        }

        if (sop.steps?.length) {
            console.log(`\n   Steps: ${sop.steps.length}`);
            for (const step of sop.steps) {
                console.log(`     - ${step.phase}: ${step.description.substring(0, 50)}...`);
            }
        }
    }

    if (config.components?.length) {
        console.log(`\n🔧 Components:`);
        for (const comp of config.components) {
            console.log(`     - ${comp.componentId}: ${comp.description}`);
        }
    }

    console.log('');
}

/**
 * Generate a new Expert using simplified 4-file architecture
 *
 * @param name - Expert name
 * @param options - Options including output directory
 */
export async function generateExpert(name: string, options: { input?: boolean; dir?: string } = {}): Promise<void> {
    const { createExpert } = await import('./create.js');
    await createExpert(name, options.dir);
}

/**
 * Create CLI program
 */
export function createCLI(): Command {
    const program = new Command();

    program
        .name('expert-cli')
        .description('CLI tools for Expert development')
        .version('1.0.0');

    program
        .command('list')
        .description('List all available Experts')
        .action(listExperts);

    program
        .command('validate [name]')
        .description('Validate Expert configuration (all if no name provided)')
        .action(validateExpert);

    program
        .command('show <name>')
        .description('Show detailed Expert information')
        .action(showExpert);

    program
        .command('new <name>')
        .description('Generate a new Expert in the current project')
        .option('--no-input', 'Exclude input handler')
        .option('-d, --dir <directory>', 'Output directory (default: ./experts)')
        .action((name, options) => generateExpert(name, options));

    // Demo command
    program
        .command('demo <name> [input...]')
        .description('Run Expert with real API (demo mode)')
        .option('-v, --verbose', 'Verbose output')
        .action(async (name: string, input: string[], options) => {
            const { runDemo } = await import('./demo.js');
            const inputStr = input?.length > 0 ? input.join(' ') : '{}';
            await runDemo(name, inputStr, { verbose: options.verbose });
        });

    // Test subcommands
    const testCommand = program
        .command('test')
        .description('Integration testing commands');

    // TypeScript test runner (Storybook-style)
    testCommand
        .command('run:ts [expert]')
        .description('Run TypeScript integration tests (Storybook-style)')
        .option('-w, --watch', 'Watch mode')
        .action(async (expert: string | undefined, options) => {
            // Import and run all test files
            const testDir = join(process.cwd(), 'src', 'expert', '__tests__', 'integration');
            const { readdirSync, existsSync, statSync } = await import('fs');

            if (!existsSync(testDir)) {
                console.log(chalk.yellow(`\n⚠ Test directory not found: ${testDir}`));
                return;
            }

            // Import all .ts files (except .test.ts)
            const files = readdirSync(testDir)
                .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
                .map(f => join(testDir, f));

            if (files.length === 0) {
                console.log(chalk.yellow('\n⚠ No TypeScript test files found'));
                return;
            }

            console.log(chalk.cyan(`\nLoading ${files.length} test file(s)...\n`));

            // Import all test modules to register them
            for (const file of files) {
                try {
                    await import(`file://${file}`);
                    console.log(chalk.gray(`  Loaded: ${basename(file)}`));
                } catch (error) {
                    console.log(chalk.red(`  Failed to load: ${basename(file)}`));
                    console.log(chalk.red(`    ${error}`));
                }
            }

            // Run tests
            const { runTests } = await import('./testFramework.js');
            await runTests({ expert: expert });
        });

    // YAML test runner (legacy)
    testCommand
        .command('run [file...]')
        .description('Run YAML integration tests (legacy)')
        .option('-d, --dir <directory>', 'Test directory', 'src/expert/__tests__/integration')
        .option('-w, --watch', 'Watch mode')
        .option('-r, --reporter <reporter>', 'Reporter (spec/json)', 'spec')
        .action(async (files: string[], options) => {
            const { runIntegrationTests } = await import('./testRunner.js');
            await runIntegrationTests(files, options);
        });

    testCommand
        .command('init <name>')
        .description('Generate a test template file')
        .option('-d, --dir <directory>', 'Test directory', 'src/expert/__tests__/integration')
        .action(async (name: string, options) => {
            const { generateTestTemplate } = await import('./testRunner.js');
            await generateTestTemplate(name, options);
        });

    testCommand
        .command('list')
        .description('List available integration tests')
        .option('-d, --dir <directory>', 'Test directory', 'src/expert/__tests__/integration')
        .action(async (options) => {
            const { listTests } = await import('./testRunner.js');
            await listTests(options);
        });

    return program;
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
    const program = createCLI();
    program.parse(process.argv);
}
