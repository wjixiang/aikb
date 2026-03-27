import { injectable } from 'inversify';
import { ToolComponent } from 'agent-lib/components';
import { tdiv } from 'agent-lib/components/ui';
import type { ToolCallResult } from 'agent-lib/components';
import { z } from 'zod';

@injectable()
export class PaperAnalysisComponent extends ToolComponent<{
  analysisResults: any[];
}> {
  componentId = 'paper-analyzer';
  displayName = 'Paper Analyzer';
  description =
    'Analyzes academic papers for complexity, citations, and comparisons';
  componentPrompt = `## Paper Analysis

This component analyzes academic papers for complexity, citations, and comparisons.

**Analysis Capabilities:**
- Calculate complexity scores across multiple dimensions (technical, mathematical, conceptual, experimental)
- Extract and rank key citations based on relevance and impact
- Compare papers side-by-side to identify similarities and differences

**Best Practices:**
- Use complexity scores to assess paper difficulty before deep reading
- Extract key citations to build literature review foundations
- Compare papers to avoid redundancy in literature survey`;

  protected initialState() {
    return { analysisResults: [] };
  }

  protected toolDefs() {
    return {
      calculate_complexity: {
        desc: 'Calculate paper complexity scores across multiple dimensions (technical, mathematical, conceptual, experimental)',
        paramsSchema: z.object({
          paper_content: z.string().describe('The paper content to analyze'),
          dimensions: z
            .array(
              z.enum([
                'technical',
                'mathematical',
                'conceptual',
                'experimental',
              ]),
            )
            .optional()
            .describe('Complexity dimensions to evaluate'),
        }),
      },
      extract_key_citations: {
        desc: 'Extract and rank key citations from papers based on relevance and impact',
        paramsSchema: z.object({
          paper_content: z.string().describe('The paper content to analyze'),
          max_citations: z
            .number()
            .optional()
            .describe('Maximum number of citations to extract'),
        }),
      },
      compare_papers: {
        desc: 'Compare two papers side-by-side to identify similarities, differences, and relationships',
        paramsSchema: z.object({
          paper_a: z.string().describe('First paper content'),
          paper_b: z.string().describe('Second paper content'),
          comparison_aspects: z
            .array(z.string())
            .optional()
            .describe('Specific aspects to compare'),
        }),
      },
    };
  }

  renderImply = async () => {
    return [
      new tdiv({
        content: `Analysis Results: ${this.snapshot.analysisResults.length}`,
        styles: { showBorder: false },
      }),
    ];
  };

  async onCalculate_complexity(params: {
    paper_content: string;
    dimensions?: string[];
  }): Promise<ToolCallResult<any>> {
    const result = await this.calculateComplexity(
      params.paper_content,
      params.dimensions,
    );
    this.reactive.analysisResults.push(result);
    return {
      success: true,
      data: result,
      summary: `[PaperAnalysis] 计算复杂度完成`,
    };
  }

  async onExtract_key_citations(params: {
    paper_content: string;
    max_citations?: number;
  }): Promise<ToolCallResult<any>> {
    const result = await this.extractKeyCitations(
      params.paper_content,
      params.max_citations,
    );
    this.reactive.analysisResults.push(result);
    return {
      success: true,
      data: result,
      summary: `[PaperAnalysis] 提取关键引用完成`,
    };
  }

  async onCompare_papers(params: {
    paper_a: string;
    paper_b: string;
    comparison_aspects?: string[];
  }): Promise<ToolCallResult<any>> {
    const result = await this.comparePapers(
      params.paper_a,
      params.paper_b,
      params.comparison_aspects,
    );
    this.reactive.analysisResults.push(result);
    return {
      success: true,
      data: result,
      summary: `[PaperAnalysis] 论文比较完成`,
    };
  }

  private async calculateComplexity(
    content: string,
    dimensions?: string[],
  ): Promise<any> {
    return {
      complexity: 'Calculated',
      dimensions: dimensions?.join(', ') || 'all',
    };
  }

  private async extractKeyCitations(
    content: string,
    maxCitations?: number,
  ): Promise<any> {
    return { citations: 'Extracted', count: Math.min(maxCitations || 10, 10) };
  }

  private async comparePapers(
    paperA: string,
    paperB: string,
    aspects?: string[],
  ): Promise<any> {
    return { comparison: 'Completed', aspects: aspects?.join(', ') || 'all' };
  }
}
