import { defineSkill, createComponentDefinition } from '../SkillDefinition.js';
import { ToolComponent } from '../../statefulContext/toolComponent.js';
import { tdiv } from '../../statefulContext/ui/index.js';
import { z } from 'zod';

/**
 * Paper Analysis Component - Analyzes academic papers
 */
class PaperAnalysisComponent extends ToolComponent {
    override componentId = 'paper-analyzer';
    override displayName = 'Paper Analyzer';
    override description = 'Analyzes academic papers for complexity, citations, and comparisons';

    toolSet = new Map([
        ['calculate_complexity', {
            toolName: 'calculate_complexity',
            desc: 'Calculate paper complexity scores across multiple dimensions (technical, mathematical, conceptual, experimental)',
            paramsSchema: z.object({
                paper_content: z.string().describe('The paper content to analyze'),
                dimensions: z.array(z.enum(['technical', 'mathematical', 'conceptual', 'experimental'])).optional().describe('Complexity dimensions to evaluate')
            })
        }],
        ['extract_key_citations', {
            toolName: 'extract_key_citations',
            desc: 'Extract and rank key citations from papers based on relevance and impact',
            paramsSchema: z.object({
                paper_content: z.string().describe('The paper content to analyze'),
                max_citations: z.number().optional().describe('Maximum number of citations to extract')
            })
        }],
        ['compare_papers', {
            toolName: 'compare_papers',
            desc: 'Compare two papers side-by-side to identify similarities, differences, and relationships',
            paramsSchema: z.object({
                paper_a: z.string().describe('First paper content'),
                paper_b: z.string().describe('Second paper content'),
                comparison_aspects: z.array(z.string()).optional().describe('Specific aspects to compare')
            })
        }]
    ]);

    private analysisResults: any[] = [];

    renderImply = async () => {
        return [
            new tdiv({
                content: `Analysis Results: ${this.analysisResults.length}`,
                styles: { showBorder: false }
            })
        ];
    };

    handleToolCall = async (toolName: string, params: any) => {
        if (toolName === 'calculate_complexity') {
            const result = await this.calculateComplexity(params.paper_content, params.dimensions);
            this.analysisResults.push(result);
        } else if (toolName === 'extract_key_citations') {
            const result = await this.extractKeyCitations(params.paper_content, params.max_citations);
            this.analysisResults.push(result);
        } else if (toolName === 'compare_papers') {
            const result = await this.comparePapers(params.paper_a, params.paper_b, params.comparison_aspects);
            this.analysisResults.push(result);
        }
    };

    private async calculateComplexity(content: string, dimensions: string[]): Promise<any> {
        return { complexity: 'Calculated', dimensions: dimensions?.join(', ') };
    }

    private async extractKeyCitations(content: string, maxCitations: number): Promise<any> {
        return { citations: 'Extracted', count: Math.min(maxCitations, 10) };
    }

    private async comparePapers(paperA: string, paperB: string, aspects: string[]): Promise<any> {
        return { comparison: 'Completed', aspects: aspects?.join(', ') };
    }
}

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
            new PaperAnalysisComponent()
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
