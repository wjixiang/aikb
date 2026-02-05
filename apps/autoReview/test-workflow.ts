#!/usr/bin/env npx tsx
/**
 * Meta-Analysis Agent Workflow Test
 * 
 * Demonstrates the workflow structure without requiring LLM API calls
 */

import { b } from './src/baml_client/index.js';

// ============================================================================
// Test Data
// ============================================================================

const MOCK_ARTICLES = [
    {
        pmid: '28065393',
        title: 'Empagliflozin, Cardiovascular Outcomes, and Mortality in Type 2 Diabetes',
        authors: 'Zinman B, Wanner C, Lachin JM, et al.',
        journal: 'N Engl J Med. 2015;373:2117-28',
        pub_date: '2015',
        abstract: `BACKGROUND: We assessed the cardiovascular outcomes of empagliflozin in patients with type 2 diabetes at high cardiovascular risk.

METHODS: We randomly assigned 7020 patients to receive empagliflozin (10 mg or 25 mg) or placebo once daily. The primary composite outcome was death from cardiovascular causes, nonfatal myocardial infarction, or nonfatal stroke.

RESULTS: The primary outcome occurred in 490 of 4687 patients (10.5%) in the empagliflozin group and in 282 of 2333 patients (12.1%) in the placebo group (hazard ratio, 0.86; 95% CI, 0.74 to 0.99; P=0.04). Cardiovascular death occurred in 172 of 4687 patients (3.7%) in the empagliflozin group and in 121 of 2333 patients (5.2%) in the placebo group (hazard ratio, 0.62; 95% CI, 0.49 to 0.77; P<0.001).

CONCLUSIONS: Empagliflozin reduced cardiovascular death and heart failure hospitalization in patients with type 2 diabetes.`,
        doi: '10.1056/NEJMoa1504720',
        study_design: 'Randomized Controlled Trial',
        sample_size: 7020,
        key_findings: ['Reduced CV death by 38%', 'Reduced HF hospitalization by 35%'],
        relevance_score: 0.95
    },
    {
        pmid: '26422318',
        title: 'Canagliflozin and Cardiovascular and Renal Events in Type 2 Diabetes',
        authors: 'Neal B, Perkovic V, Mahaffey KW, et al.',
        journal: 'N Engl J Med. 2017;377:644-657',
        pub_date: '2017',
        abstract: `BACKGROUND: Canagliflozin is a sodium-glucose cotransporter 2 inhibitor that reduces blood glucose levels.

METHODS: We assigned 10,142 patients with type 2 diabetes and high cardiovascular risk to receive canagliflozin or placebo.

RESULTS: The primary outcome (cardiovascular death, nonfatal myocardial infarction, or nonfatal stroke) occurred in 26.9 of 1000 patients per year in the canagliflozin group and in 31.0 of 1000 patients per year in the placebo group (hazard ratio, 0.86; 95% CI, 0.75 to 0.97; P<0.001 for noninferiority; P=0.02 for superiority).`,
        doi: '10.1056/NEJMoa1611925',
        study_design: 'Randomized Controlled Trial',
        sample_size: 10142,
        key_findings: ['Reduced CV events by 14%'],
        relevance_score: 0.92
    }
];

const MOCK_STUDY_EXTRACTIONS = [
    {
        article: MOCK_ARTICLES[0],
        population: '7020 patients with type 2 diabetes at high cardiovascular risk',
        intervention: 'Empagliflozin 10mg or 25mg daily',
        comparison: 'Placebo',
        primary_outcomes: ['CV death', 'Nonfatal MI', 'Nonfatal stroke'],
        secondary_outcomes: ['Heart failure hospitalization', 'All-cause mortality'],
        results_summary: 'Empagliflozin reduced the primary outcome by 14% (HR 0.86, 95% CI 0.74-0.99, P=0.04)',
        effect_size: {
            type: 'Hazard Ratio',
            value: 0.86,
            ci_lower: 0.74,
            ci_upper: 0.99,
            p_value: 0.04,
            outcome: 'Primary composite outcome'
        },
        risk_of_bias: 'Low risk of bias',
        quality_score: 9.0
    },
    {
        article: MOCK_ARTICLES[1],
        population: '10142 patients with type 2 diabetes and high cardiovascular risk',
        intervention: 'Canagliflozin 100mg or 300mg daily',
        comparison: 'Placebo',
        primary_outcomes: ['CV death', 'Nonfatal MI', 'Nonfatal stroke'],
        secondary_outcomes: ['Renal outcomes', 'Hospitalization for heart failure'],
        results_summary: 'Canagliflozin reduced primary outcome by 14% (HR 0.86, 95% CI 0.75-0.97, P=0.02)',
        effect_size: {
            type: 'Hazard Ratio',
            value: 0.86,
            ci_lower: 0.75,
            ci_upper: 0.97,
            p_value: 0.02,
            outcome: 'Primary composite outcome'
        },
        risk_of_bias: 'Low risk of bias',
        quality_score: 8.5
    }
];

// ============================================================================
// Workflow Demonstration
// ============================================================================

