import { z } from 'zod';
import { defineSkill, createTool } from '../SkillDefinition.js';

/**
 * Paper Analysis Skill - TypeScript Definition
 *
 * Advanced paper analysis utilities for academic research
 */

// Define tool schemas
const calculateComplexitySchema = z.object({
    paper_content: z.string().describe('The paper content to analyze'),
    dimensions: z.array(z.enum(['technical', 'mathematical', 'conceptual', 'experimental']))
        .optional()
        .describe('Complexity dimensions to evaluate')
});

const extractKeyCitationsSchema = z.object({
    paper_content: z.string().describe('The paper content to analyze'),
    max_citations: z.number().optional().describe('Maximum number of citations to extract')
});

const comparePapersSchema = z.object({
    paper_a: z.string().describe('First paper content'),
    paper_b: z.string().describe('Second paper content'),
    comparison_aspects: z.array(z.string()).optional().describe('Specific aspects to compare')
});

// Define tools
const tools = [
    createTool(
        'calculate_complexity',
        'Calculate paper complexity scores across multiple dimensions (technical, mathematical, conceptual, experimental)',
        calculateComplexitySchema
    ),
    createTool(
        'extract_key_citations',
        'Extract and rank key citations from papers based on relevance and impact',
        extractKeyCitationsSchema
    ),
    createTool(
        'compare_papers',
        'Compare two papers side-by-side to identify similarities, differences, and relationships',
        comparePapersSchema
    )
];

// Define the skill
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

    tools,

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
