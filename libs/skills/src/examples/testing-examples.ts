/**
 * Example: Testing Paper Analysis Skill
 *
 * This example demonstrates how to test a skill with real workspace
 */

import { SkillTestRunner, TestSuite, TestCase } from '../testing/SkillTestRunner';
import { SkillRegistry } from '../core/SkillRegistry';
import { SkillLoader } from '../core/SkillLoader';
import { VirtualWorkspace } from 'stateful-context';
import { ToolComponent } from 'stateful-context';
import { z } from 'zod';

/**
 * Example 1: Basic Tool Test
 */
export async function testBasicTool() {
  console.log('=== Example 1: Basic Tool Test ===\n');

  // 1. Create workspace
  const workspace = new VirtualWorkspace({ name: 'test' });

  // 2. Register mock components (required tools)
  const mockComponent = new ToolComponent({
    key: 'mock-tools',
    name: 'Mock Tools',
    description: 'Mock tools for testing'
  });

  mockComponent.registerTool({
    toolName: 'preprocess_paper',
    paramsSchema: z.object({
      content: z.string()
    }),
    desc: 'Preprocess paper',
    handler: async (params) => {
      return params.content.toLowerCase();
    }
  });

  mockComponent.registerTool({
    toolName: 'assess_novelty',
    paramsSchema: z.object({
      content: z.string()
    }),
    desc: 'Assess novelty',
    handler: async (params) => {
      return { score: 0.7 };
    }
  });

  workspace.registerComponent({
    key: 'mock-tools',
    component: mockComponent,
    priority: 100
  });

  // 3. Load skill
  const registry = new SkillRegistry();
  const loader = new SkillLoader(registry);
  await loader.loadFile('./repository/builtin/paper-analysis.skill.md');
  const skill = registry.get('paper-analysis');

  if (!skill) {
    console.error('Skill not found');
    return;
  }

  // 4. Activate skill
  await workspace.activateSkill(skill);

  // 5. Create test runner
  const testRunner = new SkillTestRunner(workspace, {
    verbose: true
  });

  // 6. Define test case
  const testCase: TestCase = {
    name: 'Calculate complexity',
    description: 'Test complexity calculation with math formulas',
    type: 'tool',
    toolName: 'calculate_complexity',
    input: {
      paper_content: 'This paper presents $E=mc^2$ and $F=ma$ formulas',
      metrics: ['math', 'structure']
    },
    expected: {
      overall_score: expect.any(Number),
      complexity_level: expect.stringMatching(/low|medium|high/)
    }
  };

  // 7. Run test
  const result = await testRunner.runTest(skill, testCase);

  // 8. Check result
  console.log(`Test: ${result.testCase.name}`);
  console.log(`Status: ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`Duration: ${result.duration}ms`);
  if (result.error) {
    console.log(`Error: ${result.error}`);
  }
  console.log(`Result:`, result.actual);
}

/**
 * Example 2: Test Suite
 */
export async function testSuite() {
  console.log('\n=== Example 2: Test Suite ===\n');

  // Setup
  const workspace = new VirtualWorkspace({ name: 'test' });

  // Register mock components
  const mockComponent = new ToolComponent({
    key: 'mock-tools',
    name: 'Mock Tools',
    description: 'Mock tools'
  });

  mockComponent.registerTool({
    toolName: 'preprocess_paper',
    paramsSchema: z.object({ content: z.string() }),
    desc: 'Preprocess',
    handler: async (params) => params.content
  });

  mockComponent.registerTool({
    toolName: 'assess_novelty',
    paramsSchema: z.object({ content: z.string() }),
    desc: 'Assess novelty',
    handler: async (params) => ({ score: 0.7 })
  });

  mockComponent.registerTool({
    toolName: 'extract_aspect',
    paramsSchema: z.object({ paper: z.string(), aspect: z.string() }),
    desc: 'Extract aspect',
    handler: async (params) => `Extracted ${params.aspect}`
  });

  workspace.registerComponent({
    key: 'mock-tools',
    component: mockComponent,
    priority: 100
  });

  // Load skill
  const registry = new SkillRegistry();
  const loader = new SkillLoader(registry);
  await loader.loadFile('./repository/builtin/paper-analysis.skill.md');
  const skill = registry.get('paper-analysis');

  if (!skill) {
    console.error('Skill not found');
    return;
  }

  await workspace.activateSkill(skill);

  // Create test runner
  const testRunner = new SkillTestRunner(workspace, {
    verbose: true,
    stopOnFailure: false
  });

  // Define test suite
  const testSuite: TestSuite = {
    name: 'Paper Analysis Test Suite',
    description: 'Comprehensive tests for paper analysis skill',

    beforeAll: async () => {
      console.log('Setting up test environment...');
    },

    afterAll: async () => {
      console.log('Cleaning up...');
    },

    testCases: [
      {
        name: 'Calculate math complexity',
        description: 'Test math formula detection',
        type: 'tool',
        toolName: 'calculate_complexity',
        input: {
          paper_content: 'Paper with $E=mc^2$ formula',
          metrics: ['math']
        },
        expected: {},
        customAssert: async (actual) => {
          return actual.detailed_scores?.math > 0;
        }
      },
      {
        name: 'Calculate structural complexity',
        description: 'Test section counting',
        type: 'tool',
        toolName: 'calculate_complexity',
        input: {
          paper_content: '# Intro\n## Method\n## Results',
          metrics: ['structure']
        },
        expected: {},
        customAssert: async (actual) => {
          return actual.detailed_scores?.structure > 0;
        }
      },
      {
        name: 'Extract citations',
        description: 'Test citation extraction',
        type: 'tool',
        toolName: 'extract_key_citations',
        input: {
          paper_content: 'Study [1] showed [2] and [1] confirmed',
          top_n: 2
        },
        expected: {},
        customAssert: async (actual) => {
          return actual.total_citations === 3 &&
                 actual.unique_citations === 2;
        }
      },
      {
        name: 'Compare papers',
        description: 'Test paper comparison',
        type: 'tool',
        toolName: 'compare_papers',
        input: {
          paper_a: 'Paper A about machine learning',
          paper_b: 'Paper B about deep learning',
          aspects: ['method']
        },
        expected: {},
        customAssert: async (actual) => {
          return actual.method &&
                 actual.method.similarity !== undefined;
        }
      }
    ]
  };

  // Run test suite
  const results = await testRunner.runSuite(skill, testSuite);

  // Generate report
  const report = testRunner.generateReport(results);
  console.log('\n' + report);

  return results;
}

/**
 * Example 3: Test with Custom Assertions
 */
export async function testCustomAssertions() {
  console.log('\n=== Example 3: Custom Assertions ===\n');

  const workspace = new VirtualWorkspace({ name: 'test' });

  // Setup mock components
  const mockComponent = new ToolComponent({
    key: 'mock',
    name: 'Mock',
    description: 'Mock'
  });

  mockComponent.registerTool({
    toolName: 'preprocess_paper',
    paramsSchema: z.object({ content: z.string() }),
    desc: 'Preprocess',
    handler: async (params) => params.content
  });

  workspace.registerComponent({
    key: 'mock',
    component: mockComponent,
    priority: 100
  });

  // Load skill
  const registry = new SkillRegistry();
  const loader = new SkillLoader(registry);
  await loader.loadFile('./repository/builtin/paper-analysis.skill.md');
  const skill = registry.get('paper-analysis');

  if (!skill) return;

  await workspace.activateSkill(skill);

  const testRunner = new SkillTestRunner(workspace);

  // Test with custom assertion
  const testCase: TestCase = {
    name: 'Complex validation',
    description: 'Test with custom validation logic',
    type: 'tool',
    toolName: 'calculate_complexity',
    input: {
      paper_content: 'Test paper with $x^2$ and $y^2$',
      metrics: ['math', 'structure']
    },
    expected: {},
    customAssert: async (actual, expected) => {
      // Custom validation logic
      console.log('Running custom assertion...');

      // Check structure
      if (!actual.overall_score) {
        console.log('✗ Missing overall_score');
        return false;
      }

      if (!actual.detailed_scores) {
        console.log('✗ Missing detailed_scores');
        return false;
      }

      if (!actual.complexity_level) {
        console.log('✗ Missing complexity_level');
        return false;
      }

      // Check ranges
      if (actual.overall_score < 0 || actual.overall_score > 1) {
        console.log('✗ overall_score out of range');
        return false;
      }

      // Check complexity level
      const validLevels = ['low', 'medium', 'high'];
      if (!validLevels.includes(actual.complexity_level)) {
        console.log('✗ Invalid complexity_level');
        return false;
      }

      console.log('✓ All custom checks passed');
      return true;
    }
  };

  const result = await testRunner.runTest(skill, testCase);

  console.log(`\nTest: ${result.testCase.name}`);
  console.log(`Status: ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`Duration: ${result.duration}ms`);
}

