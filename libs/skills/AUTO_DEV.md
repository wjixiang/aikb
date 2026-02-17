# Automatic Skill Development

The skills system includes an **AutoSkillDeveloper** that can automatically generate, test, and optimize skills based on workspace analysis and human feedback.

## Features

- 🤖 **Automatic Generation**: Analyzes workspace and generates skills using LLM
- 🧪 **Automatic Testing**: Creates and runs test cases
- 📊 **Automatic Evaluation**: Evaluates skill quality across multiple dimensions
- 🔄 **Iterative Optimization**: Automatically improves skills based on test results
- 👤 **Human-in-the-Loop**: Incorporates human feedback for refinement
- 📝 **Session Management**: Tracks development sessions with full history

## Quick Start

### Programmatic API

```typescript
import { MetaAnalysisWorkspace } from 'agent-lib';
import { AutoSkillDeveloper } from 'skills';

// Create workspace and auto-developer
const workspace = new MetaAnalysisWorkspace();
const autoDev = new AutoSkillDeveloper(apiClient);

// Start auto-development
const sessionId = await autoDev.startAutoDevSession({
  workspace,
  skillName: 'citation-network-analysis',
  description: 'Analyze citation networks and identify influential papers',
  category: 'medical-research',
  targetScore: 85,
  maxIterations: 5
});

// Wait for completion
// ... (poll session status)

// Provide human feedback
await autoDev.submitFeedback({
  sessionId,
  type: 'improve',
  comments: 'Add support for temporal analysis',
  suggestions: ['Track citation trends over time']
});

// Approve when satisfied
await autoDev.submitFeedback({
  sessionId,
  type: 'approve'
});
```

### CLI Tool

```bash
# Start auto-development
skill-dev start \
  --workspace ./libs/agent-lib/src/workspaces/metaAnalysisWorkspace.ts \
  --name citation-network-analysis \
  --description "Analyze citation networks" \
  --category medical-research \
  --target-score 85

# Check status
skill-dev status <session-id>

# Provide feedback
skill-dev feedback <session-id> \
  --type improve \
  --comments "Add temporal analysis" \
  --suggestions '["Track citation trends"]'

# Approve skill
skill-dev feedback <session-id> --type approve

# Generate report
skill-dev report <session-id> -o report.md

# List all sessions
skill-dev list
```

## Development Workflow

### Phase 1: Initialization
1. Analyze workspace tools and capabilities
2. Design skill structure using Agent
3. Generate initial skill definition

### Phase 2: Generation
1. Use SkillBuilder to create skill from design
2. Generate tool functions and orchestration logic
3. Create helper functions

### Phase 3: Testing
1. Auto-generate test cases
2. Run tests using SkillTestRunner
3. Collect test results

### Phase 4: Evaluation
1. Evaluate skill quality (code, docs, tests, performance)
2. Calculate overall score
3. Generate recommendations

### Phase 5: Optimization
1. Apply optimization strategies automatically
2. Fix failing tests
3. Improve documentation
4. Optimize performance
5. Refactor for maintainability

### Phase 6: Human Feedback
1. Present skill to human reviewer
2. Collect feedback (approve/reject/improve)
3. If improve: iterate with feedback
4. If approve: save final version

## Auto-Development Request

```typescript
interface AutoDevRequest {
  // Required
  workspace: VirtualWorkspace;
  skillName: string;
  description: string;
  category: string;

  // Optional
  examples?: Array<{
    input: any;
    expectedOutput: any;
    description: string;
  }>;
  constraints?: string[];
  targetScore?: number;        // Default: 80
  maxIterations?: number;      // Default: 3
  outputDir?: string;          // Default: ./libs/skills/repository/generated
}
```

## Human Feedback Types

### 1. Approve
```typescript
await autoDev.submitFeedback({
  sessionId,
  type: 'approve',
  comments: 'Skill meets all requirements'
});
```

### 2. Reject
```typescript
await autoDev.submitFeedback({
  sessionId,
  type: 'reject',
  comments: 'Does not meet requirements'
});
```

### 3. Improve
```typescript
await autoDev.submitFeedback({
  sessionId,
  type: 'improve',
  comments: 'Add feature X and improve Y',
  suggestions: [
    'Add support for feature X',
    'Improve error handling in Y'
  ],
  additionalExamples: [
    {
      input: { ... },
      expectedOutput: { ... },
      description: 'Test feature X'
    }
  ]
});
```

## Session Management

### Get Session Status
```typescript
const session = autoDev.getSession(sessionId);
console.log(session.status);        // 'generating' | 'testing' | 'optimizing' | 'awaiting_feedback' | 'completed'
console.log(session.iterations);    // Number of iterations
console.log(session.evaluations);   // Evaluation history
```

### List All Sessions
```typescript
const sessions = autoDev.listSessions();
for (const session of sessions) {
  console.log(`${session.request.skillName}: ${session.status}`);
}
```

