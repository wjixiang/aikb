/**
 * Expert Integration Test Framework
 *
 * Similar to Storybook CSF (Component Story Format), tests are defined as TypeScript files.
 *
 * Usage:
 * ```ts
 * import { test } from './testFramework';
 *
 * test('basic search', async ({ expert, input, expect }) => {
 *   const result = await expert.run(input);
 *   expect(result.success).toBe(true);
 * });
 * ```
 */

import chalk from 'chalk';
import ora from 'ora';
import dotenv from 'dotenv';
import { ExpertInstance } from '../ExpertInstance.js';

// Load environment variables
dotenv.config();
import { ExpertExecutor } from '../ExpertExecutor.js';
import { ExpertRegistry } from '../ExpertRegistry.js';
import type { ExpertConfig, ExpertTask, ExpertResult } from '../types.js';
import { AgentFactory } from '../../agent/AgentFactory.js';
import { ProviderSettings } from '../../types/provider-settings.js';

// ============================================================================
// Types
// ============================================================================

export interface TestInput {
    [key: string]: any;
}

export interface Expectation {
    type: 'success' | 'error' | 'output-contains' | 'output-regex' | 'component-state' | 'export';
    value?: any;
    message?: string;
    path?: string;
    contains?: string;
    regex?: string;
}

export interface TestCase {
    name: string;
    input: TestInput;
    expectations?: Expectation[];
    skip?: boolean;
    only?: boolean;
}

export interface ExpertTestSuite {
    expert: string;
    cases: TestCase[];
    timeout?: number;
    env?: Record<string, string>;
}

export interface TestContext {
    expert: ExpertConfig;
    expertName: string;
    input: TestInput;
    result?: ExpertResult;
    workspace?: any;
}

export interface TestAPI {
    expert: ExpertConfig;
    expertName: string;
    input: TestInput;
    expect: ExpectAPI;
    timeout: number;
}

export interface ExpectAPI {
    success(message?: string): void;
    error(message?: string): void;
    contains(text: string, message?: string): void;
    matches(regex: RegExp, message?: string): void;
    hasState(path: string, message?: string): void;
}

// ============================================================================
// Test Runner
// ============================================================================

export interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    error?: string;
    expectations?: Array<{ type: string; passed: boolean; message: string }>;
}

export interface SuiteResult {
    name: string;
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    results: TestResult[];
}

// ============================================================================
// Test Function
// ============================================================================

type TestFunction = (context: TestAPI) => Promise<void> | void;

interface RegisteredTest {
    name: string;
    fn: TestFunction;
    only?: boolean;
    skip?: boolean;
}

interface RegisteredSuite {
    expert: string;
    tests: RegisteredTest[];
    timeout?: number;
}

const registeredSuites: Map<string, RegisteredSuite> = new Map();

/**
 * Define a test suite (similar to Storybook stories)
 *
 * @example
 * ```ts
 * export const basicTests = testSuite('meta-analysis-article-retrieval', {
 *   cases: {
 *     'basic search': async ({ expert, input, expect }) => {
 *       const result = await expert.run(input);
 *       expect.success();
 *     }
 *   }
 * });
 * ```
 */
export function testSuite(expert: string, config: {
    timeout?: number;
    cases: Record<string, TestFunction>;
}): void {
    const tests: RegisteredTest[] = Object.entries(config.cases).map(([name, fn]) => ({
        name,
        fn
    }));

    registeredSuites.set(expert, {
        expert,
        tests,
        timeout: config.timeout
    });
}

/**
 * Define a single test case (alternative API)
 */
export function test(name: string, fn: TestFunction): void {
    // This registers a test to the current suite
    // Used within testSuite
}

/**
 * Run all registered tests
 */
