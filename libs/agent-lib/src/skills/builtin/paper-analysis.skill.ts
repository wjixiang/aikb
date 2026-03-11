import { defineSkill, createComponentDefinition } from '../SkillDefinition.js';
import { TYPES } from '../../di/types.js';

/**
 * Paper Analysis Skill - TypeScript Definition
 *
 * Advanced paper analysis utilities for academic research
 */
export default defineSkill({
    name: 'paper-analysis',
    displayName: 'Paper Analysis',
    description: 'Advanced paper analysis utilities for academic research',
    whenToUse: 'Use this skill when you need to analyze academic papers, assess paper complexity, extract and rank citations, or compare multiple papers. This is useful for tasks like: evaluating technical depth of research papers, identifying key references, conducting comparative analysis between studies, or assessing novelty and contributions of academic work.',
    version: '2.0.0',
    category: 'analysis',
    tags: ['paper', 'analysis', 'statistics', 'research'],
    triggers: ['analyze paper', 'paper complexity', 'compare papers', 'citation analysis'],

    capabilities: [
        'Calculate paper complexity scores across multiple dimensions',
        'Extract and rank key citations from papers',
        'Compare papers to identify similarities and differences',
        'Assess technical depth and mathematical rigor',
        'Identify research gaps and contributions'
    ],

    workDirection: `When analyzing papers, follow this workflow:

1. **Initial Assessment**: Use calculate_complexity to get comprehensive complexity metrics
2. **Citation Analysis**: Use extract_key_citations to identify important references
3. **Comparative Analysis**: Use compare_papers when comparing multiple papers

Best practices:
- Always preprocess paper content before analysis
- Consider multiple complexity dimensions for thorough evaluation
- Cross-reference citations with novelty assessment
- Document assumptions and limitations in your analysis`,

    components: [
        createComponentDefinition(
            'paper-analyzer',
            'Paper Analyzer',
            'Analyzes academic papers for complexity, citations, and comparisons',
            TYPES.PaperAnalysisComponent
        )
    ],

    onActivate: async () => {
        console.log('[PaperAnalysis] Skill activated - ready for paper analysis tasks');
    },

    onDeactivate: async () => {
        console.log('[PaperAnalysis] Skill deactivated - cleaning up resources');
    },

    metadata: {
        author: 'AI Knowledge Base Team',
        created: '2025-02-17',
        updated: '2025-02-19',
        complexity: 'Medium',
        requiredTools: 'preprocess_paper, assess_novelty, extract_aspect'
    }
});
