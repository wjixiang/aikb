/**
 * Meta-Analysis Agent Demo
 * 
 * Example usage of the meta-analysis agent with PubMed integration
 */

import { MetaAnalysisAgent, MetaAnalysisRequest } from './meta-analysis-agent.js';

// ============================================================================
// Mock PubMed Service for Demo
// ============================================================================

class MockPubmedService {
    async searchByPattern(params: any) {
        // Return mock data for demo purposes
        return {
            totalResults: 10,
            totalPages: 1,
            articleProfiles: [
                {
                    pmid: '28065393',
                    title: 'Empagliflozin, Cardiovascular Outcomes, and Mortality in Type 2 Diabetes',
                    authors: 'Zinman B, et al.',
                    journalCitation: 'N Engl J Med. 2015;373:2117-28',
                    snippet: 'Empagliflozin reduced cardiovascular death and heart failure hospitalization.',
                    doi: '10.1056/NEJMoa1504720'
                },
                {
                    pmid: '26422318',
                    title: 'Canagliflozin and Cardiovascular and Renal Events in Type 2 Diabetes',
                    authors: 'Neal B, et al.',
                    journalCitation: 'N Engl J Med. 2017;377:644-657',
                    snippet: 'Canagliflozin reduced cardiovascular events.',
                    doi: '10.1056/NEJMoa1611925'
                }
            ],
            html: ''
        };
    }

    async getArticleDetail(pmid: string) {
        // Return mock article details
        return {
            title: 'Empagliflozin, Cardiovascular Outcomes, and Mortality in Type 2 Diabetes',
            authors: [{ name: 'Zinman B' }, { name: 'Wanner C' }, { name: 'Lachin JM' }],
            journalInfo: {
                title: 'N Engl J Med',
                pubDate: '2015'
            },
            abstract: 'BACKGROUND: We assessed the cardiovascular outcomes of empagliflozin in patients with type 2 diabetes at high cardiovascular risk. METHODS: We randomly assigned 7020 patients to receive empagliflozin (10 mg or 25 mg) or placebo once daily. The primary composite outcome was death from cardiovascular causes, nonfatal myocardial infarction, or nonfatal stroke. RESULTS: The primary outcome occurred in 490 of 4687 patients (10.5%) in the empagliflozin group and in 282 of 2333 patients (12.1%) in the placebo group (hazard ratio, 0.86; 95% CI, 0.74 to 0.99; P=0.04 for superiority).',
            doi: '10.1056/NEJMoa1504720',
            publicationTypes: ['Randomized Controlled Trial', 'Journal Article']
        };
    }
}

// ============================================================================
// Demo Functions
// ============================================================================

/**
 * Example 1: SGLT2 Inhibitors and Cardiovascular Outcomes
 */
export async function demoSGLT2Cardiovascular() {
    const agent = new MetaAnalysisAgent(new MockPubmedService());

    const request: MetaAnalysisRequest = {
        question: 'In adult patients with type 2 diabetes, does SGLT2 inhibitor therapy compared to placebo reduce cardiovascular events and mortality?',
        context: 'SGLT2 inhibitors are a newer class of diabetes medications that have shown potential cardiovascular benefits.',
        population: 'Adults (≥18 years) with type 2 diabetes mellitus',
        intervention: 'SGLT2 inhibitors (empagliflozin, canagliflozin, dapagliflozin)',
        comparison: 'Placebo or other antidiabetic medications',
        outcome: 'Major adverse cardiovascular events (MACE), cardiovascular mortality, all-cause mortality, hospitalization for heart failure',
        maxArticles: 50
    };

    console.log('Starting meta-analysis...');
    console.log('Research Question:', request.question);

    const report = await agent.runMetaAnalysis(request, (progress) => {
        console.log(`[${progress.step}] ${progress.message}`);
    });

    console.log('\n=== META-ANALYSIS REPORT ===\n');
    console.log(report);

    return report;
}

/**
 * Example 2: Quick Search Only
 */
export async function demoQuickSearch() {
    const agent = new MetaAnalysisAgent(new MockPubmedService());

    const request: MetaAnalysisRequest = {
        question: 'In patients with hypertension, do thiazide diuretics reduce cardiovascular events compared to placebo?',
        population: 'Adults with essential hypertension',
        intervention: 'Thiazide diuretics',
        comparison: 'Placebo',
        outcome: 'Cardiovascular events, mortality',
        maxArticles: 20
    };

    console.log('Performing quick search...');
    const articles = await agent.quickSearch(request);

    console.log(`Found ${articles.length} articles:`);
    articles.forEach((article, index) => {
        console.log(`${index + 1}. ${article.title}`);
        console.log(`   PMID: ${article.pmid}`);
        console.log(`   Authors: ${article.authors}`);
        console.log(`   Journal: ${article.journalCitation}`);
        console.log('');
    });

    return articles;
}

/**
 * Example 3: Custom Research Question
 */
export async function runCustomMetaAnalysis(request: MetaAnalysisRequest) {
    const agent = new MetaAnalysisAgent(new MockPubmedService());

    console.log('Starting custom meta-analysis...');
    console.log('Research Question:', request.question);

    const report = await agent.runMetaAnalysis(request, (progress) => {
        console.log(`[${progress.step}] ${progress.message}`);
        if (progress.details) {
            console.log('  Details:', JSON.stringify(progress.details, null, 2));
        }
    });

    console.log('\n=== META-ANALYSIS REPORT ===\n');
    console.log(report);

    return report;
}

// ============================================================================
// CLI Interface (if run directly)
// ============================================================================

if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case 'sglt2':
            demoSGLT2Cardiovascular()
                .then(() => console.log('\nDone!'))
                .catch(console.error);
            break;

        case 'search':
            demoQuickSearch()
                .then(() => console.log('\nDone!'))
                .catch(console.error);
            break;

        default:
            console.log('Usage:');
            console.log('  npx tsx meta-analysis-demo.js sglt2    - Run SGLT2 cardiovascular meta-analysis');
            console.log('  npx tsx meta-analysis-demo.js search   - Run quick search demo');
    }
}
