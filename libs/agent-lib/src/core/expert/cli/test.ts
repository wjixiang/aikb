/**
 * Expert Integration Test CLI - YAML Test Format and Runner
 *
 * YAML Test Format:
 *
 * ```yaml
 * name: test-name
 * description: Test description
 *
 * # Expert to test
 * expert: meta-analysis-article-retrieval
 *
 * # Test cases
 * cases:
 *   - name: basic-search
 *     description: Basic PubMed search test
 *
 *     # Input to the expert
 *     input:
 *       research_question: diabetes treatment outcomes
 *       databases: PubMed
 *       target_results_per_query: 50
 *
 *     # Expected results
 *     expectations:
 *       - type: success
 *
 *       - type: component-state
 *         component: bibliography-search
 *         path: currentResults.articleProfiles
 *         length: greaterThan: 0
 *
 *       - type: export
 *         format: csv
 *
 * # Timeout for each test case (ms)
 * timeout: 120000
 * ```
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import YAML from 'yaml';

// Types
export interface TestExpectation {
    type: 'success' | 'error' | 'component-state' | 'export' | 'output-contains' | 'output-regex';
    message?: string;
    component?: string;
    path?: string;
    length?: { gt?: number; lt?: number; eq?: number };
    format?: string;
    contains?: string;
    regex?: string;
}

export interface TestCase {
    name: string;
    description?: string;
    input: Record<string, any>;
    expectations: TestExpectation[];
    skip?: boolean;
    only?: boolean;
}

export interface ExpertTestDefinition {
    name: string;
    description?: string;
    expert: string;
    cases: TestCase[];
    timeout?: number;
    env?: Record<string, string>;
}

export interface TestResult {
    caseName: string;
    passed: boolean;
    duration: number;
    error?: string;
    details?: string[];
    expectations?: Array<{
        type: string;
        passed: boolean;
        message: string;
    }>;
}

export interface TestSuiteResult {
    name: string;
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    results: TestResult[];
}

/**
 * Parse YAML test file
 */
export function parseTestFile(filePath: string): ExpertTestDefinition {
    const content = readFileSync(filePath, 'utf-8');
    const test = YAML.parse(content) as ExpertTestDefinition;

    // Validate required fields
    if (!test.expert) {
        throw new Error('Test file must have "expert" field');
    }
    if (!test.cases || !Array.isArray(test.cases)) {
        throw new Error('Test file must have "cases" array');
    }

    return test;
}

/**
 * Get test files from directory
 */
export function getTestFiles(testDir: string): string[] {
    if (!existsSync(testDir)) {
        return [];
    }
    return readdirSync(testDir)
        .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
        .map(f => join(testDir, f));
}

/**
 * Validate test definition
 */
export function validateTest(test: ExpertTestDefinition): string[] {
    const errors: string[] = [];

    if (!test.name) errors.push('Missing "name" field');
    if (!test.expert) errors.push('Missing "expert" field');
    if (!test.cases?.length) errors.push('Missing or empty "cases" array');

    for (let i = 0; i < (test.cases?.length || 0); i++) {
        const testCase = test.cases[i];
        if (!testCase.name) {
            errors.push(`Case ${i}: missing "name"`);
        }
        if (!testCase.input) {
            errors.push(`Case ${i}: missing "input"`);
        }
    }

    return errors;
}

// Pretty printing utilities
function printHeader(text: string, width: number = 60): void {
    console.log(chalk.bold.cyan('\n' + '='.repeat(width)));
    console.log(chalk.bold.cyan('  ' + text));
    console.log(chalk.bold.cyan('='.repeat(width)));
}

function printSubHeader(text: string): void {
    console.log(chalk.bold.yellow('\n▶ ' + text));
}

function printSuccess(text: string): void {
    console.log(chalk.green('  ✓ ' + text));
}

function printError(text: string): void {
    console.log(chalk.red('  ✗ ' + text));
}

function printWarning(text: string): void {
    console.log(chalk.yellow('  ⚠ ' + text));
}

function printInfo(text: string): void {
    console.log(chalk.gray('  ℹ ' + text));
}

/**
 * Print test suite results in beautiful format
 */
export function printTestResults(result: TestSuiteResult): void {
    console.log('\n');
    console.log(chalk.bold.white.bgBlack(' TEST RESULTS '));
    console.log('');

    // Summary
    const summaryWidth = 40;
    console.log(chalk.white('  ' + '-'.repeat(summaryWidth)));

    const status = result.failed > 0 ? chalk.red('FAILED') : chalk.green('PASSED');
    console.log(chalk.white(`  ${chalk.bold('Test Suite:')} ${result.name}`));
    console.log(chalk.white(`  ${chalk.bold('Status:')} ${status}`));
    console.log(chalk.white('  ' + '-'.repeat(summaryWidth)));

    // Stats
    const stats = [
        { label: 'Total', value: result.total, color: chalk.white },
        { label: 'Passed', value: result.passed, color: chalk.green },
        { label: 'Failed', value: result.failed, color: result.failed > 0 ? chalk.red : chalk.gray },
        { label: 'Skipped', value: result.skipped, color: chalk.gray },
        { label: 'Duration', value: `${result.duration}ms`, color: chalk.cyan }
    ];

    for (const stat of stats) {
        console.log(`  ${chalk.bold(stat.label + ':')} ${stat.color(stat.value)}`);
    }

    console.log(chalk.white('  ' + '-'.repeat(summaryWidth)));

    // Individual results
    console.log(chalk.bold('\n  Test Cases:'));
    console.log('');

    for (const testResult of result.results) {
        if (testResult.passed) {
            printSuccess(`${testResult.caseName} (${testResult.duration}ms)`);
        } else {
            printError(`${testResult.caseName} (${testResult.duration}ms)`);
            if (testResult.error) {
                console.log(chalk.red(`    Error: ${testResult.error}`));
            }
        }

        // Print expectation details
        if (testResult.expectations) {
            for (const exp of testResult.expectations) {
                if (exp.passed) {
                    console.log(chalk.gray(`    ✓ ${exp.type}: ${exp.message}`));
                } else {
                    console.log(chalk.red(`    ✗ ${exp.type}: ${exp.message}`));
                }
            }
        }
    }

    // Final verdict
    console.log('\n' + chalk.white('  ' + '='.repeat(summaryWidth)));
    if (result.failed === 0) {
        console.log(chalk.green.bold('  🎉 All tests passed!'));
    } else {
        console.log(chalk.red.bold(`  ❌ ${result.failed} test(s) failed`));
    }
    console.log(chalk.white('  ' + '='.repeat(summaryWidth) + '\n'));
}

/**
 * Print test progress
 */
export function printTestProgress(caseName: string, spinner: ora.Ora): void {
    spinner.start(chalk.cyan(`  Running: ${caseName}`));
}

/**
 * Print running info
 */
export function printRunning(expertName: string, caseName: string): void {
    console.log(chalk.cyan(`\n▶ Running: ${expertName} / ${caseName}`));
}
