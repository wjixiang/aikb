import { VirtualWorkspace } from 'stateful-context';
import { Agent, AgentConfig, defaultAgentConfig } from 'agent-lib';
import { ApiClient } from 'agent-lib';
import { Skill } from '../core/Skill.interface';
import { SkillBuilder } from './SkillBuilder';
import { SkillEvaluator } from './SkillEvaluator';
import { SkillOptimizer } from './SkillOptimizer';
import { FeedbackCollector } from './FeedbackCollector';
import { SkillTestRunner } from '../testing/SkillTestRunner';
import { SkillSerializer } from '../parser/SkillSerializer';
import { TestCase, TestSuite } from '../testing/TestCase';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AutoDevRequest {
  workspace: VirtualWorkspace;
  skillName: string;
  description: string;
  category: string;
  examples?: Array<{
    input: any;
    expectedOutput: any;
    description: string;
  }>;
  constraints?: string[];
  targetScore?: number;
  maxIterations?: number;
  outputDir?: string;
}

export interface AutoDevSession {
  sessionId: string;
  request: AutoDevRequest;
  currentSkill: Skill | null;
  iterations: number;
  evaluations: any[];
  feedback: any[];
  status: 'initializing' | 'generating' | 'testing' | 'optimizing' | 'awaiting_feedback' | 'completed' | 'failed';
  error?: string;
}

export interface HumanFeedback {
  sessionId: string;
  type: 'approve' | 'reject' | 'improve';
  comments?: string;
  suggestions?: string[];
  additionalExamples?: Array<{
    input: any;
    expectedOutput: any;
    description: string;
  }>;
}

/**
 * Automatic Skill Developer
 * Uses Agent to automatically develop skills from workspace analysis
 */
export class AutoSkillDeveloper {
  private sessions = new Map<string, AutoDevSession>();
  private builder: SkillBuilder;
  private evaluator: SkillEvaluator;
  private optimizer: SkillOptimizer;
  private feedbackCollector: FeedbackCollector;

  constructor(private apiClient: ApiClient) {
    this.builder = new SkillBuilder(apiClient);
    this.evaluator = new SkillEvaluator();
    this.feedbackCollector = new FeedbackCollector();
    this.optimizer = new SkillOptimizer(
      this.evaluator,
      this.feedbackCollector,
      this.builder
    );
  }

  /**
   * Start automatic skill development session
   */
  async startAutoDevSession(request: AutoDevRequest): Promise<string> {
    const sessionId = this.generateSessionId();

    const session: AutoDevSession = {
      sessionId,
      request,
      currentSkill: null,
      iterations: 0,
      evaluations: [],
      feedback: [],
      status: 'initializing'
    };

    this.sessions.set(sessionId, session);

    // Start development in background
    this.runAutoDevLoop(sessionId).catch(error => {
      session.status = 'failed';
      session.error = error.message;
    });

    return sessionId;
  }

  /**
   * Main auto-development loop
   */
  private async runAutoDevLoop(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    try {
      // Phase 1: Analyze workspace and generate initial skill
      session.status = 'generating';
      console.log(`[${sessionId}] Phase 1: Analyzing workspace and generating skill...`);

      const initialSkill = await this.generateSkillFromWorkspace(session.request);
      session.currentSkill = initialSkill;
      session.iterations++;

      // Phase 2: Test the skill
      session.status = 'testing';
      console.log(`[${sessionId}] Phase 2: Testing skill...`);

      const testResults = await this.testSkill(initialSkill, session.request.workspace);

      // Phase 3: Evaluate the skill
      console.log(`[${sessionId}] Phase 3: Evaluating skill...`);

      const evaluation = await this.evaluator.evaluate(initialSkill, testResults);
      session.evaluations.push(evaluation);

      console.log(`[${sessionId}] Initial evaluation score: ${evaluation.metrics.overallScore}/100`);

      // Phase 4: Auto-optimize if score is below target
      const targetScore = session.request.targetScore || 80;
      const maxIterations = session.request.maxIterations || 3;

      if (evaluation.metrics.overallScore < targetScore && session.iterations < maxIterations) {
        session.status = 'optimizing';
        console.log(`[${sessionId}] Phase 4: Auto-optimizing skill...`);

        const optimizationResult = await this.optimizer.optimize(
          initialSkill,
          testResults,
          {
            maxIterations: maxIterations - session.iterations,
            targetScore
          }
        );

        session.currentSkill = optimizationResult.optimizedSkill;
        session.iterations += optimizationResult.iterations;

        // Re-evaluate optimized skill
        const finalTestResults = await this.testSkill(
          optimizationResult.optimizedSkill,
          session.request.workspace
        );
        const finalEvaluation = await this.evaluator.evaluate(
          optimizationResult.optimizedSkill,
          finalTestResults
        );
        session.evaluations.push(finalEvaluation);

        console.log(`[${sessionId}] Final evaluation score: ${finalEvaluation.metrics.overallScore}/100`);
      }

      // Phase 5: Wait for human feedback
      session.status = 'awaiting_feedback';
      console.log(`[${sessionId}] Phase 5: Awaiting human feedback...`);

      // Save skill to output directory
      await this.saveSkill(session);

    } catch (error) {
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : String(error);
      console.error(`[${sessionId}] Auto-dev failed:`, error);
    }
  }

