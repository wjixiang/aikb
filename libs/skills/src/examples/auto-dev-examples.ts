/**
 * Example: Automatic Skill Development for MetaAnalysisWorkspace
 */

import { MetaAnalysisWorkspace } from 'agent-lib';
import { AutoSkillDeveloper, AutoDevRequest, HumanFeedback } from 'skills';
import { ApiClient } from 'agent-lib';

/**
 * Example 1: Fully automatic skill development
 */
async function autoDevExample1(apiClient: ApiClient) {
  console.log('=== Example 1: Fully Automatic Skill Development ===\n');

  // Create workspace
  const workspace = new MetaAnalysisWorkspace();

  // Create auto-developer
  const autoDev = new AutoSkillDeveloper(apiClient);

  // Start auto-development session
  const request: AutoDevRequest = {
    workspace,
    skillName: 'citation-network-analysis',
    description: 'Analyze citation networks and identify influential papers',
    category: 'medical-research',
    examples: [
      {
        input: {
          seed_pmids: ['12345678', '23456789'],
          depth: 2
        },
        expectedOutput: {
          network: {
            nodes: [],
            edges: []
          },
          influential_papers: []
        },
        description: 'Build citation network from seed papers'
      }
    ],
    constraints: [
      'Must handle large citation networks efficiently',
      'Should identify citation clusters',
      'Must calculate citation metrics (h-index, impact factor)'
    ],
    targetScore: 85,
    maxIterations: 5
  };

  const sessionId = await autoDev.startAutoDevSession(request);
  console.log(`Started auto-dev session: ${sessionId}`);

  // Poll for completion
  let session = autoDev.getSession(sessionId);
  while (session && session.status !== 'awaiting_feedback' && session.status !== 'completed' && session.status !== 'failed') {
    await new Promise(resolve => setTimeout(resolve, 5000));
    session = autoDev.getSession(sessionId);
    console.log(`Status: ${session?.status}, Iterations: ${session?.iterations}`);
  }

  // Generate report
  const report = await autoDev.generateReport(sessionId);
  console.log('\n' + report);

  return sessionId;
}

/**
 * Example 2: Interactive development with human feedback
 */
async function autoDevExample2(apiClient: ApiClient) {
  console.log('=== Example 2: Interactive Development with Human Feedback ===\n');

  const workspace = new MetaAnalysisWorkspace();
  const autoDev = new AutoSkillDeveloper(apiClient);

  // Start session
  const request: AutoDevRequest = {
    workspace,
    skillName: 'evidence-synthesis',
    description: 'Synthesize evidence from multiple studies using meta-analysis techniques',
    category: 'medical-research',
    targetScore: 90
  };

  const sessionId = await autoDev.startAutoDevSession(request);
  console.log(`Started session: ${sessionId}\n`);

  // Wait for initial generation
  await waitForStatus(autoDev, sessionId, 'awaiting_feedback');

  // Review and provide feedback
  let session = autoDev.getSession(sessionId);
  console.log('\n=== Initial Skill Generated ===');
  console.log(`Score: ${session?.evaluations[0]?.metrics.overallScore}/100`);
  console.log('Recommendations:', session?.evaluations[0]?.recommendations);

  // Iteration 1: Request improvements
  console.log('\n=== Iteration 1: Requesting Improvements ===');
  await autoDev.submitFeedback({
    sessionId,
    type: 'improve',
    comments: 'Add support for heterogeneity analysis and forest plot generation',
    suggestions: [
      'Include I² statistic calculation',
      'Support random-effects and fixed-effects models',
      'Generate forest plot data'
    ],
    additionalExamples: [
      {
        input: {
          studies: [
            { effect_size: 0.5, variance: 0.1, sample_size: 100 },
            { effect_size: 0.6, variance: 0.12, sample_size: 120 }
          ],
          model: 'random-effects'
        },
        expectedOutput: {
          pooled_effect: 0.55,
          heterogeneity: { i_squared: 45, p_value: 0.15 },
          forest_plot_data: []
        },
        description: 'Meta-analysis with heterogeneity assessment'
      }
    ]
  });

  await waitForStatus(autoDev, sessionId, 'awaiting_feedback');

  session = autoDev.getSession(sessionId);
  console.log(`\nImproved Score: ${session?.evaluations[session.evaluations.length - 1]?.metrics.overallScore}/100`);

  // Iteration 2: Approve or request more improvements
  const finalScore = session?.evaluations[session.evaluations.length - 1]?.metrics.overallScore || 0;

  if (finalScore >= 90) {
    console.log('\n=== Approving Skill ===');
    await autoDev.submitFeedback({
      sessionId,
      type: 'approve',
      comments: 'Skill meets requirements and quality standards'
    });
    console.log('Skill approved and saved!');
  } else {
    console.log('\n=== Requesting More Improvements ===');
    await autoDev.submitFeedback({
      sessionId,
      type: 'improve',
      comments: 'Add more comprehensive error handling and validation'
    });
  }

  // Final report
  const report = await autoDev.generateReport(sessionId);
  console.log('\n' + report);
}

/**
 * Example 3: Batch development of multiple skills
 */
