import { MedTextBookExpert } from './MedTextbookExpert'

describe(MedTextBookExpert, () => {
    it('should generate correct system prompt', async () => {
        const expert = new MedTextBookExpert()

        const prompt = await expert.getSystemPrompt()
        console.log(prompt)
    })
})