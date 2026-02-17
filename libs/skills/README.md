# Skills System

A comprehensive skill management system for agent-lib that supports:

1. **Dependency Injection**: Skills are injected into agents via Workspace
2. **Markdown Format**: Skills stored as markdown files compatible with Claude's skill protocol
3. **Automated Building**: LLM-driven skill generation and optimization with human feedback

## Architecture

```
Skills (markdown) → Parser → Skill Objects → Registry → Workspace → Agent
                                                ↓
                                          Evaluator → Optimizer → Builder (LLM)
                                                ↓
                                          Feedback Collector
```

## Quick Start

### 1. Load Skills

```typescript
import { SkillRegistry, SkillLoader } from 'skills';
import { VirtualWorkspace } from 'stateful-context';

// Create registry
const registry = new SkillRegistry();

// Load skills from markdown files
const loader = new SkillLoader(registry);
await loader.loadFromDirectory('./libs/skills/repository/builtin');

console.log(`Loaded ${registry.list().length} skills`);
```

### 2. Activate Skills in Workspace

```typescript
// Create workspace
const workspace = new VirtualWorkspace({ name: 'research' });

// Register components (tools)
workspace.registerComponent({
  key: 'paper-tools',
  component: paperToolsComponent,
  priority: 100
});

// Activate skills
const skill = registry.get('paper-analysis');
await workspace.activateSkill(skill);
```

### 3. Create Agent with Skills

```typescript
import { Agent } from 'agent-lib';

// Create agent (skills are automatically available via workspace)
const agent = new Agent(
  defaultAgentConfig,
  workspace,
  { capability: '', direction: '' }, // From skills
  apiClient
);

// Use agent
await agent.start('Analyze this paper...');
```

## Skill Markdown Format

Skills are defined in markdown files following this structure:

```markdown
---
name: skill-name
version: 1.0.0
description: Brief description of what the skill does
category: category-name
tags: [tag1, tag2]
---

# Skill Title

Description of the skill (can be same as frontmatter description or more detailed).

## Capabilities

- Capability 1
- Capability 2

## Work Direction

Step-by-step guide on how to use the skill.

## Required Tools

- `tool_name`: Tool description

## Provided Tools

### tool_function_name

Description of the tool.

**Parameters:**
- `param1` (type, required/optional): Description

**Returns:**
- Description of return value

**Implementation:**

\`\`\`typescript
async (params, context) => {
  // Implementation
}
\`\`\`

## Orchestration

\`\`\`typescript
async (tools, params, context) => {
  // Workflow logic
}
\`\`\`

## Helper Functions

\`\`\`typescript
function helperFunction() {
  // Helper logic
}
\`\`\`

## Test Cases

### Test Case 1: Description

**Input:**
\`\`\`json
{ "input": "data" }
\`\`\`

**Expected Output:**
\`\`\`json
{ "output": "result" }
\`\`\`

## Metadata

- **Author**: Author Name
- **Created**: 2025-02-17
- **Last Updated**: 2025-02-17
- **Complexity**: Low/Medium/High
```

## Testing Skills

```typescript
import { SkillTestRunner, TestSuite } from 'skills';

// Create test runner
const testRunner = new SkillTestRunner(workspace, {
  verbose: true,
  stopOnFailure: false
});

// Define test suite
const testSuite: TestSuite = {
  name: 'Paper Analysis Tests',
  description: 'Test paper analysis skill',
  testCases: [
    {
      name: 'Calculate complexity',
      description: 'Test complexity calculation',
      type: 'tool',
      toolName: 'calculate_complexity',
      input: { paper_content: '...' },
      expected: { overall_score: 0.5 }
    }
  ]
};

// Run tests
const results = await testRunner.runSuite(skill, testSuite);

// Generate report
const report = testRunner.generateReport(results);
console.log(report);
```

## Evaluating Skills

```typescript
import { SkillEvaluator } from 'skills';

const evaluator = new SkillEvaluator();

// Evaluate skill
const evaluation = await evaluator.evaluate(skill, testResults);

console.log(`Overall Score: ${evaluation.metrics.overallScore}/100`);
console.log('Recommendations:', evaluation.recommendations);

// Generate report
const report = evaluator.generateReport(evaluation);
```

## Collecting Feedback

```typescript
import { FeedbackCollector } from 'skills';

const feedbackCollector = new FeedbackCollector();

// Add manual feedback
feedbackCollector.addFeedback({
  skillName: 'paper-analysis',
  skillVersion: '1.0.0',
  type: 'improvement',
  severity: 'medium',
  description: 'Add support for PDF parsing',
  reporter: 'user@example.com'
});

// Add feedback from test results
feedbackCollector.addFeedbackFromTests(skill, testResults, 'automated');

// Get feedback summary
const summary = feedbackCollector.getSummary('paper-analysis');
console.log(`Total feedback: ${summary.totalFeedback}`);

// Generate report
const report = feedbackCollector.generateReport('paper-analysis');
```

