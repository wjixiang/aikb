import { ApiClient } from 'agent-lib';
import { VirtualWorkspace } from 'stateful-context';
import { Skill } from '../core/Skill.interface';
import { SkillParser } from '../parser/SkillParser';
import { SkillSerializer } from '../parser/SkillSerializer';
import { TestResult } from '../testing/TestCase';

export interface SkillBuildRequest {
  name: string;
  description: string;
  category: string;
  workspace: VirtualWorkspace;
  examples: Array<{
    input: any;
    expectedOutput: any;
    description: string;
  }>;
  constraints?: string[];
}

/**
 * Skill Builder - LLM-driven skill generation
 */
export class SkillBuilder {
  constructor(private apiClient: ApiClient) {}

  /**
   * Build a new skill using LLM
   */
  async buildSkill(request: SkillBuildRequest): Promise<Skill> {
    // 1. Analyze workspace available tools
    const availableTools = request.workspace.getAllTools();
    const toolDescriptions = availableTools.map(t => ({
      name: t.tool.toolName,
      description: t.tool.desc,
      params: t.tool.paramsSchema
    }));

    // 2. Build prompt
    const prompt = this.buildPrompt(request, toolDescriptions);

    // 3. Call LLM to generate skill markdown
    const response = await this.apiClient.makeRequest(prompt, '', [], {
      timeout: 60000
    });

    // 4. Parse generated markdown
    const skillMarkdown = this.extractMarkdown(response);
    const parser = new SkillParser();
    const skill = parser.parse(skillMarkdown);

    return skill;
  }

  /**
   * Refine an existing skill based on feedback
   */
  async refineSkill(
    skill: Skill,
    feedback: string,
    testResults: TestResult[]
  ): Promise<Skill> {
    const serializer = new SkillSerializer();
    const currentMarkdown = serializer.serialize(skill);

    const prompt = `
You are refining an existing skill based on feedback and test results.

## Current Skill

${currentMarkdown}

## Feedback

${feedback}

## Test Results

${testResults
  .map(
    (result, i) => `
### Test ${i + 1}: ${result.testCase.name}
- **Status**: ${result.passed ? 'PASSED' : 'FAILED'}
- **Expected**: ${JSON.stringify(result.testCase.expected)}
- **Actual**: ${JSON.stringify(result.actual)}
${result.error ? `- **Error**: ${result.error}` : ''}
`
  )
  .join('\n')}

## Task

Refine the skill to:
1. Address the feedback
2. Fix failing tests
3. Improve robustness and error handling
4. Maintain backward compatibility where possible

Generate the improved skill markdown:
    `;

    const response = await this.apiClient.makeRequest(prompt, '', [], {
      timeout: 60000
    });

    const refinedMarkdown = this.extractMarkdown(response);
    const parser = new SkillParser();
    return parser.parse(refinedMarkdown);
  }

  /**
   * Generate skill from examples (few-shot learning)
   */
  async generateFromExamples(
    name: string,
    examples: Array<{ input: any; output: any; explanation?: string }>,
    workspace: VirtualWorkspace
  ): Promise<Skill> {
    const availableTools = workspace.getAllTools();
    const toolDescriptions = availableTools.map(t => ({
      name: t.tool.toolName,
      description: t.tool.desc
    }));

    const prompt = `
You are creating a new skill from examples.

## Skill Name

${name}

## Available Tools

${toolDescriptions.map(t => `- \`${t.name}\`: ${t.description}`).join('\n')}

## Examples

${examples
  .map(
    (ex, i) => `
### Example ${i + 1}${ex.explanation ? `: ${ex.explanation}` : ''}

**Input:**
\`\`\`json
${JSON.stringify(ex.input, null, 2)}
\`\`\`

**Output:**
\`\`\`json
${JSON.stringify(ex.output, null, 2)}
\`\`\`
`
  )
  .join('\n')}

## Task

Based on these examples, create a skill that:
1. Identifies the pattern in the examples
2. Implements the logic using available tools
3. Handles edge cases
4. Provides clear documentation

Generate the skill markdown in the standard format.
    `;

    const response = await this.apiClient.makeRequest(prompt, '', [], {
      timeout: 60000
    });

    const skillMarkdown = this.extractMarkdown(response);
    const parser = new SkillParser();
    return parser.parse(skillMarkdown);
  }

  // Private methods

  private buildPrompt(
    request: SkillBuildRequest,
    tools: any[]
  ): string {
    return `
You are a Skill Builder AI. Your task is to create a new skill definition in markdown format.

## Skill Requirements

**Name**: ${request.name}
**Description**: ${request.description}
**Category**: ${request.category}

## Available Tools

The skill can use the following tools from the workspace:

${tools.map(t => `- \`${t.name}\`: ${t.description}`).join('\n')}

## Examples

The skill should handle the following scenarios:

${request.examples
  .map(
    (ex, i) => `
### Example ${i + 1}: ${ex.description}

**Input:**
\`\`\`json
${JSON.stringify(ex.input, null, 2)}
\`\`\`

**Expected Output:**
\`\`\`json
${JSON.stringify(ex.expectedOutput, null, 2)}
\`\`\`
`
  )
  .join('\n')}

## Constraints

${request.constraints?.map(c => `- ${c}`).join('\n') || 'None'}

## Task

Generate a complete skill definition in markdown format following this structure:

1. Frontmatter with metadata (name, version, category, tags)
2. Title and description
3. Capabilities section (bullet points)
4. Work Direction section (step-by-step guide)
5. Required Tools section (list tools from available tools)
6. Provided Tools section (define new tools if needed, with parameters, returns, and implementation)
7. Orchestration section (optional, for complex workflows)
8. Helper Functions section (optional, for internal utilities)
9. Test Cases section (based on examples)
10. Metadata section (author, dates, complexity)

The skill should:
- Use available tools efficiently
- Handle edge cases gracefully
- Provide clear error messages
- Be well-documented with examples
- Include TypeScript implementation code

Generate the skill markdown now:
    `;
  }

  private extractMarkdown(response: any): string {
    // Extract markdown from LLM response
    const content = response.content || '';

    // Look for markdown code block
    const match = content.match(/```markdown\n([\s\S]*?)\n```/);
    if (match) {
      return match[1];
    }

    // If no code block, assume entire response is markdown
    return content;
  }
}
