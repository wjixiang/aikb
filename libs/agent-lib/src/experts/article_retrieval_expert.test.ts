import { ArticleRetrievalExpert } from './article_retrieval_expert.js'
import { config } from 'dotenv'
config()

describe("ArticleRetrievalExpert", () => {
    it('integrated test', async () => {
        console.log('=== TEST STARTED ===');
        console.log('Timestamp:', new Date().toISOString());

        const query = 'Retrieval articles: n adult patients with type 2 diabetes mellitus, do SGLT2 inhibitors compared to placebo or standard care reduce the incidence of major adverse cardiovascular events and hospitalization for heart failure?';

        console.log('Query:', query);
        console.log('Starting ArticleRetrievalExpert...');

        try {
            console.log('Calling ArticleRetrievalExpert.start()...');
            const result = await ArticleRetrievalExpert.start(query);
            console.log('Start method returned, result:', result);
            console.log('Agent status after start:', result.status);
            console.log('Agent task ID:', result.getTaskId);
            console.log('Conversation history length:', result.conversationHistory.length);
            console.log('Token usage:', result.tokenUsage);
            console.log('Tool usage:', result.toolUsage);
            console.log('Consecutive mistake count:', result.consecutiveMistakeCount);
            console.log('Collected errors:', result.getCollectedErrors());
        } catch (error) {
            console.error('ERROR during test execution:', error);
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            throw error;
        }

        console.log('=== TEST COMPLETED ===');

    }, 99999)

})