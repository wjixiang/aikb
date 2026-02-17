# Testing Skills

Complete guide for testing skills in the skills system.

## Testing Approaches

### 1. Unit Testing (Individual Tools)
Test each tool function in isolation.

### 2. Integration Testing (Orchestration)
Test the complete workflow with real workspace.

### 3. End-to-End Testing (Agent)
Test skill through Agent interaction.

## Quick Start

### Basic Test Example

```typescript
import { SkillTestRunner, TestSuite, TestCase } from 'skills';
import { VirtualWorkspace } from 'stateful-context';
import { SkillRegistry, SkillLoader } from 'skills';

// 1. Setup
const workspace = new VirtualWorkspace({ name: 'test' });
const registry = new SkillRegistry();
const loader = new SkillLoader(registry);

// 2. Load skill
await loader.loadFile('./repository/builtin/paper-analysis.skill.md');
const skill = registry.get('paper-analysis');

// 3. Activate skill in workspace
await workspace.activateSkill(skill);

// 4. Create test runner
const testRunner = new SkillTestRunner(workspace, {
  verbose: true,
  stopOnFailure: false
});

// 5. Define test suite
const testSuite: TestSuite = {
  name: 'Paper Analysis Tests',
  description: 'Test paper analysis skill',
  testCases: [
    {
      name: 'Calculate complexity',
      description: 'Test complexity calculation',
      type: 'tool',
      toolName: 'calculate_complexity',
      input: {
        paper_content: 'Sample paper with $E=mc^2$ formula',
        metrics: ['math', 'structure']
      },
      expected: {
        overall_score: expect.any(Number),
        complexity_level: expect.stringMatching(/low|medium|high/)
      }
    }
  ]
};

// 6. Run tests
const results = await testRunner.runSuite(skill, testSuite);

// 7. Check results
console.log(`Passed: ${results.filter(r => r.passed).length}/${results.length}`);
```

## Test Types

### 1. Tool Tests

Test individual tool functions:

```typescript
const toolTest: TestCase = {
  name: 'Test calculate_complexity',
  description: 'Verify complexity calculation',
  type: 'tool',
  toolName: 'calculate_complexity',  // Tool name without skill prefix
  input: {
    paper_content: 'Test paper',
    metrics: ['math']
  },
  expected: {
    overall_score: 0.5,
    detailed_scores: { math: 0.5 }
  },
  timeout: 5000
};
```

### 2. Orchestration Tests

Test complete workflow:

```typescript
const orchestrationTest: TestCase = {
  name: 'Test complete workflow',
  description: 'Test end-to-end workflow',
  type: 'orchestration',
  input: {
    research_question: 'What is the efficacy of metformin?',
    inclusion_criteria: ['type 2 diabetes', 'metformin'],
    exclusion_criteria: ['type 1 diabetes']
  },
  expected: {
    status: 'completed',
    summary: expect.objectContaining({
      included_studies: expect.any(Number)
    })
  },
  timeout: 60000  // Longer timeout for workflows
};
```

### 3. Integration Tests

Test with real workspace components:

```typescript
const integrationTest: TestCase = {
  name: 'Integration with PubMed',
  description: 'Test with real PubMed search',
  type: 'integration',
  input: {
    query: 'diabetes treatment'
  },
  expected: {
    results: expect.any(Array)
  },
  setup: async (workspace) => {
    // Setup test data or mock services
  },
  teardown: async (workspace) => {
    // Cleanup
  }
};
```

## Custom Assertions

For complex validation:

```typescript
const customTest: TestCase = {
  name: 'Custom validation',
  description: 'Test with custom assertion',
  type: 'tool',
  toolName: 'extract_key_citations',
  input: {
    paper_content: 'Paper with [1] and [2] citations'
  },
  expected: {},
  customAssert: async (actual, expected) => {
    // Custom validation logic
    if (!actual.key_citations) return false;
    if (actual.key_citations.length === 0) return false;
    if (actual.total_citations < actual.unique_citations) return false;
    return true;
  }
};
```

## Test Suites

Organize tests into suites:

```typescript
const testSuite: TestSuite = {
  name: 'Paper Analysis Complete Suite',
  description: 'All tests for paper analysis skill',

  // Run before all tests
  beforeAll: async () => {
    console.log('Setting up test environment...');
    // Initialize test data, mock services, etc.
  },

  // Run after all tests
  afterAll: async () => {
    console.log('Cleaning up...');
    // Cleanup resources
  },

  testCases: [
    // ... test cases
  ]
};
```

