#!/usr/bin/env npx tsx
/**
 * Literature Retrieval Demonstration
 *
 * This script demonstrates the literature retrieval functionality of the meta-analysis agent.
 * It showcases how the system:
 * 1. Generates search queries from research questions using LLM
 * 2. Searches PubMed for relevant articles
 * 3. Retrieves detailed article information
 * 4. Screens articles for relevance
 * 5. Extracts structured study data
 *
 * Usage:
 *   npx tsx demo-literature-retrieval.ts [demo]
 *
 * Demos:
 *   query    - Demonstrates query generation only
 *   search   - Demonstrates PubMed search functionality
 *   details  - Demonstrates article detail retrieval
 *   screen   - Demonstrates article screening
 *   extract  - Demonstrates data extraction
 *   full     - Demonstrates complete workflow
 */

import { MetaAnalysisAgent, MetaAnalysisRequest, ArticleProfile } from './src/lib/meta-analysis-agent.js';
import { PubmedService } from '../../libs/medDatabasePortal/src/pubmed/pubmed.service.js';

// ============================================================================
// Utility Functions
// ============================================================================

function printSection(title: string) {
    console.log('\n' + '='.repeat(80));
    console.log(`  ${title}`);
    console.log('='.repeat(80) + '\n');
}

function printSubsection(title: string) {
    console.log('\n' + '-'.repeat(60));
    console.log(`  ${title}`);
    console.log('-'.repeat(60));
}

function formatArticleSummary(article: ArticleProfile, index: number): string {
    return `
${index + 1}. ${article.title}
   PMID: ${article.pmid}
   Authors: ${article.authors}
   Journal: ${article.journalCitation}
   DOI: ${article.doi || 'N/A'}
   Snippet: ${article.snippet.substring(0, 150)}${article.snippet.length > 150 ? '...' : ''}`;
}

// ============================================================================
// Demo 1: Query Generation
// ============================================================================

async function demoQueryGeneration() {
    printSection('DEMO 1: LLM-Powered Query Generation');

    console.log('This demo shows how the LLM generates optimized PubMed search queries');
    console.log('from a research question using the PICO framework.\n');

    const request: MetaAnalysisRequest = {
        question: 'In adult patients with type 2 diabetes, does SGLT2 inhibitor therapy compared to placebo reduce cardiovascular events and mortality?',
        context: 'SGLT2 inhibitors are a newer class of diabetes medications with potential cardiovascular benefits.',
        population: 'Adults (>=18 years) with type 2 diabetes mellitus',
        intervention: 'SGLT2 inhibitors (empagliflozin, canagliflozin, dapagliflozin)',
        comparison: 'Placebo or standard antidiabetic medications',
        outcome: 'Major adverse cardiovascular events (MACE), cardiovascular mortality, all-cause mortality, hospitalization for heart failure'
    };

    console.log('[INPUT] Research Question:');
    console.log(`   ${request.question}\n`);

    console.log('[INPUT] PICO Framework:');
    console.log(`   Population:   ${request.population}`);
    console.log(`   Intervention: ${request.intervention}`);
    console.log(`   Comparison:   ${request.comparison}`);
    console.log(`   Outcome:      ${request.outcome}\n`);

    const agent = new MetaAnalysisAgent(new PubmedService());

    console.log('[PROCESS] Calling LLM to generate search query...\n');

    try {
        // Access the private method through a public interface
        // For demo purposes, we'll use quickSearch which calls generateSearchQuery internally
        const startTime = Date.now();

        // We need to call the agent's internal method - for this demo, we'll use quickSearch
        // which internally calls generateSearchQuery
        console.log('[INFO] The LLM will:');
        console.log('   1. Analyze the research question and PICO elements');
        console.log('   2. Identify relevant MeSH terms');
        console.log('   3. Generate appropriate Boolean operators');
        console.log('   4. Apply filters for study types, language, and species');
        console.log('   5. Create an optimized PubMed search string\n');

        console.log('[PROCESS] Running quick search to demonstrate query generation...\n');

        const articles = await agent.quickSearch(request);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`\n[SUCCESS] Query generated and executed in ${duration} seconds`);
        console.log(`[RESULT] Found ${articles.length} articles\n`);

        console.log('Sample articles:');
        articles.slice(0, 3).forEach((article, index) => {
            console.log(formatArticleSummary(article, index));
        });

    } catch (error) {
        console.error('[ERROR]', error instanceof Error ? error.message : String(error));
    }
}

// ============================================================================
// Demo 2: PubMed Search
// ============================================================================