### Generate Report
```typescript
const report = await autoDev.generateReport(sessionId);
console.log(report);  // Markdown report
```

## Examples

### Example 1: Fully Automatic
```typescript
const sessionId = await autoDev.startAutoDevSession({
  workspace: new MetaAnalysisWorkspace(),
  skillName: 'evidence-synthesis',
  description: 'Synthesize evidence using meta-analysis',
  category: 'medical-research',
  targetScore: 90
});

// Wait for completion (polls automatically)
// Skill is generated, tested, and optimized automatically
```

### Example 2: Interactive with Feedback
```typescript
const sessionId = await autoDev.startAutoDevSession({ ... });

// Wait for initial generation
await waitForStatus(autoDev, sessionId, 'awaiting_feedback');

// Review and provide feedback
const session = autoDev.getSession(sessionId);
console.log('Score:', session.evaluations[0].metrics.overallScore);

// Request improvements
await autoDev.submitFeedback({
  sessionId,
  type: 'improve',
  comments: 'Add heterogeneity analysis'
});

// Wait for improvements
await waitForStatus(autoDev, sessionId, 'awaiting_feedback');

// Approve
await autoDev.submitFeedback({
  sessionId,
  type: 'approve'
});
```

### Example 3: Batch Development
```typescript
const requests = [
  { skillName: 'skill-1', ... },
  { skillName: 'skill-2', ... },
  { skillName: 'skill-3', ... }
];

const sessionIds = await Promise.all(
  requests.map(req => autoDev.startAutoDevSession(req))
);

// Wait for all to complete
await Promise.all(
  sessionIds.map(id => waitForStatus(autoDev, id, 'awaiting_feedback'))
);

// Auto-approve skills that meet threshold
for (const sessionId of sessionIds) {
  const session = autoDev.getSession(sessionId);
  const score = session.evaluations[0].metrics.overallScore;

  if (score >= 85) {
    await autoDev.submitFeedback({ sessionId, type: 'approve' });
  }
}
```

## Evaluation Metrics

Skills are evaluated across multiple dimensions:

- **Test Pass Rate** (30%): Percentage of tests passing
- **Code Quality** (20%): Error handling, complexity, best practices
- **Documentation** (15%): Completeness and clarity of documentation
- **Maintainability** (15%): Code structure and modularity
- **Efficiency** (10%): Execution time and performance
- **Resource Usage** (10%): Tool calls and resource consumption

**Overall Score**: Weighted average of all metrics (0-100)

## Optimization Strategies

The optimizer applies strategies automatically:

1. **fix-failing-tests**: Fix implementation to pass tests
2. **improve-error-handling**: Add robust error handling
3. **improve-documentation**: Enhance docs and examples
4. **optimize-performance**: Reduce execution time
5. **refactor-maintainability**: Improve code structure

## Best Practices

1. **Provide Good Examples**: Include diverse, realistic examples
2. **Set Clear Constraints**: Specify requirements and limitations
3. **Iterate with Feedback**: Use human feedback to guide improvements
4. **Set Realistic Targets**: Target score of 80-85 is usually sufficient
5. **Review Before Approval**: Always review generated skills before approval
6. **Test Thoroughly**: Ensure skills work in real scenarios

## Troubleshooting

### Session Stuck in 'generating'
- Check API client configuration
- Verify workspace is properly initialized
- Check for errors in session.error

### Low Quality Scores
- Provide more detailed examples
- Add specific constraints
- Increase maxIterations
- Provide targeted feedback

### Tests Failing
- Review test cases in evaluation
- Provide corrected examples
- Add edge case handling in constraints

## Configuration

### API Client Setup
```typescript
import { YourApiClient } from 'your-api-client';

const apiClient = new YourApiClient({
  apiKey: process.env.API_KEY,
  model: 'claude-sonnet-4.5',
  timeout: 60000
});

const autoDev = new AutoSkillDeveloper(apiClient);
```

### Custom Output Directory
```typescript
await autoDev.startAutoDevSession({
  ...request,
  outputDir: './custom/skills/directory'
});
```

## Integration with CI/CD

```yaml
# .github/workflows/auto-skill-dev.yml
name: Auto Skill Development

on:
  workflow_dispatch:
    inputs:
      skill_name:
        description: 'Skill name'
        required: true
      description:
        description: 'Skill description'
        required: true

jobs:
  develop:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: |
          skill-dev start \
            --workspace ./libs/agent-lib/src/workspaces/metaAnalysisWorkspace.ts \
            --name ${{ github.event.inputs.skill_name }} \
            --description "${{ github.event.inputs.description }}" \
            --target-score 80
```

## Future Enhancements

- [ ] Multi-agent collaboration for skill development
- [ ] Automatic test case generation from documentation
- [ ] Integration with version control for skill evolution
- [ ] Skill marketplace for sharing and discovering skills
- [ ] A/B testing framework for skill comparison
- [ ] Automatic skill composition from existing skills

---

For more information, see the [main README](../README.md).
