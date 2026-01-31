import { Agent, defaultAgentConfig, defaultApiConfig } from "./agent";
import { KmsWorkspace } from "./workspaces/KmsWorkspace";

describe(Agent, () => {
    it('should get proper prompt', async () => {
        const agent = new Agent(defaultAgentConfig, defaultApiConfig, new KmsWorkspace())
        const prompt = await agent.getSystemPrompt()
        console.log(prompt)
    })
})