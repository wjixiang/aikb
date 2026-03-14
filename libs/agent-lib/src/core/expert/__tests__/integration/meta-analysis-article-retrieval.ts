/**
 * Integration Tests for meta-analysis-article-retrieval Expert
 *
 * Similar to Storybook stories, tests are defined as TypeScript functions.
 * Run with: pnpm run expert:test:run:ts
 */

import { testSuite, type TestAPI } from '../../cli/testFramework';

/**
 * Basic search test
 */
async function basicSearch({ expert }: TestAPI) {
    // Verify expert config is loaded
    if (!expert.expertId) {
        throw new Error('Expert ID not found');
    }

    // Verify components
    if (!expert.components || expert.components.length === 0) {
        throw new Error('No components configured');
    }

    // Verify input handler exists
    if (!expert.input?.validate) {
        throw new Error('Input handler not configured');
    }

    // Test input validation with valid input
    const validation = expert.input.validate({
        research_question: 'diabetes treatment outcomes',
        databases: 'PubMed',
        target_results_per_query: 50
    });

    if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
    }

    console.log('  ✓ Expert is properly configured');
}

/**
 * Empty query validation test
 */
async function emptyQueryValidation({ expert }: TestAPI) {
    // Test input validation with empty input
    const validator = expert.input?.validate;
    if (!validator) {
        throw new Error('Input validator not found');
    }

    const validation = validator({
        research_question: ''
    });

    if (validation.valid) {
        throw new Error('Expected validation to fail for empty research_question');
    }

    console.log('  ✓ Empty query validation works correctly');
}

/**
 * Prior articles test
 */
async function priorArticlesTest({ expert }: TestAPI) {
    // Test with prior articles
    const validator = expert.input?.validate;
    if (!validator) {
        throw new Error('Input validator not found');
    }

    const validation = validator({
        research_question: 'cancer treatment',
        databases: 'PubMed',
        target_results_per_query: 100,
        priorArticles: [
            'prior-results/2024-01-01.json'
        ]
    });

    if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
    }

    console.log('  ✓ Prior articles validation works');
}

/**
 * Invalid parameters test
 */
async function invalidParamsTest({ expert }: TestAPI) {
    // Test with invalid target_results_per_query
    const validator = expert.input?.validate;
    if (!validator) {
        throw new Error('Input validator not found');
    }

    const validation = validator({
        research_question: 'test',
        target_results_per_query: -1
    });

    if (validation.valid) {
        throw new Error('Expected validation to fail for negative target_results_per_query');
    }

    // Check for expected errors
    const hasError = validation.errors?.some(e => e.includes('greater than 0'));
    if (!hasError) {
        throw new Error('Expected error about target_results_per_query being greater than 0');
    }

    console.log('  ✓ Invalid parameters validation works');
}

/**
 * Export handler test
 */
async function exportHandlerTest({ expert }: TestAPI) {
    // Verify export config
    if (!expert.exportConfig) {
        throw new Error('Export config not configured');
    }

    if (!expert.exportConfig.exportHandler) {
        throw new Error('Export handler not configured');
    }

    console.log('  ✓ Export handler is configured');
}

// Register test suite
testSuite('meta-analysis-article-retrieval', {
    timeout: 30000,
    cases: {
        'basic search': basicSearch,
        'empty query validation': emptyQueryValidation,
        'prior articles': priorArticlesTest,
        'invalid parameters': invalidParamsTest,
        'export handler': exportHandlerTest
    }
});
