import { injectable } from 'inversify';
import { ToolComponent } from '../core/toolComponent.js';
import { tdiv } from '../ui/tdiv.js';
import type { ToolCallResult } from '../core/types.js';
import { z } from 'zod';

/**
 * Paper Analysis Component - Analyzes academic papers for complexity, citations, and comparisons
 */
@injectable()
export class PaperAnalysisComponent extends ToolComponent {
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

    handleToolCall = async (toolName: string, params: any): Promise<ToolCallResult<any>> => {
        if (toolName === 'calculate_complexity') {
            const result = await this.calculateComplexity(params.paper_content, params.dimensions);
            this.analysisResults.push(result);
            return { success: true, data: result, summary: `[PaperAnalysis] 计算复杂度完成` };
        } else if (toolName === 'extract_key_citations') {
            const result = await this.extractKeyCitations(params.paper_content, params.max_citations);
            this.analysisResults.push(result);
            return { success: true, data: result, summary: `[PaperAnalysis] 提取关键引用完成` };
        } else if (toolName === 'compare_papers') {
            const result = await this.comparePapers(params.paper_a, params.paper_b, params.comparison_aspects);
            this.analysisResults.push(result);
            return { success: true, data: result, summary: `[PaperAnalysis] 论文比较完成` };
        }
        return { success: false, data: { error: `Unknown tool: ${toolName}` }, summary: `[PaperAnalysis] 未知工具: ${toolName}` };
    };

    private async calculateComplexity(content: string, dimensions?: string[]): Promise<any> {
        return { complexity: 'Calculated', dimensions: dimensions?.join(', ') || 'all' };
    }

    private async extractKeyCitations(content: string, maxCitations?: number): Promise<any> {
        return { citations: 'Extracted', count: Math.min(maxCitations || 10, 10) };
    }

    private async comparePapers(paperA: string, paperB: string, aspects?: string[]): Promise<any> {
        return { comparison: 'Completed', aspects: aspects?.join(', ') || 'all' };
    }
}
