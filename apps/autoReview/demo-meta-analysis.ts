#!/usr/bin/env npx tsx
/**
 * Meta-Analysis Agent Demo Script
 * 
 * Demonstrates the automated literature retrieval and meta-analysis workflow
 */

import { MetaAnalysisAgent, MetaAnalysisRequest } from './src/lib/meta-analysis-agent.js';

// ============================================================================
// Mock PubMed Service for Demo
// ============================================================================

class MockPubmedService {
    async searchByPattern(params: any) {
        console.log('📚 Searching PubMed with query:', params.term.substring(0, 100) + '...');

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            totalResults: 2,
            totalPages: 1,
            articleProfiles: [
                {
                    pmid: '28065393',
                    title: 'Empagliflozin, Cardiovascular Outcomes, and Mortality in Type 2 Diabetes',
                    authors: 'Zinman B, Wanner C, Lachin JM, et al.',
                    journalCitation: 'N Engl J Med. 2015;373:2117-28',
                    snippet: 'Empagliflozin reduced cardiovascular death by 38% and heart failure hospitalization by 35% in patients with type 2 diabetes at high cardiovascular risk.',
                    doi: '10.1056/NEJMoa1504720'
                },
                {
                    pmid: '26422318',
                    title: 'Canagliflozin and Cardiovascular and Renal Events in Type 2 Diabetes',
                    authors: 'Neal B, Perkovic V, Mahaffey KW, et al.',
                    journalCitation: 'N Engl J Med. 2017;377:644-657',
                    snippet: 'Canagliflozin reduced the risk of cardiovascular events by 14% compared with placebo.',
                    doi: '10.1056/NEJMoa1611925'
                }
            ],
            html: ''
        };
    }

    async getArticleDetail(pmid: string) {
        console.log(`📄 Fetching details for PMID: ${pmid}...`);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300));

        return {
            title: 'Empagliflozin, Cardiovascular Outcomes, and Mortality in Type 2 Diabetes',
            authors: [
                { name: 'Zinman B' },
                { name: 'Wanner C' },
                { name: 'Lachin JM' },
                { name: 'Fitchett D' },
                { name: 'Bluhmki E' },
                { name: 'Hantel S' },
                { name: 'Mattheus M' },
                { name: 'Devins T' },
                { name: 'Johansen OE' },
                { name: 'Woerle HJ' },
                { name: 'Broedl UC' },
                { name: 'Inzucchi SE' }
            ],
            journalInfo: {
                title: 'New England Journal of Medicine',
                pubDate: '2015 Sep 17'
            },
            abstract: `BACKGROUND: We assessed the cardiovascular outcomes of empagliflozin in patients with type 2 diabetes at high cardiovascular risk.

METHODS: We randomly assigned 7020 patients to receive empagliflozin (10 mg or 25 mg) or placebo once daily. The primary composite outcome was death from cardiovascular causes, nonfatal myocardial infarction, or nonfatal stroke. The key secondary outcome was death from cardiovascular causes, nonfatal myocardial infarction, nonfatal stroke, or hospitalization for unstable angina.

RESULTS: The primary outcome occurred in 490 of 4687 patients (10.5%) in the empagliflozin group and in 282 of 2333 patients (12.1%) in the placebo group (hazard ratio, 0.86; 95% CI, 0.74 to 0.99; P=0.04 for superiority). Cardiovascular death occurred in 172 of 4687 patients (3.7%) in the empagliflozin group and in 121 of 2333 patients (5.2%) in the placebo group (hazard ratio, 0.62; 95% CI, 0.49 to 0.77; P<0.001).

CONCLUSIONS: Patients with type 2 diabetes at high cardiovascular risk who received empagliflozin had a lower rate of the primary composite outcome and of death from cardiovascular causes than those in the placebo group.`,
            doi: '10.1056/NEJMoa1504720',
            publicationTypes: ['Randomized Controlled Trial', 'Journal Article']
        };
    }
}

// ============================================================================
// Demo Functions
// ============================================================================

async function runSGLT2Demo() {
    console.log('\n' + '='.repeat(80));
    console.log('META-ANALYSIS AGENT DEMO');
    console.log('SGLT2 Inhibitors and Cardiovascular Outcomes in Type 2 Diabetes');
    console.log('='.repeat(80) + '\n');

    const agent = new MetaAnalysisAgent(new MockPubmedService());

    const request: MetaAnalysisRequest = {
        question: 'In adult patients with type 2 diabetes, does SGLT2 inhibitor therapy compared to placebo reduce cardiovascular events and mortality?',
        context: 'SGLT2 inhibitors are a newer class of diabetes medications that have shown potential cardiovascular benefits in recent trials.',
        population: 'Adults (≥18 years) with type 2 diabetes mellitus',
        intervention: 'SGLT2 inhibitors (empagliflozin, canagliflozin, dapagliflozin)',
        comparison: 'Placebo or standard antidiabetic medications',
        outcome: 'Major adverse cardiovascular events (MACE), cardiovascular mortality, all-cause mortality, hospitalization for heart failure',
        maxArticles: 50
    };

    console.log('📋 Research Question:');
    console.log(`   ${request.question}\n`);

    console.log('🎯 PICO Framework:');
    console.log(`   Population:   ${request.population}`);
    console.log(`   Intervention: ${request.intervention}`);
    console.log(`   Comparison:   ${request.comparison}`);
    console.log(`   Outcome:      ${request.outcome}\n`);

    console.log('⏱️  Starting meta-analysis workflow...\n');

    const startTime = Date.now();

    try {
        const report = await agent.runMetaAnalysis(request, (progress) => {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] [${progress.step}] ${progress.message}`);
            if (progress.details) {
                console.log(`         Details: ${JSON.stringify(progress.details, null, 2)}`);
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

        return report;
    } catch (error) {
        console.error('\n❌ Error during meta-analysis:', error);
        throw error;
    }
}

async function runQuickSearchDemo() {
    console.log('\n' + '='.repeat(80));
    console.log('QUICK SEARCH DEMO');
    console.log('='.repeat(80) + '\n');

    const agent = new MetaAnalysisAgent(new MockPubmedService());

    const request: MetaAnalysisRequest = {
        question: 'In patients with hypertension, do thiazide diuretics reduce cardiovascular events compared to placebo?',
        population: 'Adults with essential hypertension',
        intervention: 'Thiazide diuretics (hydrochlorothiazide, chlorthalidone)',
        comparison: 'Placebo',
        outcome: 'Cardiovascular events, mortality',
        maxArticles: 20
    };

    console.log('📋 Research Question:');
    console.log(`   ${request.question}\n`);

    console.log('⏱️  Performing quick search...\n');

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
        console.error('\n❌ Error during search:', error);
        throw error;
    }
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    console.log('\n🚀 Meta-Analysis Agent Demo Script');
    console.log('====================================\n');

    switch (command) {
        case 'sglt2':
        case 'full':
            await runSGLT2Demo();
            break;

        case 'search':
        case 'quick':
            await runQuickSearchDemo();
            break;

        case 'help':
        default:
            console.log('Usage:');
            console.log('  npx tsx demo-meta-analysis.ts sglt2   - Run full SGLT2 meta-analysis demo');
            console.log('  npx tsx demo-meta-analysis.ts search  - Run quick search demo');
            console.log('  npx tsx demo-meta-analysis.ts help    - Show this help message\n');
            console.log('Examples:');
            console.log('  npx tsx apps/autoReview/demo-meta-analysis.ts sglt2');
            console.log('  npx tsx apps/autoReview/demo-meta-analysis.ts search\n');
            break;
    }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { runSGLT2Demo, runQuickSearchDemo };
