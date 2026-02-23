import { ApiClient, ApiResponse, ApiTimeoutConfig, ChatCompletionTool } from '../../api-client'
import { ThinkingModule } from '../ThinkingModule'
import { ITurnMemoryStore } from '../../memory/TurnMemoryStore.interface'
import { Turn, TurnStatus, ThinkingRound, ToolCallResult, TurnMemoryExport } from '../../memory/Turn'
import { ApiMessage } from '../../task/task.type'
import { vi } from 'vitest'
import pino from 'pino'

describe('ThinkingModule', () => {
    const mockedApiClient: ApiClient = {
        makeRequest: vi.fn()
    }

    const mockedLogger = pino({ level: 'info' })

    const mockedConfig = {}

    const mockedTurnMemoryStore: ITurnMemoryStore = {
        createTurn: vi.fn(),
        updateTurnStatus: vi.fn(),
        addMessageToTurn: vi.fn(),
        storeThinkingPhase: vi.fn(),
        addToolCallResult: vi.fn(),
        storeSummary: vi.fn(),
        updateActionTokens: vi.fn(),
        getTurn: vi.fn(),
        getTurnByNumber: vi.fn(),
        getAllTurns: vi.fn(() => []),
        getRecentTurns: vi.fn(() => []),
        getAllMessages: vi.fn(() => []),
        getRecentMessages: vi.fn(() => []),
        searchTurns: vi.fn(() => []),
        getCurrentTurnNumber: vi.fn(() => 0),
        getAllSummaries: vi.fn(() => []),
        export: vi.fn(() => ({ turns: [], currentTurnNumber: 0 })),
        import: vi.fn(),
        clear: vi.fn()
    }

    let thinkingModule: ThinkingModule

    beforeEach(() => {
        thinkingModule = new ThinkingModule(
            mockedApiClient,
            mockedLogger,
            mockedConfig,
            mockedTurnMemoryStore
        )
    })

    it('should perform single thinking round', async () => {
        const mockedResponse: ApiResponse = {
            toolCalls: [{
                id: 'test_id',
                call_id: 'test_call_id',
                type: 'function_call',
                name: 'test_function',
                arguments: '{"param": "value"}'
            }],
            textResponse: 'Test response text',
            requestTime: 100,
            tokenUsage: {
                promptTokens: 10,
                completionTokens: 20,
                totalTokens: 30
            }
        }

        // Mock the makeRequest to return the mockedResponse
        vi.mocked(mockedApiClient.makeRequest).mockResolvedValue(mockedResponse)

        const thinkingResult = await thinkingModule.performThinkingPhase('workspace context')
        console.log(thinkingResult)
    })
})