## Assertions

Use built-in assertions:

```typescript
import { assert } from 'skills';

// Basic assertions
assert.equal(actual, expected);
assert.deepEqual(actual, expected);
assert.truthy(value);
assert.falsy(value);

// Type assertions
assert.isType(value, 'string');
assert.isType(value, 'number');

// Collection assertions
assert.contains(array, item);
assert.hasLength(array, 5);
assert.hasProperty(object, 'key');

// Range assertions
assert.inRange(value, 0, 100);

// Pattern assertions
assert.matches(string, /pattern/);

// Error assertions
await assert.throws(async () => {
  throw new Error('Expected error');
});

await assert.doesNotThrow(async () => {
  // Should not throw
});

// Custom assertions
assert.custom(
  condition,
  'Custom error message',
  expected,
  actual
);
```

## Running Tests

### Programmatic

```typescript
import { SkillTestRunner } from 'skills';

const testRunner = new SkillTestRunner(workspace, {
  verbose: true,           // Print detailed output
  stopOnFailure: false,    // Continue after failures
  timeout: 30000           // Default timeout (ms)
});

// Run single test
const result = await testRunner.runTest(skill, testCase);

// Run test suite
const results = await testRunner.runSuite(skill, testSuite);

// Generate report
const report = testRunner.generateReport(results);
console.log(report);
```

### CLI

```bash
# Test a specific skill
skill-test ./repository/builtin/paper-analysis.skill.md

# Test all skills in directory
skill-test ./repository/builtin/*.skill.md

# Test with options
skill-test paper-analysis.skill.md \
  --verbose \
  --stop-on-failure \
  --timeout 60000

# Generate report
skill-test paper-analysis.skill.md --report report.md
```

## Test from Markdown

Skills can include test cases in markdown:

```markdown
## Test Cases

### Test Case 1: Calculate Complexity

**Input:**
\`\`\`json
{
  "paper_content": "Sample paper",
  "metrics": ["math"]
}
\`\`\`

**Expected Output:**
\`\`\`json
{
  "overall_score": 0.5
}
\`\`\`
```

Extract and run:

```typescript
const testRunner = new SkillTestRunner(workspace);

// Extract tests from markdown
const markdown = await fs.readFile('skill.md', 'utf-8');
const testCases = testRunner.extractTestsFromMarkdown(markdown);

// Run extracted tests
const testSuite: TestSuite = {
  name: 'Markdown Tests',
  description: 'Tests from skill markdown',
  testCases
};

const results = await testRunner.runSuite(skill, testSuite);
```

## Complete Example