  /**
   * Generate skill by analyzing workspace
   */
  private async generateSkillFromWorkspace(request: AutoDevRequest): Promise<Skill> {
    const { workspace, skillName, description, category, examples, constraints } = request;

    // Analyze workspace tools
    const availableTools = workspace.getAllTools();
    const toolDescriptions = availableTools.map(t => ({
      name: t.tool.toolName,
      description: t.tool.desc,
      params: t.tool.paramsSchema
    }));

    // Create agent to analyze workspace and design skill
    const analysisAgent = new Agent(
      defaultAgentConfig,
      workspace,
      {
        capability: 'Analyze workspace capabilities and design skills',
        direction: 'Understand available tools and create comprehensive skill definitions'
      },
      this.apiClient
    );

    // Generate skill design prompt
    const designPrompt = this.buildSkillDesignPrompt(
      skillName,
      description,
      category,
      toolDescriptions,
      examples,
      constraints
    );

    // Use agent to design the skill
    await analysisAgent.start(designPrompt);

    // Extract skill design from agent's response
    const conversationHistory = analysisAgent.getConversationHistory();
    const skillDesign = this.extractSkillDesign(conversationHistory);

    // Build the actual skill using SkillBuilder
    const skill = await this.builder.buildSkill({
      name: skillName,
      description,
      category,
      workspace,
      examples: examples || skillDesign.examples || [],
      constraints: constraints || skillDesign.constraints || []
    });

    return skill;
  }