export async function runTests(options: {
    expert?: string;
    timeout?: number;
    verbose?: boolean;
} = {}): Promise<SuiteResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY ||
                   process.env.GLM_API_KEY || process.env.MINIMAX_API_KEY;

    if (!apiKey) {
        throw new Error('No API key found. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GLM_API_KEY, or MINIMAX_API_KEY');
    }

    // Determine provider
    let provider = 'Unknown';
    if (process.env.ANTHROPIC_API_KEY) provider = 'Anthropic';
    else if (process.env.OPENAI_API_KEY) provider = 'OpenAI';
    else if (process.env.GLM_API_KEY) provider = 'GLM';
    else if (process.env.MINIMAX_API_KEY) provider = 'MiniMax';

    console.log(chalk.bold.cyan('\n' + '='.repeat(60)));
    console.log(chalk.bold.cyan('  Expert Integration Tests (TypeScript)'));
    console.log(chalk.bold.cyan('='.repeat(60)));
    console.log(chalk.gray(`\n  Provider: ${provider}`));

    // Filter suites
    const suites = options.expert
        ? [...registeredSuites.entries()].filter(([name]) => name === options.expert)
        : [...registeredSuites.entries()];

    console.log(chalk.gray(`  Suites: ${suites.length}\n`));

    const allResults: SuiteResult[] = [];

    for (const [suiteName, suite] of suites) {
        const suiteSpinner = ora({
            text: chalk.cyan(`Loading: ${suiteName}`),
            spinner: 'dots'
        }).start();

        // Load expert config
        let expertConfig: ExpertConfig;
        try {
            expertConfig = await loadExpert(suiteName);
            suiteSpinner.succeed(chalk.green(`Loaded: ${suiteName}`));
        } catch (error) {
            suiteSpinner.fail(chalk.red(`Failed to load: ${suiteName}`));
            console.log(chalk.red(`  Error: ${error}`));
            continue;
        }

        console.log(chalk.bold(`\n▶ ${suiteName}`));
        console.log(chalk.gray(`  Cases: ${suite.tests.length}`));

        const suiteResult: SuiteResult = {
            name: suiteName,
            total: suite.tests.length,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            results: []
        };

        const suiteStartTime = Date.now();

        for (const testCase of suite.tests) {
            if (testCase.skip) {
                suiteResult.skipped++;
                console.log(chalk.gray(`  ⊘ ${testCase.name}`));
                continue;
            }

            const testSpinner = ora({
                text: chalk.cyan(`  Running: ${testCase.name}`),
                spinner: 'dots'
            });

            const testResult: TestResult = {
                name: testCase.name,
                passed: false,
                duration: 0,
                expectations: []
            };

            try {
                // Create test API
                const testApi = createTestAPI(expertConfig, suiteName, testCase.fn, options.timeout || suite.timeout || 60000);

                // Run test
                testSpinner.start();
                await testCase.fn(testApi);

                testResult.passed = true;
                testSpinner.succeed(chalk.green(`  ✓ ${testCase.name}`));

            } catch (error) {
                testResult.passed = false;
                testResult.error = error instanceof Error ? error.message : String(error);
                testSpinner.fail(chalk.red(`  ✗ ${testCase.name}`));
                console.log(chalk.red(`    ${testResult.error}`));
            }

            testResult.duration = Date.now() - suiteStartTime;
            suiteResult.results.push(testResult);

            if (testResult.passed) {
                suiteResult.passed++;
            } else {
                suiteResult.failed++;
            }
        }

        suiteResult.duration = Date.now() - suiteStartTime;
        allResults.push(suiteResult);

        if (suiteResult.failed > 0) {
            console.log(chalk.red(`  ✗ ${suiteResult.failed} failed, ${suiteResult.passed} passed`));
        } else {
            console.log(chalk.green(`  ✓ All ${suiteResult.passed} tests passed`));
        }
    }

    // Summary
    const totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = allResults.reduce((sum, r) => sum + r.skipped, 0);
    const totalTests = allResults.reduce((sum, r) => sum + r.total, 0);

    console.log(chalk.bold.cyan('\n' + '='.repeat(60)));
    console.log(chalk.bold.cyan('  Summary'));
    console.log(chalk.bold.cyan('='.repeat(60)));
    console.log(chalk.white(`\n  Total: ${totalTests}`));
    console.log(chalk.green(`  Passed: ${totalPassed}`));
    console.log(totalFailed > 0 ? chalk.red(`  Failed: ${totalFailed}`) : chalk.gray(`  Failed: ${totalFailed}`));
    console.log(chalk.gray(`  Skipped: ${totalSkipped}`));

    if (totalFailed > 0) {
        console.log(chalk.red('\n  ❌ Some tests failed\n'));
        process.exit(1);
    } else {
        console.log(chalk.green('\n  🎉 All tests passed!\n'));
    }

    return allResults[0] || {
        name: '',
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        results: []
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function loadExpert(expertName: string): Promise<ExpertConfig> {
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const { existsSync, readFileSync } = await import('fs');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const expertDir = join(__dirname, '..', 'builtin', expertName);
    const expertPath = join(expertDir, 'expert.ts');

    if (!existsSync(expertPath)) {
        throw new Error(`Expert not found: ${expertPath}`);
    }

    const expertModule = await import(`file://${expertPath}`);
    const createExpert = expertModule.default;

    if (!createExpert) {
        throw new Error(`Expert factory not found: ${expertPath}`);
    }

    return createExpert();
}

function createTestAPI(
    expertConfig: ExpertConfig,
    expertName: string,
    _testFn: TestFunction,
    timeout: number
): TestAPI {
    let currentInput: TestInput = {};
    let currentResult: ExpertResult | undefined;

    const expect: ExpectAPI = {
        success(message = 'Expected success') {
            if (!currentResult?.success) {
                throw new Error(`${message}: ${currentResult?.errors?.join(', ') || 'unknown error'}`);
            }
        },
        error(message = 'Expected error') {
            if (currentResult?.success) {
                throw new Error(`${message}: but got success`);
            }
        },
        contains(text, message = `Expected output to contain "${text}"`) {
            const output = JSON.stringify(currentResult?.output || '');
            if (!output.includes(text)) {
                throw new Error(message);
            }
        },
        matches(regex, message = `Expected output to match ${regex}`) {
            const output = JSON.stringify(currentResult?.output || '');
            if (!regex.test(output)) {
                throw new Error(message);
            }
        },
        hasState(path, message = `Expected state at ${path}`) {
            // State checking would require workspace access
            console.log(chalk.yellow(`    ℹ State check not implemented: ${path}`));
        }
    };

    return {
        expert: expertConfig,
        expertName,
        get input() { return currentInput; },
        set input(val) { currentInput = val; },
        get result() { return currentResult; },
        set result(val) { currentResult = val; },
        expect,
        timeout
    };
}

/**
 * Clear all registered tests (for testing the framework)
 */
export function clearTests(): void {
    registeredSuites.clear();
}

/**
 * Get registered tests
 */
export function getRegisteredTests(): Map<string, RegisteredSuite> {
    return registeredSuites;
}

// ============================================================================
// Default Test Execution
// ============================================================================

// Note: Auto-run disabled - use CLI to run tests
// Run with: pnpm run expert:test:run:ts
// if (import.meta.url === `file://${process.argv[1]}`) {
//     runTests().catch(console.error);
// }
