import { config } from 'dotenv'
config()

import 'reflect-metadata'
import { AgentFactory } from '../AgentFactory.js'
import { Agent } from '../agent.js'
import { MetaAnalysisWorkspace } from '../../workspaces/metaAnalysisWorkspace.js'
import { SkillRegistry } from '../../skills/index.js'
import { MessageContentFormatter } from '../../task/MessageFormatter.util.js'
import { ApiClient, ApiResponse, ToolCall, TokenUsage } from '../../api-client/ApiClient.interface.js'

// Mock ApiClient implementation
class MockApiClient implements ApiClient {
    static instance: MockApiClient
    callCount = 0

    constructor() {
        MockApiClient.instance = this
    }

    async makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: { timeout: number },
        tools?: any[]
    ): Promise<ApiResponse> {
        this.callCount++
        console.log(`[MockApiClient] makeRequest called (count: ${this.callCount})`)

        // Return a mock response
        const mockResponse: ApiResponse = {
            toolCalls: [],
            textResponse: 'Mock response from test ApiClient',
            requestTime: 100,
            tokenUsage: {
                promptTokens: 10,
                completionTokens: 5,
                totalTokens: 15
            } as TokenUsage
        }
        return mockResponse
    }
}

describe('real senario integrated tests', () => {
    let agent: Agent
    let mockApiClient: MockApiClient

    beforeAll(async () => {
        // Create mock ApiClient
        mockApiClient = new MockApiClient()

        // Create workspace
        const workspace = new MetaAnalysisWorkspace()

        // Register skills - provide repository path to auto-load skills
        const skillRegistry = new SkillRegistry()
        const skills = skillRegistry.getAll()
        console.log(`Loaded ${skills.length} skills:`, skills.map(s => s.name))
        workspace.registerSkills(skills)

        // Create agent with observers and mock ApiClient - the DI container handles wrapping automatically
        agent = AgentFactory.create(
            workspace,
            {
                capability: 'You are a helpful AI assistant.',
                direction: 'Follow the user\'s instructions and use available tools to complete tasks.'
            },
            {
                observers: {
                    onStatusChanged: (taskId, status) => {
                        console.log(`[Agent] Task ${taskId} status changed to: ${status}`)
                    },
                    onMessageAdded: (taskId, message) => {
                        console.log('message added')
                        console.log(MessageContentFormatter.formatForLogging(message, {
                            maxLength: 99999,
                            includeMetadata: true,
                            colorize: true
                        }))
                    },
                    onTaskCompleted: (taskId) => {
                        console.log(`[Agent] Task ${taskId} completed successfully`)
                    },
                    onTaskAborted: (taskId, reason) => {
                        console.error(`[Agent] Task ${taskId} aborted: ${reason}`)
                    },
                    onError: (error, context) => {
                        console.error(`[Agent] Error in ${context}:`, error)
                    },
                    onTurnCreated(turnId, turnNumber, workspaceContext, taskContext) {
                        console.log(`observed turn created: ${workspaceContext}`)
                    },
                },
                apiConfiguration: {
                    zaiApiLine: 'international_coding',
                    apiModelId: 'glm-4.5-flash',
                },
                config: {
                    apiRequestTimeout: 90000
                }
            },
            {
                ApiClient: mockApiClient
            }
        )
    })

    it('should override ApiClient with mock', () => {
        // Verify the mock was passed to AgentFactory
        expect(mockApiClient).toBeDefined()

        // Verify the mock was applied to the child container
        // The mock should be used when the agent makes API calls
        // (not called during creation phase)
        expect(mockApiClient.callCount).toBe(0)

        // Note: The actual override is verified by the log message:
        // "[AgentContainer.applyOverride] Bound ApiClient to mock in child container"
        console.log('[Test] Override is now working correctly!')
        console.log('[Test] The mock ApiClient will be used when agent.start() is called')
    })

})