#!/usr/bin/env npx tsx
/**
 * Real API Demo Script
 *
 * Demonstrates the meta-analysis agent with real GLM API calls and PubMed integration
 */

import { MetaAnalysisAgent, MetaAnalysisRequest } from './src/lib/meta-analysis-agent.js';
import { PubmedService } from '../../libs/medDatabasePortal/src/pubmed/pubmed.service.js';

// ============================================================================
// Configuration
// ============================================================================

function checkEnvironment() {
    const apiKey = process.env.GLM_API_KEY;

    if (!apiKey) {
        console.error('\n❌ Error: GLM_API_KEY environment variable is not set!');
        console.error('\nPlease set your GLM API key:');
        console.error('  export GLM_API_KEY=your_api_key_here\n');
        console.error('Or create a .env file with:');
        console.error('  GLM_API_KEY=your_api_key_here\n');
        process.exit(1);
    }

    // Mask the key for display
    const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
    console.log(`\n✅ GLM API Key configured: ${maskedKey}\n`);

    return apiKey;
}

// ============================================================================
// Demo Functions
// ============================================================================

async function runRealMetaAnalysis() {
    console.log('\n' + '='.repeat(80));
    console.log('REAL API META-ANALYSIS DEMO');
    console.log('Using GLM-4.7 LLM + PubMed');
    console.log('='.repeat(80) + '\n');

    // Check environment
    checkEnvironment();

    // Create agent with real PubMed service
    const agent = new MetaAnalysisAgent(new PubmedService());

    // Define research question
    const request: MetaAnalysisRequest = {
        question: 'In adult patients with type 2 diabetes, does SGLT2 inhibitor therapy compared to placebo reduce cardiovascular events and mortality?',
        context: 'SGLT2 inhibitors are a newer class of diabetes medications that have shown potential cardiovascular benefits in recent trials like EMPA-REG and CANVAS.',
        population: 'Adults (≥18 years) with type 2 diabetes mellitus',
        intervention: 'SGLT2 inhibitors (empagliflozin, canagliflozin, dapagliflozin)',
        comparison: 'Placebo or standard antidiabetic medications',
        outcome: 'Major adverse cardiovascular events (MACE), cardiovascular mortality, all-cause mortality, hospitalization for heart failure',
        maxArticles: 10  // Limit to 10 for demo
    };

    console.log('📋 Research Question:');
    console.log(`   ${request.question}\n`);

    console.log('🎯 PICO Framework:');
    console.log(`   Population:   ${request.population}`);
    console.log(`   Intervention: ${request.intervention}`);
    console.log(`   Comparison:   ${request.comparison}`);
    console.log(`   Outcome:      ${request.outcome}\n`);

    console.log('⏱️  Starting meta-analysis workflow with real APIs...\n');
    console.log('This will make real calls to:');
    console.log('  • GLM-4.7 API for LLM functions');
    console.log('  • PubMed for literature search\n');

    const startTime = Date.now();

    try {
        const report = await agent.runMetaAnalysis(request, (progress) => {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] [${progress.step}] ${progress.message}`);
            if (progress.details && Object.keys(progress.details).length > 0) {
                // Only show query details, not full objects
                if (progress.details.query) {
                    console.log(`         Query: ${progress.details.query.substring(0, 150)}...`);
                }
            }
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n' + '='.repeat(80));
        console.log('META-ANALYSIS REPORT');
        console.log('='.repeat(80) + '\n');
        console.log(report);
        console.log('\n' + '='.repeat(80));
        console.log(`✅ Meta-analysis completed in ${duration} seconds`);
        console.log('='.repeat(80) + '\n');

        // Save report to file
        const fs = await import('fs');
        const reportPath = './meta-analysis-report.txt';
        fs.writeFileSync(reportPath, report);
        console.log(`📄 Report saved to: ${reportPath}\n`);

        return report;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('\n❌ Error during meta-analysis:');
        console.error(`   ${errorMessage}\n`);

        if (errorMessage.includes('API key')) {
            console.error('💡 Tip: Make sure your GLM_API_KEY is set correctly:');
            console.error('   export GLM_API_KEY=your_actual_api_key\n');
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            console.error('💡 Tip: Check your internet connection and API endpoint\n');
        }

        throw error;
    }
}

async function runQuickSearchDemo() {
    console.log('\n' + '='.repeat(80));
    console.log('QUICK SEARCH DEMO (Real API)');
    console.log('='.repeat(80) + '\n');

    // Check environment
    checkEnvironment();

    // Create agent with real PubMed service
    const agent = new MetaAnalysisAgent(new PubmedService());

    const request: MetaAnalysisRequest = {
        question: 'In patients with hypertension, do thiazide diuretics reduce cardiovascular events compared to placebo?',
        population: 'Adults with essential hypertension',
        intervention: 'Thiazide diuretics (hydrochlorothiazide, chlorthalidone)',
        comparison: 'Placebo',
        outcome: 'Cardiovascular events, mortality',
        maxArticles: 5
    };

    console.log('📋 Research Question:');
    console.log(`   ${request.question}\n`);

    console.log('⏱️  Generating search query and searching PubMed...\n');

    try {
        const articles = await agent.quickSearch(request);

        console.log(`\n✅ Found ${articles.length} articles:\n`);

        articles.forEach((article, index) => {
            console.log(`${index + 1}. ${article.title}`);
            console.log(`   PMID: ${article.pmid}`);
            console.log(`   Authors: ${article.authors}`);
            console.log(`   Journal: ${article.journalCitation}`);
            console.log(`   DOI: ${article.doi || 'N/A'}`);
            console.log('');
        });

        console.log('='.repeat(80) + '\n');

        return articles;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('\n❌ Error during search:');
        console.error(`   ${errorMessage}\n`);
        throw error;
    }
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    console.log('\n🚀 Meta-Analysis Agent - Real API Demo');
    console.log('=======================================\n');

    switch (command) {
        case 'sglt2':
        case 'full':
            await runRealMetaAnalysis();
            break;

        case 'search':
        case 'quick':
            await runQuickSearchDemo();
            break;

        case 'help':
        default:
            console.log('Usage:');
            console.log('  npx tsx demo-real-api.ts sglt2   - Run full SGLT2 meta-analysis with real APIs');
            console.log('  npx tsx demo-real-api.ts search  - Run quick search with real APIs');
            console.log('  npx tsx demo-real-api.ts help    - Show this help message\n');
            console.log('Prerequisites:');
            console.log('  1. Set GLM_API_KEY environment variable');
            console.log('  2. Ensure internet connection for API calls\n');
            console.log('Example:');
            console.log('  export GLM_API_KEY=your_key_here');
            console.log('  npx tsx apps/autoReview/demo-real-api.ts sglt2\n');
            break;
    }
}

// Run the demo
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
