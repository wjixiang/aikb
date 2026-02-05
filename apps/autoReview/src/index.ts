/**
 * Auto Review Library
 * 
 * Meta-analysis agent for automated literature retrieval and analysis
 */

// Export meta-analysis agent
export { MetaAnalysisAgent } from './lib/meta-analysis-agent.js';
export type {
    MetaAnalysisRequest,
    MetaAnalysisProgress,
    ArticleProfile
} from './lib/meta-analysis-agent.js';

// Export demo functions
export {
    demoSGLT2Cardiovascular,
    demoQuickSearch,
    runCustomMetaAnalysis
} from './lib/meta-analysis-demo.js';

// Export BAML client
export { b } from './baml_client/index.js';
export * from './baml_client/types.js';
