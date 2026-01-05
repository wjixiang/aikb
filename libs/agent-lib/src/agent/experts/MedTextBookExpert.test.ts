import { MedTextBookExpert } from './MedTextbookExpert'

describe(MedTextBookExpert, () => {
    it('should generate correct system prompt', async () => {
        const expert = new MedTextBookExpert()

        const prompt = await expert.getSystemPrompt()
        console.log(prompt)
        // Use start method instead of directly calling recursivelyMakeClineRequests
        await expert.start('高血压的治疗');
    }, 10000)
})