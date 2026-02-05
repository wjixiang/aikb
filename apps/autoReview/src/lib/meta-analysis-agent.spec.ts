/**
 * Meta-Analysis Agent Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetaAnalysisAgent, MetaAnalysisRequest } from './meta-analysis-agent.js';

// ============================================================================
// Mock PubMed Service
// ============================================================================

class MockPubmedService {
    async searchByPattern(params: any) {
        return {
            totalResults: 2,
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
        return {
            title: 'Empagliflozin, Cardiovascular Outcomes, and Mortality in Type 2 Diabetes',
            authors: [{ name: 'Zinman B' }, { name: 'Wanner C' }],
            journalInfo: {
                title: 'N Engl J Med',
                pubDate: '2015'
            },
            abstract: 'Empagliflozin reduced cardiovascular events in type 2 diabetes patients.',
            doi: '10.1056/NEJMoa1504720',
            publicationTypes: ['Randomized Controlled Trial']
        };
    }
}

// ============================================================================
// Tests
// ============================================================================

describe('MetaAnalysisAgent', () => {
    let agent: MetaAnalysisAgent;
    let mockService: MockPubmedService;

    beforeEach(() => {
        mockService = new MockPubmedService();
        agent = new MetaAnalysisAgent(mockService);
    });

    describe('quickSearch', () => {
        it('should return articles from PubMed search', async () => {
            const request: MetaAnalysisRequest = {
                question: 'Test question',
                population: 'Adults',
                intervention: 'Drug X',
                comparison: 'Placebo',
                outcome: 'Mortality'
            };

            const articles = await agent.quickSearch(request);

            expect(articles).toBeDefined();
            expect(articles.length).toBeGreaterThan(0);
            expect(articles[0].pmid).toBeDefined();
            expect(articles[0].title).toBeDefined();
        });
    });

    describe('runMetaAnalysis', () => {
        it('should complete full workflow', async () => {
            const request: MetaAnalysisRequest = {
                question: 'In adults with type 2 diabetes, does SGLT2 inhibitor therapy reduce cardiovascular events?',
                population: 'Adults with type 2 diabetes',
                intervention: 'SGLT2 inhibitors',
                comparison: 'Placebo',
                outcome: 'Cardiovascular events',
                maxArticles: 10
            };

            const progressSteps: string[] = [];
            const report = await agent.runMetaAnalysis(request, (progress) => {
                progressSteps.push(progress.step);
            });

            // Verify all steps were executed
            expect(progressSteps).toContain('1/6');
            expect(progressSteps).toContain('2/6');
            expect(progressSteps).toContain('3/6');
            expect(progressSteps).toContain('4/6');
            expect(progressSteps).toContain('5/6');
            expect(progressSteps).toContain('6/6');

            // Verify report is generated
            expect(report).toBeDefined();
            expect(typeof report).toBe('string');
            expect(report.length).toBeGreaterThan(0);
        });

        it('should handle progress callbacks', async () => {
            const request: MetaAnalysisRequest = {
                question: 'Test question',
                population: 'Test population',
                intervention: 'Test intervention',
                comparison: 'Test comparison',
                outcome: 'Test outcome'
            };

            const messages: string[] = [];
            await agent.runMetaAnalysis(request, (progress) => {
                messages.push(progress.message);
            });

            expect(messages.length).toBeGreaterThan(0);
            expect(messages[0]).toBeDefined();
        });
    });

    describe('sample size extraction', () => {
        it('should extract sample size from abstract', () => {
            const abstract = 'We randomly assigned 7020 patients to receive empagliflozin or placebo.';
            const size = agent['extractSampleSize'](abstract);
            expect(size).toBe(7020);
        });

        it('should return null when no sample size found', () => {
            const abstract = 'This is an abstract without sample size information.';
            const size = agent['extractSampleSize'](abstract);
            expect(size).toBeNull();
        });
    });
});
