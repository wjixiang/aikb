import { SYSTEM_PROMPT } from '../system'

describe(SYSTEM_PROMPT, () => {
    it('should generate proper system prompt', async () => {
        const systemPrompt = await SYSTEM_PROMPT()
        // console.log(systemPrompt)
        expect(systemPrompt).include('semantic_search')
    })
})