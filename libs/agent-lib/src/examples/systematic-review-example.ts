/**
 * Example: Using Systematic Literature Review Skill with MetaAnalysisWorkspace
 */

import { MetaAnalysisWorkspace } from './workspaces/metaAnalysisWorkspace';
import { Agent, AgentConfig, defaultAgentConfig } from './agent/agent';
import { SkillRegistry, SkillLoader } from '../skills/index.js';
import { ApiClient } from './api-client';

async function runSystematicReview() {
  // 1. Create workspace
  const workspace = new MetaAnalysisWorkspace();

  // 2. Load skills
  const skillRegistry = new SkillRegistry();
  const skillLoader = new SkillLoader(skillRegistry);

  // Load the systematic review skill
  await skillLoader.loadFromDirectory('./libs/skills/repository/builtin');

  // 3. Activate skill in workspace
  const skill = skillRegistry.get('systematic-literature-review');
  if (skill) {
    await workspace.activateSkill(skill);
    console.log('✓ Activated systematic-literature-review skill');
  }

  // 4. Create agent
  const apiClient = new YourApiClient(); // Your API client implementation
  const agent = new Agent(
    defaultAgentConfig,
    workspace,
    { capability: '', direction: '' }, // Will be populated from skill
    apiClient
  );

  // 5. Run systematic review
  const query = `
Conduct a systematic literature review on:
"What is the efficacy of metformin in treating type 2 diabetes in adult patients?"

Inclusion criteria:
- Type 2 diabetes mellitus
- Metformin as intervention
- Adult patients (18+ years)
- Randomized controlled trials or systematic reviews

Exclusion criteria:
- Type 1 diabetes
- Pediatric populations
- Animal studies
- In vitro studies

Please use the execute_systematic-literature-review tool to conduct the full review.
  `;

  await agent.start(query);

  // 6. Get results
  const history = agent.conversationHistory;
  console.log('Review completed!');
  console.log(JSON.stringify(history, null, 2));
}

// Alternative: Direct tool call approach
async function runSystematicReviewDirect() {
  const workspace = new MetaAnalysisWorkspace();

  // Load and activate skill
  const skillRegistry = new SkillRegistry();
  const skillLoader = new SkillLoader(skillRegistry);
  await skillLoader.loadFromDirectory('./libs/skills/repository/builtin');

  const skill = skillRegistry.get('systematic-literature-review');
  await workspace.activateSkill(skill);

  // Direct tool call
  const result = await workspace.handleToolCall(
    'execute_systematic-literature-review',
    {
      research_question: 'What is the efficacy of metformin in treating type 2 diabetes in adult patients?',
      inclusion_criteria: [
        'type 2 diabetes',
        'metformin',
        'adult patients',
        'randomized controlled trial'
      ],
      exclusion_criteria: [
        'type 1 diabetes',
        'pediatric',
        'animal study',
        'in vitro'
      ],
      filters: ['Randomized Controlled Trial', 'Systematic Review'],
      max_articles: 50
    }
  );

  console.log('Review Results:', result);

  // Access specific parts of the result
  if (result.status === 'completed') {
    console.log('\n=== Review Summary ===');
    console.log(`Research Question: ${result.summary.research_question}`);
    console.log(`\nPRISMA Flow:`);
    console.log(`- Identified: ${result.summary.prisma_flow.identified}`);
    console.log(`- Screened: ${result.summary.prisma_flow.screened}`);
    console.log(`- Included: ${result.summary.prisma_flow.included}`);
    console.log(`- Excluded: ${result.summary.prisma_flow.excluded}`);
    console.log(`- Full-text reviewed: ${result.summary.prisma_flow.full_text_reviewed}`);

    console.log(`\n=== Synthesis ===`);
    console.log(`Total studies: ${result.summary.synthesis.total_studies}`);
    console.log(`Study designs:`, result.summary.synthesis.study_designs);
    console.log(`Quality summary:`, result.summary.synthesis.quality_summary);

    console.log(`\n=== Recommendations ===`);
    result.summary.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
  }
}

// Example: Step-by-step review with individual tools
async function runStepByStepReview() {
  const workspace = new MetaAnalysisWorkspace();

  // Load skill
  const skillRegistry = new SkillRegistry();
  const skillLoader = new SkillLoader(skillRegistry);
  await skillLoader.loadFromDirectory('./libs/skills/repository/builtin');

  const skill = skillRegistry.get('systematic-literature-review');
  await workspace.activateSkill(skill);

  // Step 1: Design search strategy
  console.log('Step 1: Designing search strategy...');
  const strategy = await workspace.handleToolCall(
    'systematic-literature-review__design_search_strategy',
    {
      research_question: 'What is the efficacy of metformin in treating type 2 diabetes?',
      include_filters: ['Randomized Controlled Trial', 'Meta-Analysis'],
      date_range: { from: '2020', to: '2024' }
    }
  );

  console.log('Search Strategy:', strategy);

  // Step 2: Execute search
  console.log('\nStep 2: Executing PubMed search...');
  const searchResults = await workspace.handleToolCall('search_pubmed', {
    term: strategy.combined_query,
    filter: strategy.filters,
    sort: 'date'
  });

  console.log(`Found ${searchResults.total_results} articles`);

  // Step 3: Screen articles
  console.log('\nStep 3: Screening articles...');
  const screening = await workspace.handleToolCall(
    'systematic-literature-review__screen_articles',
    {
      articles: searchResults.results,
      inclusion_criteria: ['type 2 diabetes', 'metformin', 'efficacy'],
      exclusion_criteria: ['type 1 diabetes', 'animal study']
    }
  );

  console.log('Screening Summary:', screening.summary);

  // Step 4: Review top included articles
  console.log('\nStep 4: Reviewing included articles...');
  for (const article of screening.included.slice(0, 5)) {
    // View article details
    await workspace.handleToolCall('view_article', { pmid: article.pmid });

    // Extract data
    const extracted = await workspace.handleToolCall(
      'systematic-literature-review__extract_study_data',
      {
        article: article,
        data_fields: ['study_design', 'sample_size', 'outcomes']
      }
    );

    console.log(`\nArticle: ${extracted.title}`);
    console.log(`Study Design: ${extracted.extracted_data.study_design}`);
    console.log(`Sample Size: ${extracted.extracted_data.sample_size}`);
    console.log(`Outcomes: ${extracted.extracted_data.outcomes?.join(', ')}`);
  }
}

// Export examples
export {
  runSystematicReview,
  runSystematicReviewDirect,
  runStepByStepReview
};