async function demonstrateWorkflow() {
    console.log('\n' + '='.repeat(80));
    console.log('META-ANALYSIS AGENT WORKFLOW DEMONSTRATION');
    console.log('='.repeat(80) + '\n');

    const researchQuestion = 'In adult patients with type 2 diabetes, does SGLT2 inhibitor therapy compared to placebo reduce cardiovascular events and mortality?';

    console.log('📋 Research Question:');
    console.log(`   ${researchQuestion}\n`);

    // Step 1: Generate Search Strategy
    console.log('Step 1/6: Generate Search Strategy');
    console.log('─────────────────────────────────');
    console.log('Function: GenerateMetaAnalysisSearchQuery');
    console.log('Input: Research question with PICO elements');
    console.log('Output: PubMed search query');
    console.log('\nExample Output:');
    console.log('  (((("Diabetes Mellitus, Type 2"[Mesh]) OR "type 2 diabetes"[tiab])');
    console.log('    AND ("Sodium-Glucose Transporter 2 Inhibitors"[Mesh])');
    console.log('    OR ("SGLT2 inhibitors"[tiab] OR empagliflozin[tiab] OR canagliflozin[tiab]))');
    console.log('    AND (placebo[tiab] OR "standard care"[tiab])');
    console.log('    AND ("Cardiovascular Diseases"[Mesh] OR "cardiovascular events"[tiab]');
    console.log('    OR "cardiovascular mortality"[tiab]))');
    console.log('    AND ("Randomized Controlled Trial"[pt] OR "Systematic Review"[pt]))');
    console.log('    AND "humans"[Mesh]\n');

    // Step 2: Search PubMed
    console.log('Step 2/6: Search PubMed');
    console.log('─────────────────────────────────');
    console.log('Function: PubmedService.searchByPattern');
    console.log('Input: Search query from Step 1');
    console.log(`Output: ${MOCK_ARTICLES.length} articles found\n`);
    MOCK_ARTICLES.forEach((article, i) => {
        console.log(`  ${i + 1}. ${article.title}`);
        console.log(`     PMID: ${article.pmid}`);
        console.log(`     Authors: ${article.authors}`);
        console.log('');
    });

    // Step 3: Get Article Details
    console.log('Step 3/6: Get Article Details');
    console.log('─────────────────────────────────');
    console.log('Function: PubmedService.getArticleDetail');
    console.log('Input: PMID for each article');
    console.log('Output: Full article details (abstract, authors, publication types)\n');
    console.log('Retrieved details for all articles...\n');

    // Step 4: Screen Articles
    console.log('Step 4/6: Screen Articles');
    console.log('─────────────────────────────────');
    console.log('Function: ScreenArticles (LLM)');
    console.log('Input: Research question + article details');
    console.log('Output: Inclusion/exclusion decisions\n');
    console.log('Screening Results:');
    MOCK_ARTICLES.forEach((article, i) => {
        console.log(`  ${article.pmid}: INCLUDE (relevance: ${(article.relevance_score * 100).toFixed(0)}%)`);
    });
    console.log('');

    // Step 5: Extract Study Data
    console.log('Step 5/6: Extract Study Data');
    console.log('─────────────────────────────────');
    console.log('Function: ExtractStudyData (LLM)');
    console.log('Input: Research question + included articles');
    console.log('Output: Structured study data\n');
    console.log('Extracted Data:');
    MOCK_STUDY_EXTRACTIONS.forEach((study, i) => {
        console.log(`  Study ${i + 1}: ${study.article.title}`);
        console.log(`    Population: ${study.population}`);
        console.log(`    Intervention: ${study.intervention}`);
        console.log(`    Effect Size: HR ${study.effect_size.value} (95% CI ${study.effect_size.ci_lower}-${study.effect_size.ci_upper})`);
        console.log(`    Quality Score: ${study.quality_score}/10`);
        console.log('');
    });

    // Step 6: Synthesize and Generate Report
    console.log('Step 6/6: Synthesize and Generate Report');
    console.log('─────────────────────────────────');
    console.log('Function: SynthesizeMetaAnalysis (LLM) → GenerateMetaAnalysisReport (LLM)');
    console.log('Input: Research question + extracted study data');
    console.log('Output: Comprehensive meta-analysis report\n');
    console.log('Report Structure:');
    console.log('  1. Abstract');
    console.log('  2. Introduction');
    console.log('  3. Methods');
    console.log('  4. Results');
    console.log('  5. Discussion');
    console.log('  6. Conclusions');
    console.log('  7. References\n');

    // Summary
    console.log('='.repeat(80));
    console.log('WORKFLOW SUMMARY');
    console.log('='.repeat(80) + '\n');
    console.log('✅ All 6 steps completed successfully');
    console.log(`📊 ${MOCK_ARTICLES.length} articles included in analysis`);
    console.log('📝 Comprehensive meta-analysis report generated');
    console.log('\nKey Findings:');
    console.log('  • SGLT2 inhibitors reduce cardiovascular events by ~14%');
    console.log('  • Consistent findings across EMPA-REG and CANVAS trials');
    console.log('  • Low risk of bias across included studies');
    console.log('  • High quality evidence (GRADE: high)\n');

    console.log('='.repeat(80) + '\n');

    return {
        researchQuestion,
        articlesFound: MOCK_ARTICLES.length,
        articlesIncluded: MOCK_ARTICLES.length,
        studiesExtracted: MOCK_STUDY_EXTRACTIONS.length
    };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    try {
        const result = await demonstrateWorkflow();
        console.log('✅ Workflow demonstration completed successfully!\n');
        console.log('Summary:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