async function demoPubMedSearch() {
    printSection('DEMO 2: PubMed Literature Search');

    console.log('This demo demonstrates the PubMed search functionality with various');
    console.log('search parameters and filters.\n');

    const pubmedService = new PubmedService();

    const searchExamples = [
        {
            name: 'SGLT2 Inhibitors and Cardiovascular Outcomes',
            term: 'SGLT2 inhibitors cardiovascular outcomes',
            sort: 'date' as const,
            sortOrder: 'dsc' as const,
            filter: ['pubt.randomizedcontrolledtrial', 'humans']
        },
        {
            name: 'Thiazide Diuretics and Hypertension',
            term: 'thiazide diuretics hypertension mortality',
            sort: 'match' as const,
            sortOrder: 'dsc' as const,
            filter: ['humans']
        },
        {
            name: 'COVID-19 Meta-Analyses',
            term: 'COVID-19 treatment systematic review',
            sort: 'date' as const,
            sortOrder: 'dsc' as const,
            filter: ['pubt.meta-analysis', 'pubt.systematicreview']
        }
    ];

    for (const example of searchExamples) {
        printSubsection(`Search: ${example.name}`);

        console.log(`Query: ${example.term}`);
        console.log(`Sort: ${example.sort} (${example.sortOrder})`);
        console.log(`Filters: ${example.filter.join(', ')}`);
        console.log('\n[PROCESS] Searching PubMed...\n');

        try {
            const startTime = Date.now();
            const result = await pubmedService.searchByPattern({
                term: example.term,
                sort: example.sort,
                sortOrder: example.sortOrder,
                filter: example.filter,
                page: 1
            });
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            console.log(`[SUCCESS] Search completed in ${duration} seconds`);
            console.log(`[RESULT] Results: ${result.totalResults || 'Unknown'} total articles`);
            console.log(`[RESULT] Pages: ${result.totalPages || 'Unknown'}`);
            console.log(`[RESULT] Retrieved: ${result.articleProfiles.length} articles\n`);

            console.log('Top 3 articles:');
            result.articleProfiles.slice(0, 3).forEach((article, index) => {
                console.log(formatArticleSummary(article, index));
            });
            console.log();

        } catch (error) {
            console.error('[ERROR]', error instanceof Error ? error.message : String(error));
        }
    }
}

// ============================================================================
// Demo 3: Article Detail Retrieval
// ============================================================================

async function demoArticleDetails() {
    printSection('DEMO 3: Article Detail Retrieval');

    console.log('This demo shows how to retrieve detailed information for specific articles');
    console.log('including abstract, authors, keywords, and more.\n');

    const pubmedService = new PubmedService();

    // Example PMIDs from well-known SGLT2 inhibitor trials
    const examplePMIDs = [
        '28065393', // EMPA-REG OUTCOME
        '26422318', // CANVAS Program
        '30103216'  // DECLARE-TIMI 58
    ];

    console.log(`[INFO] Retrieving details for ${examplePMIDs.length} articles...\n`);

    for (const pmid of examplePMIDs) {
        printSubsection(`PMID: ${pmid}`);

        console.log('[PROCESS] Fetching article details from PubMed...\n');

        try {
            const startTime = Date.now();
            const detail = await pubmedService.getArticleDetail(pmid);
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            console.log(`[SUCCESS] Retrieved in ${duration} seconds\n`);

            console.log('Title:');
            console.log(`  ${detail.title}\n`);

            console.log('Authors:');
            detail.authors.slice(0, 5).forEach(author => {
                console.log(`  - ${author.name}`);
            });
            if (detail.authors.length > 5) {
                console.log(`  ... and ${detail.authors.length - 5} more`);
            }
            console.log();

            console.log('Journal:');
            console.log(`  ${detail.journalInfo.title || 'N/A'}`);
            console.log(`  Published: ${detail.journalInfo.pubDate || 'N/A'}\n`);

            console.log('DOI:', detail.doi || 'N/A');
            console.log('Publication Types:', detail.publicationTypes.join(', ') || 'N/A');
            console.log();

            console.log('Abstract:');
            console.log(`  ${detail.abstract.substring(0, 300)}...\n`);

            if (detail.keywords.length > 0) {
                console.log('Keywords:');
                detail.keywords.slice(0, 10).forEach(kw => {
                    console.log(`  - ${kw.text}${kw.isMeSH ? ' (MeSH)' : ''}`);
                });
                console.log();
            }

            if (detail.meshTerms.length > 0) {
                console.log('MeSH Terms:');
                detail.meshTerms.slice(0, 5).forEach(mesh => {
                    console.log(`  - ${mesh.text}`);
                });
                console.log();
            }

        } catch (error) {
            console.error('[ERROR]', error instanceof Error ? error.message : String(error));
        }
    }
}