```typescript
// test/skills/paper-analysis.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SkillTestRunner, TestSuite } from 'skills';
import { VirtualWorkspace } from 'stateful-context';
import { SkillRegistry, SkillLoader } from 'skills';

describe('Paper Analysis Skill', () => {
  let workspace: VirtualWorkspace;
  let testRunner: SkillTestRunner;
  let skill: any;

  beforeAll(async () => {
    // Setup
    workspace = new VirtualWorkspace({ name: 'test' });

    // Register required components
    // ... (register components that provide required tools)

    // Load skill
    const registry = new SkillRegistry();
    const loader = new SkillLoader(registry);
    await loader.loadFile('./repository/builtin/paper-analysis.skill.md');
    skill = registry.get('paper-analysis');

    // Activate skill
    await workspace.activateSkill(skill);

    // Create test runner
    testRunner = new SkillTestRunner(workspace, { verbose: false });
  });

  afterAll(async () => {
    // Cleanup
    await workspace.deactivateSkill(skill.name);
  });

  describe('calculate_complexity', () => {
    it('should calculate math complexity', async () => {
      const result = await testRunner.runTest(skill, {
        name: 'Math complexity',
        description: 'Test math formula detection',
        type: 'tool',
        toolName: 'calculate_complexity',
        input: {
          paper_content: 'Paper with $E=mc^2$ and $F=ma$ formulas',
          metrics: ['math']
        },
        expected: {
          detailed_scores: {
            math: expect.any(Number)
          }
        }
      });

      expect(result.passed).toBe(true);
      expect(result.actual.detailed_scores.math).toBeGreaterThan(0);
    });

    it('should calculate structural complexity', async () => {
      const result = await testRunner.runTest(skill, {
        name: 'Structural complexity',
        description: 'Test section counting',
        type: 'tool',
        toolName: 'calculate_complexity',
        input: {
          paper_content: '# Intro\n## Method\n## Results\n## Discussion',
          metrics: ['structure']
        },
        expected: {
          detailed_scores: {
            structure: expect.any(Number)
          }
        }
      });

      expect(result.passed).toBe(true);
    });

    it('should handle empty input', async () => {
      const result = await testRunner.runTest(skill, {
        name: 'Empty input',
        description: 'Test error handling',
        type: 'tool',
        toolName: 'calculate_complexity',
        input: {
          paper_content: ''
        },
        expected: {},
        customAssert: async (actual) => {
          return actual.overall_score === 0;
        }
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('extract_key_citations', () => {
    it('should extract citations', async () => {
      const result = await testRunner.runTest(skill, {
        name: 'Extract citations',
        description: 'Test citation extraction',
        type: 'tool',
        toolName: 'extract_key_citations',
        input: {
          paper_content: 'Study [1] showed that [2] and [1] confirmed',
          top_n: 2
        },
        expected: {
          total_citations: 3,
          unique_citations: 2,
          key_citations: expect.arrayContaining([
            expect.objectContaining({ citation: '[1]', count: 2 })
          ])
        }
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('Full Suite', () => {
    it('should pass all tests', async () => {
      const testSuite: TestSuite = {
        name: 'Paper Analysis Full Suite',
        description: 'Complete test suite',
        testCases: [
          {
            name: 'Test 1',
            description: 'First test',
            type: 'tool',
            toolName: 'calculate_complexity',
            input: { paper_content: 'test' },
            expected: {}
          },
          {
            name: 'Test 2',
            description: 'Second test',
            type: 'tool',
            toolName: 'extract_key_citations',
            input: { paper_content: '[1] [2]' },
            expected: {}
          }
        ]
      };

      const results = await testRunner.runSuite(skill, testSuite);
      const passed = results.filter(r => r.passed).length;

      expect(passed).toBe(results.length);
    });
  });
});
```

## Mocking

For testing without real dependencies:

```typescript
import { vi } from 'vitest';

// Mock workspace tools
const mockWorkspace = {
  handleToolCall: vi.fn(async (toolName, params) => {
    if (toolName === 'search_pubmed') {
      return { results: [], total_results: 0 };
    }
    return {};
  }),
  getAllTools: vi.fn(() => []),
  activateSkill: vi.fn(),
  // ... other methods
};

// Use mock in tests
const testRunner = new SkillTestRunner(mockWorkspace as any);
```

## Coverage

Track test coverage:

```bash
# Run with coverage
vitest --coverage

# Generate coverage report
vitest --coverage --reporter=html
```

## Continuous Testing

### Watch Mode

```bash
# Watch for changes and re-run tests
vitest --watch

# Watch specific files
vitest --watch paper-analysis.test.ts
```

### CI/CD Integration

```yaml
# .github/workflows/test-skills.yml
name: Test Skills

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run test:skills
      - run: npm run test:skills:coverage
```

## Best Practices

1. **Test Each Tool**: Write at least one test per tool
2. **Test Edge Cases**: Empty inputs, invalid data, boundary conditions
3. **Test Error Handling**: Verify errors are handled gracefully
4. **Use Descriptive Names**: Clear test names help debugging
5. **Keep Tests Fast**: Mock slow operations
6. **Test Orchestration**: Verify workflow logic
7. **Use Assertions**: Prefer built-in assertions over manual checks
8. **Generate Reports**: Document test results
9. **Automate**: Run tests in CI/CD
10. **Update Tests**: Keep tests in sync with skill changes

## Troubleshooting

### Tests Failing

1. Check workspace setup
2. Verify required tools are available
3. Check input/output formats
4. Review error messages
5. Run with verbose mode

### Timeouts

1. Increase timeout for slow operations
2. Mock external services
3. Optimize skill implementation

### Flaky Tests

1. Avoid time-dependent logic
2. Use deterministic test data
3. Mock random/external dependencies

## Resources

- [Assertions API](./src/testing/assertions.ts)
- [TestRunner API](./src/testing/SkillTestRunner.ts)
- [Example Tests](./src/__tests__/)
- [Vitest Documentation](https://vitest.dev/)

---

For more information, see [README.md](README.md).