## Building Skills with LLM

```typescript
import { SkillBuilder } from 'skills';

const builder = new SkillBuilder(apiClient);

// Build new skill
const newSkill = await builder.buildSkill({
  name: 'citation-analyzer',
  description: 'Analyze citation patterns in papers',
  category: 'analysis',
  workspace: workspace,
  examples: [
    {
      input: { paper: '...' },
      expectedOutput: { citations: [...] },
      description: 'Extract citations'
    }
  ],
  constraints: ['Must handle multiple citation formats']
});

// Refine existing skill
const refinedSkill = await builder.refineSkill(
  skill,
  'Improve error handling',
  testResults
);
```

## Optimizing Skills

```typescript
import { SkillOptimizer } from 'skills';

const optimizer = new SkillOptimizer(evaluator, feedbackCollector, builder);

// Optimize skill
const result = await optimizer.optimize(skill, testResults, {
  maxIterations: 5,
  targetScore: 85,
  strategies: ['fix-failing-tests', 'improve-documentation']
});

console.log(`Optimized in ${result.iterations} iterations`);
console.log('Improvements:', result.improvements);

// Generate report
const report = optimizer.generateReport(result);
```

## Complete Workflow: Build → Test → Evaluate → Optimize

```typescript
// 1. Build skill
const skill = await builder.buildSkill(buildRequest);

// 2. Test skill
const testResults = await testRunner.runSuite(skill, testSuite);

// 3. Evaluate skill
const evaluation = await evaluator.evaluate(skill, testResults);

// 4. Collect feedback
feedbackCollector.addFeedbackFromTests(skill, testResults);

// 5. Optimize if needed
if (evaluation.metrics.overallScore < 80) {
  const optimized = await optimizer.optimize(skill, testResults, {
    targetScore: 85
  });

  // Save optimized skill
  const serializer = new SkillSerializer();
  const markdown = serializer.serialize(optimized.optimizedSkill);
  await fs.writeFile(
    `./libs/skills/repository/generated/${skill.name}.skill.md`,
    markdown
  );
}
```

## Expert System (Workspace + Skills)

```typescript
import { Expert, ExpertFactory } from 'skills';

// Create expert factory
const expertFactory = new ExpertFactory(registry, componentRegistry);

// Create predefined expert
const reviewerExpert = expertFactory.createExpert('paper-reviewer');
await reviewerExpert.initialize();

// Create agent from expert
const agent = reviewerExpert.createAgent(apiClient);

// Use agent
await agent.start('Review this paper...');
```

## Best Practices

1. **Skill Design**
   - Keep skills focused on a single domain
   - Use clear, descriptive names
   - Document all parameters and return values
   - Include test cases in markdown

2. **Testing**
   - Write comprehensive test cases
   - Test edge cases and error conditions
   - Use custom assertions for complex validations

3. **Feedback**
   - Collect feedback from both automated tests and human users
   - Prioritize high-severity issues
   - Use feedback to drive optimization

4. **Optimization**
   - Start with fixing failing tests
   - Then improve documentation and error handling
   - Finally optimize for performance

5. **Version Control**
   - Use semantic versioning for skills
   - Track changes in git
   - Maintain backward compatibility when possible

## Directory Structure

```
libs/skills/
├── src/                          # Source code (version controlled)
│   ├── core/
│   │   ├── Skill.interface.ts
│   │   ├── SkillRegistry.ts
│   │   └── SkillLoader.ts
│   ├── parser/
│   │   ├── SkillParser.ts
│   │   └── SkillSerializer.ts
│   ├── builder/
│   │   ├── SkillBuilder.ts
│   │   ├── SkillEvaluator.ts
│   │   ├── SkillOptimizer.ts
│   │   └── FeedbackCollector.ts
│   ├── testing/
│   │   ├── TestCase.ts
│   │   ├── assertions.ts
│   │   └── SkillTestRunner.ts
│   └── index.ts
├── repository/                   # Skill definitions (dynamic)
│   ├── builtin/                  # Built-in skills (version controlled)
│   │   ├── paper-analysis.skill.md
│   │   ├── reviewing-r1-r2.skill.md
│   │   └── writing.skill.md
│   ├── user/                     # User skills (gitignored)
│   │   └── .gitkeep
│   └── generated/                # LLM-generated skills (gitignored)
│       └── .gitkeep
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Contributing

To add a new built-in skill:

1. Create a markdown file in `repository/builtin/`
2. Follow the skill markdown format
3. Add test cases in the markdown
4. Test the skill using SkillTestRunner
5. Submit a pull request

To create a user skill:

1. Create a markdown file in `repository/user/`
2. Test and iterate locally
3. Optionally promote to builtin if useful for the team

## License

MIT
