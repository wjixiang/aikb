import { defineSkill, createComponentDefinition } from '../SkillDefinition.js';
import { TYPES } from '../../di/types.js';

/**
 * Paper Analysis Skill with components
 */
export default defineSkill({
    name: 'paper-analysis-with-components',
    displayName: 'Paper Analysis (with Components)',
    description: 'Advanced paper analysis skill that manages multiple components for different analysis tasks',

    capabilities: [
        'Calculate paper complexity scores across multiple dimensions',
        'Extract and rank key citations from papers',
        'Compare two papers side-by-side to identify similarities and differences'
    ],

    workDirection: `When analyzing papers, follow this workflow:

1. Use calculate_complexity to get comprehensive complexity metrics
2. Use extract_key_citations to identify important references
3. Use compare_papers for comparative analysis between multiple papers

Best practices:
- Always preprocess paper content before analysis
- Consider multiple complexity dimensions for thorough evaluation
- Cross-reference citations with novelty assessment
- Document assumptions and limitations in your analysis
- Provide actionable insights and recommendations`,

    components: [
        createComponentDefinition(
            'paper-analyzer',
            'Paper Analyzer',
            'Analyzes academic papers for complexity, citations, and comparisons',
            TYPES.PaperAnalysisComponent
        )
    ],

    onActivate: async () => {
        console.log('[PaperAnalysisSkill] Activated with paper analyzer component');
    },

    onDeactivate: async () => {
        console.log('[PaperAnalysisSkill] Deactivated - clearing analysis results');
    },
    version: '0.0.1'
});