/**
 * Example 4: Test from Markdown
 */
export async function testFromMarkdown() {
  console.log('\n=== Example 4: Test from Markdown ===\n');

  const workspace = new VirtualWorkspace({ name: 'test' });

  // Setup
  const mockComponent = new ToolComponent({
    key: 'mock',
    name: 'Mock',
    description: 'Mock'
  });

  mockComponent.registerTool({
    toolName: 'preprocess_paper',
    paramsSchema: z.object({ content: z.string() }),
    desc: 'Preprocess',
    handler: async (params) => params.content
  });

  workspace.registerComponent({
    key: 'mock',
    component: mockComponent,
    priority: 100
  });

  // Load skill
  const registry = new SkillRegistry();
  const loader = new SkillLoader(registry);
  await loader.loadFile('./repository/builtin/paper-analysis.skill.md');
  const skill = registry.get('paper-analysis');

  if (!skill) return;

  await workspace.activateSkill(skill);

  const testRunner = new SkillTestRunner(workspace);

  // Read skill markdown
  const fs = await import('fs/promises');
  const markdown = await fs.readFile(
    './repository/builtin/paper-analysis.skill.md',
    'utf-8'
  );

  // Extract test cases from markdown
  const testCases = testRunner.extractTestsFromMarkdown(markdown);

  console.log(`Extracted ${testCases.length} test cases from markdown`);

  if (testCases.length > 0) {
    const testSuite: TestSuite = {
      name: 'Markdown Tests',
      description: 'Tests extracted from skill markdown',
      testCases
    };

    const results = await testRunner.runSuite(skill, testSuite);

    console.log(`\nPassed: ${results.filter(r => r.passed).length}/${results.length}`);
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  try {
    await testBasicTool();
    await testSuite();
    await testCustomAssertions();
    await testFromMarkdown();

    console.log('\n✓ All examples completed');
  } catch (error) {
    console.error('\n✗ Error running examples:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}
