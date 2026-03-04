import { z } from 'zod';
import { defineSkill, createComponentDefinition, createTool } from '../SkillDefinition.js';
import { ToolComponent } from '../../statefulContext/toolComponent.js';
import { tdiv } from '../../statefulContext/ui/index.js';

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
        return { complexity: 'Calculated', dimensions: dimensions.join(', ') };
    }

    private async extractKeyCitations(content: string, maxCitations: number): Promise<any> {
        return { citations: 'Extracted', count: Math.min(maxCitations, 10) };
    }

    private async comparePapers(paperA: string, paperB: string, aspects: string[]): Promise<any> {
        return { comparison: 'Completed', aspects: aspects.join(', ') };
    }
}

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
            new PaperAnalysisComponent()
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