// ============================================================================
// Demo 4: Article Screening
// ============================================================================

async function demoArticleScreening() {
    printSection('DEMO 4: AI-Powered Article Screening');

    console.log('This demo demonstrates how the LLM screens articles for relevance');
    console.log('based on inclusion/exclusion criteria.\n');

    console.log('[INPUT] Research Question:');
    console.log('   "In adult patients with type 2 diabetes, does SGLT2 inhibitor');
    console.log('   therapy compared to placebo reduce cardiovascular events?"\n');

    console.log('[INPUT] Screening Criteria:');
    console.log('   + Population: Adults with type 2 diabetes');
    console.log('   + Intervention: SGLT2 inhibitors');
    console.log('   + Comparison: Placebo or standard care');
    console.log('   + Outcome: Cardiovascular events or mortality');
    console.log('   + Study Design: Randomized controlled trials');
    console.log('   + Language: English');
    console.log('   + Species: Humans\n');

    console.log('[INFO] The screening process evaluates each article and determines:');
    console.log('   1. Does the study population match our criteria?');
    console.log('   2. Is the intervention relevant?');
    console.log('   3. Are the outcomes measured?');
    console.log('   4. Is the study design appropriate?');
    console.log('   5. Should this article be included in the analysis?\n');

    console.log('[PROCESS] Running full meta-analysis workflow to demonstrate screening...\n');

    const agent = new MetaAnalysisAgent(new PubmedService());
    const request: MetaAnalysisRequest = {
        question: 'In adult patients with type 2 diabetes, does SGLT2 inhibitor therapy compared to placebo reduce cardiovascular events?',
        population: 'Adults (>=18 years) with type 2 diabetes mellitus',
        intervention: 'SGLT2 inhibitors',
        comparison: 'Placebo',
        outcome: 'Cardiovascular events, mortality',
        maxArticles: 5  // Small number for demo
    };

    try {
        const report = await agent.runMetaAnalysis(request, (progress) => {
            if (progress.step === '4/6') {
                console.log(`[SCREEN] [${progress.step}] ${progress.message}`);
            }
        });

        console.log('\n[SUCCESS] Screening completed');
        console.log('[INFO] See the full report above for screening results.\n');

    } catch (error) {
        console.error('[ERROR]', error instanceof Error ? error.message : String(error));
    }
}

// ============================================================================
// Demo 5: Data Extraction
// ============================================================================

async function demoDataExtraction() {
    printSection('DEMO 5: Structured Data Extraction');

    console.log('This demo shows how the LLM extracts structured data from articles,');
    console.log('including study characteristics, interventions, outcomes, and findings.\n');

    console.log('[INFO] Extracted Data Points:');
    console.log('   - Study design and methodology');
    console.log('   - Sample size and population characteristics');
    console.log('   - Intervention details (dose, duration)');
    console.log('   - Comparison group details');
    console.log('   - Primary and secondary outcomes');
    console.log('   - Effect sizes and confidence intervals');
    console.log('   - Adverse events');
    console.log('   - Study quality indicators\n');

    console.log('[PROCESS] Running full workflow to demonstrate data extraction...\n');

    const agent = new MetaAnalysisAgent(new PubmedService());
    const request: MetaAnalysisRequest = {
        question: 'In adult patients with type 2 diabetes, does SGLT2 inhibitor therapy compared to placebo reduce cardiovascular events?',
        population: 'Adults with type 2 diabetes',
        intervention: 'SGLT2 inhibitors',
        comparison: 'Placebo',
        outcome: 'Cardiovascular mortality',
        maxArticles: 3
    };

    try {
        const report = await agent.runMetaAnalysis(request, (progress) => {
            if (progress.step === '5/6') {
                console.log(`[EXTRACT] [${progress.step}] ${progress.message}`);
            }
        });

        console.log('\n[SUCCESS] Data extraction completed');
        console.log('[INFO] See the full report above for extracted data.\n');

    } catch (error) {
        console.error('[ERROR]', error instanceof Error ? error.message : String(error));
    }
}

// ============================================================================
// Demo 6: Complete Workflow
// ============================================================================