  /**
   * Build skill design prompt for agent
   */
  private buildSkillDesignPrompt(
    skillName: string,
    description: string,
    category: string,
    tools: any[],
    examples?: any[],
    constraints?: string[]
  ): string {
    return `
You are a Skill Design Expert. Your task is to design a comprehensive skill for this workspace.

## Skill Requirements

**Name**: ${skillName}
**Description**: ${description}
**Category**: ${category}

## Available Tools in Workspace

${tools.map((t, i) => `${i + 1}. **${t.name}**
   - Description: ${t.description}
   - Parameters: ${JSON.stringify(t.params, null, 2)}
`).join('\n')}

## Task

Please analyze the available tools and design a skill that:

1. **Identifies Use Cases**: What are the main use cases this skill should support?
2. **Designs Workflow**: How should the tools be orchestrated to achieve these use cases?
3. **Defines New Tools**: What additional tools should the skill provide to enhance functionality?
4. **Creates Examples**: Provide concrete examples of how the skill would be used
5. **Considers Edge Cases**: What error handling and edge cases should be addressed?

${examples ? `\n## Provided Examples\n${examples.map((ex, i) => `\nExample ${i + 1}: ${ex.description}\nInput: ${JSON.stringify(ex.input)}\nExpected Output: ${JSON.stringify(ex.expectedOutput)}`).join('\n')}` : ''}

${constraints ? `\n## Constraints\n${constraints.map(c => `- ${c}`).join('\n')}` : ''}

Please provide a detailed skill design including:
- Capabilities (what the skill can do)
- Work direction (step-by-step guide)
- Tool orchestration strategy
- New tools to be created
- Example use cases
- Error handling approach

Format your response as a structured analysis.
    `;
  }

  /**
   * Extract skill design from agent conversation
   */
  private extractSkillDesign(conversationHistory: any[]): {
    examples: any[];
    constraints: string[];
    capabilities: string[];
    workflow: string[];
  } {
    // Parse agent's response to extract structured design
    // This is a simplified implementation
    const design = {
      examples: [],
      constraints: [],
      capabilities: [],
      workflow: []
    };

    // Extract from last assistant message
    const lastAssistantMessage = conversationHistory
      .filter(msg => msg.role === 'assistant')
      .pop();

    if (lastAssistantMessage) {
      const content = JSON.stringify(lastAssistantMessage.content);

      // Extract capabilities
      const capabilitiesMatch = content.match(/capabilities?[:\s]+([^\n]+)/gi);
      if (capabilitiesMatch) {
        design.capabilities = capabilitiesMatch.map(m => m.replace(/capabilities?[:\s]+/i, ''));
      }

      // Extract workflow steps
      const workflowMatch = content.match(/\d+\.\s+([^\n]+)/g);
      if (workflowMatch) {
        design.workflow = workflowMatch;
      }
    }

    return design;
  }

  /**
   * Test skill with generated test cases
   */
  private async testSkill(
    skill: Skill,
    workspace: VirtualWorkspace
  ): Promise<any[]> {
    const testRunner = new SkillTestRunner(workspace, { verbose: true });

    // Generate test cases from skill examples or create basic tests
    const testCases: TestCase[] = this.generateTestCases(skill);

    if (testCases.length === 0) {
      console.warn('No test cases available, creating basic smoke test');
      testCases.push({
        name: 'Smoke test',
        description: 'Basic functionality test',
        type: 'orchestration',
        input: {},
        expected: { status: 'completed' },
        customAssert: async (actual, expected) => {
          return actual && typeof actual === 'object';
        }
      });
    }

    const testSuite: TestSuite = {
      name: `${skill.name} Auto-Generated Tests`,
      description: 'Automatically generated test suite',
      testCases
    };

    const results = await testRunner.runSuite(skill, testSuite);
    return results;
  }

  /**
   * Generate test cases from skill definition
   */
  private generateTestCases(skill: Skill): TestCase[] {
    const testCases: TestCase[] = [];

    // If skill has tools, create test cases for each tool
    if (skill.tools) {
      for (const [toolName, toolFunc] of Object.entries(skill.tools)) {
        testCases.push({
          name: `Test ${toolName}`,
          description: toolFunc.description,
          type: 'tool',
          toolName,
          input: this.generateSampleInput(toolFunc.paramsSchema),
          expected: {},
          customAssert: async (actual) => {
            return actual !== null && actual !== undefined;
          }
        });
      }
    }

    // If skill has orchestration, create orchestration test
    if (skill.orchestrate) {
      testCases.push({
        name: 'Test orchestration',
        description: 'Test complete workflow',
        type: 'orchestration',
        input: {},
        expected: { status: 'completed' },
        customAssert: async (actual) => {
          return actual && (actual.status === 'completed' || actual.status === 'success');
        }
      });
    }

    return testCases;
  }

  /**
   * Generate sample input from Zod schema
   */
  private generateSampleInput(schema: any): any {
    // Simplified implementation
    // In production, use zod schema introspection
    return {};
  }

  /**
   * Submit human feedback
   */
  async submitFeedback(feedback: HumanFeedback): Promise<void> {
    const session = this.sessions.get(feedback.sessionId);
    if (!session) throw new Error('Session not found');

    session.feedback.push(feedback);

    if (feedback.type === 'approve') {
      // Mark as completed and save final version
      session.status = 'completed';
      await this.saveSkill(session);
      console.log(`[${feedback.sessionId}] Skill approved and saved`);

    } else if (feedback.type === 'reject') {
      // Mark as failed
      session.status = 'failed';
      session.error = 'Rejected by human reviewer';
      console.log(`[${feedback.sessionId}] Skill rejected`);

    } else if (feedback.type === 'improve') {
      // Continue optimization with human feedback
      session.status = 'optimizing';

      if (!session.currentSkill) {
        throw new Error('No skill to improve');
      }

      // Collect feedback
      this.feedbackCollector.addFeedback({
        skillName: session.currentSkill.name,
        skillVersion: session.currentSkill.version,
        type: 'improvement',
        severity: 'medium',
        description: feedback.comments || 'Human requested improvements',
        reporter: 'human'
      });

      // Add additional examples if provided
      if (feedback.additionalExamples) {
        session.request.examples = [
          ...(session.request.examples || []),
          ...feedback.additionalExamples
        ];
      }

      // Re-test with new examples
      const testResults = await this.testSkill(
        session.currentSkill,
        session.request.workspace
      );

      // Refine skill based on feedback
      const refinedSkill = await this.builder.refineSkill(
        session.currentSkill,
        feedback.comments || 'Improve based on human feedback',
        testResults
      );

      session.currentSkill = refinedSkill;
      session.iterations++;

      // Re-evaluate
      const newTestResults = await this.testSkill(
        refinedSkill,
        session.request.workspace
      );
      const evaluation = await this.evaluator.evaluate(refinedSkill, newTestResults);
      session.evaluations.push(evaluation);

      // Wait for next feedback
      session.status = 'awaiting_feedback';
      await this.saveSkill(session);

      console.log(`[${feedback.sessionId}] Skill improved, awaiting next feedback`);
    }
  }

  /**
   * Save skill to file
   */
  private async saveSkill(session: AutoDevSession): Promise<void> {
    if (!session.currentSkill) return;

    const outputDir = session.request.outputDir || './libs/skills/repository/generated';
    const serializer = new SkillSerializer();
    const markdown = serializer.serialize(session.currentSkill);

    const filename = `${session.currentSkill.name}.skill.md`;
    const filepath = path.join(outputDir, filename);

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(filepath, markdown, 'utf-8');

    console.log(`[${session.sessionId}] Skill saved to ${filepath}`);
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): AutoDevSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all sessions
   */
  listSessions(): AutoDevSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Generate session report
   */
  async generateReport(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const latestEvaluation = session.evaluations[session.evaluations.length - 1];

    return `
# Auto-Development Session Report

**Session ID**: ${sessionId}
**Status**: ${session.status}
**Iterations**: ${session.iterations}

## Request

- **Skill Name**: ${session.request.skillName}
- **Description**: ${session.request.description}
- **Category**: ${session.request.category}
- **Target Score**: ${session.request.targetScore || 80}

## Current Skill

${session.currentSkill ? `
- **Name**: ${session.currentSkill.name}
- **Version**: ${session.currentSkill.version}
- **Tools Provided**: ${session.currentSkill.tools ? Object.keys(session.currentSkill.tools).length : 0}
- **Has Orchestration**: ${session.currentSkill.orchestrate ? 'Yes' : 'No'}
` : 'No skill generated yet'}

## Evaluation History

${session.evaluations.map((eval, i) => `
### Iteration ${i + 1}
- **Overall Score**: ${eval.metrics.overallScore}/100
- **Test Pass Rate**: ${(eval.metrics.testPassRate * 100).toFixed(1)}%
- **Code Quality**: ${(eval.metrics.codeQuality * 100).toFixed(1)}%
- **Documentation**: ${(eval.metrics.documentation * 100).toFixed(1)}%
`).join('\n')}

## Latest Evaluation

${latestEvaluation ? `
- **Overall Score**: ${latestEvaluation.metrics.overallScore}/100
- **Recommendations**:
${latestEvaluation.recommendations.map((r: string) => `  - ${r}`).join('\n')}
` : 'No evaluation available'}

## Human Feedback

${session.feedback.length > 0 ? session.feedback.map((f, i) => `
### Feedback ${i + 1}
- **Type**: ${f.type}
- **Comments**: ${f.comments || 'None'}
`).join('\n') : 'No feedback received yet'}

${session.error ? `\n## Error\n\n${session.error}` : ''}

---
*Generated by AutoSkillDeveloper*
    `;
  }

  // Helper methods

  private generateSessionId(): string {
    return `autodev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