async function autoDevExample3(apiClient: ApiClient) {
  console.log('=== Example 3: Batch Development ===\n');

  const workspace = new MetaAnalysisWorkspace();
  const autoDev = new AutoSkillDeveloper(apiClient);

  const skillRequests: AutoDevRequest[] = [
    {
      workspace,
      skillName: 'publication-bias-detection',
      description: 'Detect publication bias using funnel plots and statistical tests',
      category: 'medical-research',
      targetScore: 80
    },
    {
      workspace,
      skillName: 'study-quality-assessment',
      description: 'Assess study quality using standardized checklists (GRADE, Cochrane)',
      category: 'medical-research',
      targetScore: 80
    },
    {
      workspace,
      skillName: 'literature-gap-analysis',
      description: 'Identify gaps in literature and suggest future research directions',
      category: 'medical-research',
      targetScore: 75
    }
  ];

  // Start all sessions
  const sessionIds = await Promise.all(
    skillRequests.map(req => autoDev.startAutoDevSession(req))
  );

  console.log(`Started ${sessionIds.length} auto-dev sessions`);

  // Wait for all to complete
  await Promise.all(
    sessionIds.map(id => waitForStatus(autoDev, id, 'awaiting_feedback'))
  );

  // Review all skills
  console.log('\n=== Batch Results ===\n');
  for (const sessionId of sessionIds) {
    const session = autoDev.getSession(sessionId);
    const latestEval = session?.evaluations[session.evaluations.length - 1];
    console.log(`${session?.request.skillName}:`);
    console.log(`  Score: ${latestEval?.metrics.overallScore}/100`);
    console.log(`  Status: ${session?.status}`);
    console.log(`  Iterations: ${session?.iterations}\n`);
  }

  // Auto-approve skills that meet threshold
  for (const sessionId of sessionIds) {
    const session = autoDev.getSession(sessionId);
    const latestEval = session?.evaluations[session.evaluations.length - 1];
    const score = latestEval?.metrics.overallScore || 0;

    if (score >= (session?.request.targetScore || 80)) {
      await autoDev.submitFeedback({
        sessionId,
        type: 'approve',
        comments: 'Auto-approved: meets target score'
      });
      console.log(`✓ Auto-approved: ${session?.request.skillName}`);
    } else {
      console.log(`✗ Needs review: ${session?.request.skillName} (score: ${score})`);
    }
  }
}

/**
 * Example 4: Continuous improvement loop
 */
async function autoDevExample4(apiClient: ApiClient) {
  console.log('=== Example 4: Continuous Improvement Loop ===\n');

  const workspace = new MetaAnalysisWorkspace();
  const autoDev = new AutoSkillDeveloper(apiClient);

  const request: AutoDevRequest = {
    workspace,
    skillName: 'adaptive-search-strategy',
    description: 'Adaptively refine search strategies based on result quality',
    category: 'medical-research',
    targetScore: 95,
    maxIterations: 10
  };

  const sessionId = await autoDev.startAutoDevSession(request);

  // Continuous improvement loop
  let iteration = 0;
  const maxFeedbackRounds = 5;

  while (iteration < maxFeedbackRounds) {
    await waitForStatus(autoDev, sessionId, 'awaiting_feedback');

    const session = autoDev.getSession(sessionId);
    const latestEval = session?.evaluations[session.evaluations.length - 1];
    const score = latestEval?.metrics.overallScore || 0;

    console.log(`\nIteration ${iteration + 1}:`);
    console.log(`  Score: ${score}/100`);
    console.log(`  Recommendations: ${latestEval?.recommendations.length || 0}`);

    if (score >= 95) {
      console.log('  ✓ Target score reached!');
      await autoDev.submitFeedback({
        sessionId,
        type: 'approve',
        comments: 'Excellent quality achieved'
      });
      break;
    }

    // Provide targeted feedback based on weakest metrics
    const weakestMetric = findWeakestMetric(latestEval?.metrics);
    const feedback = generateTargetedFeedback(weakestMetric);

    console.log(`  → Improving: ${weakestMetric}`);

    await autoDev.submitFeedback({
      sessionId,
      type: 'improve',
      comments: feedback,
      suggestions: latestEval?.recommendations || []
    });

    iteration++;
  }

  const report = await autoDev.generateReport(sessionId);
  console.log('\n' + report);
}

// Helper functions

async function waitForStatus(
  autoDev: AutoSkillDeveloper,
  sessionId: string,
  targetStatus: string,
  timeout: number = 300000 // 5 minutes
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const session = autoDev.getSession(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === targetStatus || session.status === 'completed' || session.status === 'failed') {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Timeout waiting for status');
}

function findWeakestMetric(metrics: any): string {
  if (!metrics) return 'unknown';

  const metricScores = {
    testPassRate: metrics.testPassRate,
    codeQuality: metrics.codeQuality,
    documentation: metrics.documentation,
    maintainability: metrics.maintainability,
    efficiency: metrics.efficiency
  };

  let weakest = 'testPassRate';
  let lowestScore = 1;

  for (const [metric, score] of Object.entries(metricScores)) {
    if (score < lowestScore) {
      lowestScore = score;
      weakest = metric;
    }
  }

  return weakest;
}

function generateTargetedFeedback(metric: string): string {
  const feedbackMap: Record<string, string> = {
    testPassRate: 'Fix failing tests and improve test coverage',
    codeQuality: 'Improve code quality by adding error handling and reducing complexity',
    documentation: 'Enhance documentation with detailed descriptions and examples',
    maintainability: 'Refactor code for better maintainability and modularity',
    efficiency: 'Optimize performance and reduce resource usage'
  };

  return feedbackMap[metric] || 'General improvements needed';
}

// Export examples
export {
  autoDevExample1,
  autoDevExample2,
  autoDevExample3,
  autoDevExample4
};