async function demoCompleteWorkflow() {
    printSection('DEMO 6: Complete Literature Retrieval Workflow');

    console.log('This demo demonstrates the complete end-to-end workflow:');
    console.log('  1. Generate search query from research question');
    console.log('  2. Search PubMed for relevant articles');
    console.log('  3. Retrieve detailed article information');
    console.log('  4. Screen articles for relevance');
    console.log('  5. Extract structured study data');
    console.log('  6. Synthesize findings and generate report\n');

    const agent = new MetaAnalysisAgent(new PubmedService());
    const request: MetaAnalysisRequest = {
        question: 'In adult patients with type 2 diabetes, does SGLT2 inhibitor therapy compared to placebo reduce cardiovascular events and mortality?',
        context: 'Focus on major cardiovascular outcome trials',
        population: 'Adults (>=18 years) with type 2 diabetes mellitus at high cardiovascular risk',
        intervention: 'SGLT2 inhibitors (empagliflozin, canagliflozin, dapagliflozin)',
        comparison: 'Placebo on top of standard care',
        outcome: 'Major adverse cardiovascular events (MACE), cardiovascular mortality, all-cause mortality, hospitalization for heart failure',
        maxArticles: 5  // Small number for demo
    };

    console.log('[INPUT] Research Question:');
    console.log(`   ${request.question}\n`);

    const startTime = Date.now();

    try {
        const report = await agent.runMetaAnalysis(request, (progress) => {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] [${progress.step}] ${progress.message}`);
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n' + '='.repeat(80));
        console.log('  FINAL REPORT');
        console.log('='.repeat(80) + '\n');
        console.log(report);
        console.log('\n' + '='.repeat(80));
        console.log(`[SUCCESS] Complete workflow finished in ${duration} seconds`);
        console.log('='.repeat(80) + '\n');

        // Save report to file
        const fs = await import('fs');
        const reportPath = './literature-retrieval-report.txt';
        fs.writeFileSync(reportPath, report);
        console.log(`[INFO] Report saved to: ${reportPath}\n`);

    } catch (error) {
        console.error('\n[ERROR] Error during workflow:');
        console.error(`   ${error instanceof Error ? error.message : String(error)}\n`);
    }
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    console.log('\n[LITERATURE RETRIEVAL DEMONSTRATION]');
    console.log('   Meta-Analysis Agent - PubMed Integration');
    console.log('='.repeat(80));

    const demos: Record<string, { description: string; fn: () => Promise<void> }> = {
        query: {
            description: 'LLM-powered query generation from research questions',
            fn: demoQueryGeneration
        },
        search: {
            description: 'PubMed search with various parameters and filters',
            fn: demoPubMedSearch
        },
        details: {
            description: 'Retrieving detailed article information',
            fn: demoArticleDetails
        },
        screen: {
            description: 'AI-powered article screening for relevance',
            fn: demoArticleScreening
        },
        extract: {
            description: 'Structured data extraction from articles',
            fn: demoDataExtraction
        },
        full: {
            description: 'Complete end-to-end literature retrieval workflow',
            fn: demoCompleteWorkflow
        }
    };

    if (!command || command === 'help') {
        console.log('\n[AVAILABLE DEMOS]\n');

        Object.entries(demos).forEach(([key, demo]) => {
            console.log(`   ${key.padEnd(10)} - ${demo.description}`);
        });

        console.log('\n[USAGE]');
        console.log('   npx tsx demo-literature-retrieval.ts <demo>\n');

        console.log('[EXAMPLES]');
        console.log('   npx tsx demo-literature-retrieval.ts query    # Query generation demo');
        console.log('   npx tsx demo-literature-retrieval.ts search   # PubMed search demo');
        console.log('   npx tsx demo-literature-retrieval.ts details  # Article details demo');
        console.log('   npx tsx demo-literature-retrieval.ts screen   # Article screening demo');
        console.log('   npx tsx demo-literature-retrieval.ts extract  # Data extraction demo');
        console.log('   npx tsx demo-literature-retrieval.ts full     # Complete workflow demo\n');

        console.log('[PREREQUISITES]');
        console.log('   - GLM_API_KEY environment variable must be set');
        console.log('   - Internet connection for API calls\n');

        return;
    }

    const demo = demos[command];

    if (!demo) {
        console.error(`\n[ERROR] Unknown demo: ${command}`);
        console.log('   Run "npx tsx demo-literature-retrieval.ts help" to see available demos\n');
        process.exit(1);
    }

    // Check for API key
    if (!process.env.GLM_API_KEY) {
        console.error('\n[ERROR] GLM_API_KEY environment variable is not set!');
        console.error('\nPlease set your GLM API key:');
        console.error('  export GLM_API_KEY=your_api_key_here\n');
        console.error('Or create a .env file with:');
        console.error('  GLM_API_KEY=your_api_key_here\n');
        process.exit(1);
    }

    try {
        await demo.fn();
        console.log('[SUCCESS] Demo completed successfully!\n');
    } catch (error) {
        console.error('\n[ERROR] Demo failed:');
        console.error(`   ${error instanceof Error ? error.message : String(error)}\n`);
        process.exit(1);
    }
}

// Run the demo
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
