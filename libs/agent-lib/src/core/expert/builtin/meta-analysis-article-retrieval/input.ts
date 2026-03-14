import type { InputHandler, ValidationResult, ExternalData, ExecutionContext } from '../../types.js';

/**
 * Input handler for meta-analysis-article-retrieval expert
 *
 * This handler processes task input before execution:
 * 1. validate() - Validates input parameters
 * 2. transform() - Transforms input to expected format
 * 3. loadExternalData() - Loads external data (e.g., from S3)
 */

/**
 * Validate input parameters
 *
 * @param input - The input to validate
 * @returns Validation result with errors/warnings
 */
function validateInput(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required: research_question
    if (!input.research_question) {
        errors.push('research_question is required');
    }

    // Optional: databases
    if (input.databases && typeof input.databases !== 'string') {
        errors.push('databases must be a string');
    }

    // Optional: target_results_per_query
    if (input.target_results_per_query !== undefined) {
        const num = Number(input.target_results_per_query);
        if (isNaN(num)) {
            errors.push('target_results_per_query must be a number');
        } else if (num < 1) {
            errors.push('target_results_per_query must be greater than 0');
        } else if (num > 1000) {
            warnings.push('target_results_per_query exceeds recommended limit of 1000');
        }
    }

    // Optional: priorArticles (s3Key[])
    if (input.priorArticles && !Array.isArray(input.priorArticles)) {
        errors.push('priorArticles must be an array of S3 keys');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Transform input to expected format
 *
 * @param input - The raw input
 * @returns Transformed input
 */
function transformInput(input: any): any {
    return {
        research_question: input.research_question?.trim(),
        databases: input.databases || 'PubMed',
        target_results_per_query: input.target_results_per_query || 100,
        priorArticles: input.priorArticles || []
    };
}

/**
 * Load external data (e.g., from S3)
 *
 * This enables Expert chaining - Expert A exports to S3,
 * Expert B can reference those files via s3Key[] parameters.
 *
 * @param input - The validated input
 * @param context - Execution context including workspace
 * @returns External data to merge into context
 */
async function loadExternalData(
    input: any,
    context: ExecutionContext
): Promise<ExternalData> {
    const externalData: ExternalData = {};

    // Load prior articles from S3 if provided
    const s3Keys = input.priorArticles || [];

    if (s3Keys.length > 0) {
        const vfs = context.workspace.getComponent('virtualFileSystem');

        if (vfs) {
            for (const key of s3Keys) {
                try {
                    const content = await vfs.readFile(key);
                    externalData[key] = JSON.parse(content);
                } catch (error) {
                    console.warn(`Failed to load external data from ${key}:`, error);
                }
            }
        }

        externalData.s3Keys = s3Keys;
    }

    return externalData;
}

/**
 * Input handler for meta-analysis-article-retrieval
 */
export const metaAnalysisArticleRetrievalInputHandler: InputHandler = {
    validate: validateInput,
    transform: transformInput,
    loadExternalData
};

// Export individual functions for testing
export { validateInput, transformInput, loadExternalData };
