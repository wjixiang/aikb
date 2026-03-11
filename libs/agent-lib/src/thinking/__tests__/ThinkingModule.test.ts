import { ApiClient, ApiResponse, ApiTimeoutConfig, ChatCompletionTool } from '../../api-client'
import { ThinkingModule, MissingToolCallError } from '../ThinkingModule'
import { ITurnMemoryStore } from '../../memory/TurnMemoryStore.interface'
import { Turn, TurnStatus, ThinkingRound, ToolCallResult, TurnMemoryExport } from '../../memory/Turn'
import { ApiMessage } from '../../task/task.type'
import { vi } from 'vitest'
import pino from 'pino'
import { RecallRequest } from '../types'

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
        // Clear all mock calls before each test
        vi.clearAllMocks()

        thinkingModule = new ThinkingModule(
            mockedApiClient,
            mockedLogger,
            mockedConfig,
            mockedTurnMemoryStore
        )
    })

    it('should store thinking message of each step correctly', async () => {
        const mockedResponse: ApiResponse = {
            toolCalls: [{
                id: 'continue_id',
                call_id: 'continue_call_id',
                type: 'function_call',
                name: 'continue_thinking',
                arguments: JSON.stringify({
                    continueThinking: true,
                    totalThoughts: 2,
                })
            }],
            textResponse: 'Test response text',
            requestTime: 100,
            tokenUsage: {
                promptTokens: 10,
                completionTokens: 20,
                totalTokens: 30
            }
        }

        const mockedResponse2: ApiResponse = {
            toolCalls: [{
                id: 'continue_id',
                call_id: 'continue_call_id',
                type: 'function_call',
                name: 'continue_thinking',
                arguments: JSON.stringify({
                    continueThinking: false,
                    totalThoughts: 1,
                    summary: 'Test summary'
                })
            }],
            textResponse: 'Test response text 2',
            requestTime: 100,
            tokenUsage: {
                promptTokens: 10,
                completionTokens: 20,
                totalTokens: 30
            }
        }

        // Mock the makeRequest to return the mockedResponse
        vi.mocked(mockedApiClient.makeRequest)
            .mockResolvedValueOnce(mockedResponse)
            .mockResolvedValueOnce(mockedResponse2)

        const spy = vi.spyOn(mockedApiClient, 'makeRequest')

        const thinkingResult = await thinkingModule.performThinkingPhase('workspace context')
        console.log(thinkingResult)

        // Verify that thinking messages are stored correctly in each round
        expect(thinkingResult.rounds.length).toBe(2)
        expect(thinkingResult.rounds[0].content).toBe('Test response text')
        expect(thinkingResult.rounds[1].content).toBe('Test response text 2')
        expect(thinkingResult.rounds[0].continueThinking).toBe(true)
        expect(thinkingResult.rounds[1].continueThinking).toBe(false)
        expect(thinkingResult.rounds[1].summary).toBe('Test summary')
        expect(thinkingResult.summary).toBe('Test summary')
    })

    describe('handleRecall', () => {
        it('should recall turns by turn numbers', async () => {
            // Mock turns to be returned
            const mockTurn1: Turn = {
                id: 'turn-1',
                turnNumber: 1,
                timestamp: Date.now(),
                status: TurnStatus.COMPLETED,
                messages: [],
                workspaceContext: 'context 1',
                toolCalls: [],
                tokenUsage: { thinking: 10, action: 20, total: 30 }
            }
            const mockTurn2: Turn = {
                id: 'turn-2',
                turnNumber: 2,
                timestamp: Date.now(),
                status: TurnStatus.COMPLETED,
                messages: [],
                workspaceContext: 'context 2',
                toolCalls: [],
                tokenUsage: { thinking: 10, action: 20, total: 30 }
            }

            // Mock getTurnByNumber to return turns
            vi.mocked(mockedTurnMemoryStore.getTurnByNumber)
                .mockReturnValueOnce(mockTurn1)
                .mockReturnValueOnce(mockTurn2)

            // Create API response with recall_context tool call
            const recallRequest: RecallRequest = {
                turnNumbers: [1, 2]
            }
            const mockedResponse: ApiResponse = {
                toolCalls: [{
                    id: 'recall_id',
                    call_id: 'recall_call_id',
                    type: 'function_call',
                    name: 'recall_context',
                    arguments: JSON.stringify(recallRequest)
                }, {
                    id: 'continue_id',
                    call_id: 'continue_call_id',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: false,
                        totalThoughts: 1,
                        summary: 'Test summary'
                    })
                }],
                textResponse: 'Recalling previous turns',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            vi.mocked(mockedApiClient.makeRequest).mockResolvedValue(mockedResponse)
            const spy = vi.spyOn(mockedApiClient, 'makeRequest')

            // Perform thinking phase which will trigger handleRecall
            const thinkingResult = await thinkingModule.performThinkingPhase('workspace context')
            console.log(spy.mock.calls[1])

            // Verify that the recalled contexts are included in the thinking rounds
            expect(thinkingResult.rounds.length).toBeGreaterThan(0)
            const firstRound = thinkingResult.rounds[0]
            expect(firstRound.recalledContexts).toEqual([mockTurn1, mockTurn2])
            expect(vi.mocked(mockedTurnMemoryStore.getTurnByNumber)).toHaveBeenCalledWith(1)
            expect(vi.mocked(mockedTurnMemoryStore.getTurnByNumber)).toHaveBeenCalledWith(2)
        })

        it('should recall turns by keywords', async () => {
            // Mock turns to be returned from search
            const mockTurn1: Turn = {
                id: 'turn-1',
                turnNumber: 1,
                timestamp: Date.now(),
                status: TurnStatus.COMPLETED,
                messages: [],
                workspaceContext: 'search result 1',
                toolCalls: [],
                tokenUsage: { thinking: 10, action: 20, total: 30 }
            }
            const mockTurn2: Turn = {
                id: 'turn-2',
                turnNumber: 2,
                timestamp: Date.now(),
                status: TurnStatus.COMPLETED,
                messages: [],
                workspaceContext: 'search result 2',
                toolCalls: [],
                tokenUsage: { thinking: 10, action: 20, total: 30 }
            }

            // Mock searchTurns to return turns
            vi.mocked(mockedTurnMemoryStore.searchTurns)
                .mockReturnValueOnce([mockTurn1])
                .mockReturnValueOnce([mockTurn2])

            // Create API response with recall_context tool call using keywords
            const recallRequest: RecallRequest = {
                keywords: ['diabetes', 'treatment']
            }
            const mockedResponse: ApiResponse = {
                toolCalls: [{
                    id: 'recall_id',
                    call_id: 'recall_call_id',
                    type: 'function_call',
                    name: 'recall_context',
                    arguments: JSON.stringify(recallRequest)
                }, {
                    id: 'continue_id',
                    call_id: 'continue_call_id',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: false,
                        totalThoughts: 1,
                        summary: 'Test summary'
                    })
                }],
                textResponse: 'Searching for relevant turns',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            vi.mocked(mockedApiClient.makeRequest).mockResolvedValue(mockedResponse)

            // Perform thinking phase which will trigger handleRecall
            const thinkingResult = await thinkingModule.performThinkingPhase('workspace context')

            // Verify that the recalled contexts are included in the thinking rounds
            expect(thinkingResult.rounds.length).toBeGreaterThan(0)
            const firstRound = thinkingResult.rounds[0]
            expect(firstRound.recalledContexts).toEqual([mockTurn1, mockTurn2])
            expect(vi.mocked(mockedTurnMemoryStore.searchTurns)).toHaveBeenCalledWith('diabetes')
            expect(vi.mocked(mockedTurnMemoryStore.searchTurns)).toHaveBeenCalledWith('treatment')
        })

        it('should handle empty recall request gracefully', async () => {
            // Create API response with empty recall_context tool call
            const recallRequest: RecallRequest = {}
            const mockedResponse: ApiResponse = {
                toolCalls: [{
                    id: 'recall_id',
                    call_id: 'recall_call_id',
                    type: 'function_call',
                    name: 'recall_context',
                    arguments: JSON.stringify(recallRequest)
                }, {
                    id: 'continue_id',
                    call_id: 'continue_call_id',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: false,
                        totalThoughts: 1,
                        summary: 'Test summary'
                    })
                }],
                textResponse: 'Empty recall request',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            vi.mocked(mockedApiClient.makeRequest).mockResolvedValue(mockedResponse)

            // Perform thinking phase which will trigger handleRecall
            const thinkingResult = await thinkingModule.performThinkingPhase('workspace context')

            // Verify that no contexts are recalled
            expect(thinkingResult.rounds.length).toBeGreaterThan(0)
            const firstRound = thinkingResult.rounds[0]
            expect(firstRound.recalledContexts).toEqual([])
        })

        it('should handle missing turns gracefully', async () => {
            // Mock getTurnByNumber to return undefined (turn not found)
            vi.mocked(mockedTurnMemoryStore.getTurnByNumber).mockReturnValue(undefined)

            // Create API response with recall_context tool call for non-existent turns
            const recallRequest: RecallRequest = {
                turnNumbers: [999, 1000]
            }
            const mockedResponse: ApiResponse = {
                toolCalls: [{
                    id: 'recall_id',
                    call_id: 'recall_call_id',
                    type: 'function_call',
                    name: 'recall_context',
                    arguments: JSON.stringify(recallRequest)
                }, {
                    id: 'continue_id',
                    call_id: 'continue_call_id',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: false,
                        totalThoughts: 1,
                        summary: 'Test summary'
                    })
                }],
                textResponse: 'Recalling non-existent turns',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            vi.mocked(mockedApiClient.makeRequest).mockResolvedValue(mockedResponse)

            // Perform thinking phase which will trigger handleRecall
            const thinkingResult = await thinkingModule.performThinkingPhase('workspace context')

            // Verify that no contexts are recalled when turns are not found
            expect(thinkingResult.rounds.length).toBeGreaterThan(0)
            const firstRound = thinkingResult.rounds[0]
            expect(firstRound.recalledContexts).toEqual([])
            expect(vi.mocked(mockedTurnMemoryStore.getTurnByNumber)).toHaveBeenCalledWith(999)
            expect(vi.mocked(mockedTurnMemoryStore.getTurnByNumber)).toHaveBeenCalledWith(1000)
        })

        it('should deduplicate recalled turns when both turnNumbers and keywords are provided', async () => {
            // Mock turns to be returned
            const mockTurn1: Turn = {
                id: 'turn-1',
                turnNumber: 1,
                timestamp: Date.now(),
                status: TurnStatus.COMPLETED,
                messages: [],
                workspaceContext: 'meta-analysis on mesenchymal stem cells',
                toolCalls: [],
                tokenUsage: { thinking: 10, action: 20, total: 30 }
            }
            const mockTurn2: Turn = {
                id: 'turn-2',
                turnNumber: 2,
                timestamp: Date.now(),
                status: TurnStatus.COMPLETED,
                messages: [],
                workspaceContext: 'knee osteoarthritis PICO extraction',
                toolCalls: [],
                tokenUsage: { thinking: 10, action: 20, total: 30 }
            }
            const mockTurn3: Turn = {
                id: 'turn-3',
                turnNumber: 3,
                timestamp: Date.now(),
                status: TurnStatus.COMPLETED,
                messages: [],
                workspaceContext: 'PRISMA checklist analysis',
                toolCalls: [],
                tokenUsage: { thinking: 10, action: 20, total: 30 }
            }
            const mockTurn4: Turn = {
                id: 'turn-4',
                turnNumber: 4,
                timestamp: Date.now(),
                status: TurnStatus.COMPLETED,
                messages: [],
                workspaceContext: 'PRISMA flow diagram',
                toolCalls: [],
                tokenUsage: { thinking: 10, action: 20, total: 30 }
            }

            // Mock getTurnByNumber to return turns 1-4
            vi.mocked(mockedTurnMemoryStore.getTurnByNumber)
                .mockReturnValueOnce(mockTurn1)  // turn 1
                .mockReturnValueOnce(mockTurn2)  // turn 2
                .mockReturnValueOnce(mockTurn3)  // turn 3
                .mockReturnValueOnce(mockTurn4)  // turn 4

            // Mock searchTurns to return the same turns (simulating keyword matches)
            // This simulates the bug where the same turns are found by both turnNumbers and keywords
            vi.mocked(mockedTurnMemoryStore.searchTurns)
                .mockReturnValueOnce([mockTurn1, mockTurn2, mockTurn3, mockTurn4])  // "meta-analysis"
                .mockReturnValueOnce([mockTurn1, mockTurn2])  // "mesenchymal stem cells"
                .mockReturnValueOnce([mockTurn2, mockTurn3])  // "knee osteoarthritis"
                .mockReturnValueOnce([mockTurn2])  // "PICO extraction"
                .mockReturnValueOnce([mockTurn3, mockTurn4])  // "PRISMA"

            // Create API response with recall_context tool call using BOTH turnNumbers and keywords
            const recallRequest: RecallRequest = {
                turnNumbers: [1, 2, 3, 4],
                keywords: ['meta-analysis', 'mesenchymal stem cells', 'knee osteoarthritis', 'PICO extraction', 'PRISMA']
            }
            const mockedResponse: ApiResponse = {
                toolCalls: [{
                    id: 'recall_id',
                    call_id: 'recall_call_id',
                    type: 'function_call',
                    name: 'recall_context',
                    arguments: JSON.stringify(recallRequest)
                }, {
                    id: 'continue_id',
                    call_id: 'continue_call_id',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: false,
                        totalThoughts: 1,
                        summary: 'Test summary'
                    })
                }],
                textResponse: 'Recalling previous turns with both turnNumbers and keywords',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            vi.mocked(mockedApiClient.makeRequest).mockResolvedValue(mockedResponse)

            // Perform thinking phase which will trigger handleRecall
            const thinkingResult = await thinkingModule.performThinkingPhase('workspace context')

            // Verify that the recalled contexts are deduplicated
            expect(thinkingResult.rounds.length).toBeGreaterThan(0)
            const firstRound = thinkingResult.rounds[0]

            // Should only have 4 unique turns, not duplicates
            expect(firstRound.recalledContexts.length).toBe(4)

            // Verify the turns are unique by checking their IDs
            const turnIds = firstRound.recalledContexts.map(t => t.id)
            expect(turnIds).toEqual(['turn-1', 'turn-2', 'turn-3', 'turn-4'])

            // Verify no duplicates exist
            const uniqueIds = new Set(turnIds)
            expect(uniqueIds.size).toBe(4)
        })
    })

    describe('exit thinking phase via tool call', () => {
        it('should exit thinking phase when continueThinking is false via tool call', async () => {
            // Mock API response with continue_thinking tool call that has continueThinking: false
            const mockedResponse: ApiResponse = {
                toolCalls: [{
                    id: 'continue_id',
                    call_id: 'continue_call_id',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: false,
                        totalThoughts: 1,
                        summary: 'Analysis completed. The user wants to search for literature on diabetes treatment. Ready to proceed to action phase.'
                    })
                }],
                textResponse: 'Thinking completed',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            vi.mocked(mockedApiClient.makeRequest).mockResolvedValue(mockedResponse)
            const spy = vi.spyOn(mockedApiClient, 'makeRequest')

            // Perform thinking phase
            const thinkingResult = await thinkingModule.performThinkingPhase('workspace context')

            // Verify that only one API call was made (thinking phase exited after first round)
            expect(spy).toHaveBeenCalledTimes(1)

            // Verify that the thinking phase result indicates completion
            expect(thinkingResult.shouldProceedToAction).toBe(true)
            expect(thinkingResult.rounds.length).toBe(1)
            expect(thinkingResult.rounds[0].continueThinking).toBe(false)
            expect(thinkingResult.summary).toContain('Analysis completed')
        })

        it('should continue thinking when continueThinking is true and exit when false', async () => {
            // Mock first response with continueThinking: true
            const mockedResponse1: ApiResponse = {
                toolCalls: [{
                    id: 'continue_id_1',
                    call_id: 'continue_call_id_1',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: true,
                        totalThoughts: 3,
                        nextFocus: 'Evaluate available skills for literature search'
                    })
                }],
                textResponse: 'Continuing analysis',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            // Mock second response with continueThinking: false
            const mockedResponse2: ApiResponse = {
                toolCalls: [{
                    id: 'continue_id_2',
                    call_id: 'continue_call_id_2',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: false,
                        totalThoughts: 3,
                        summary: 'Completed skill evaluation. Recommend activating literature search skill for this task.'
                    })
                }],
                textResponse: 'Thinking completed',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            vi.mocked(mockedApiClient.makeRequest)
                .mockResolvedValueOnce(mockedResponse1)
                .mockResolvedValueOnce(mockedResponse2)

            const spy = vi.spyOn(mockedApiClient, 'makeRequest')

            // Perform thinking phase
            const thinkingResult = await thinkingModule.performThinkingPhase('workspace context')

            // Verify that two API calls were made (continued thinking, then exited)
            expect(spy).toHaveBeenCalledTimes(2)

            // Verify the thinking rounds
            expect(thinkingResult.rounds.length).toBe(2)
            expect(thinkingResult.rounds[0].continueThinking).toBe(true)
            expect(thinkingResult.rounds[1].continueThinking).toBe(false)

            // Verify the summary is from the last round
            expect(thinkingResult.summary).toContain('Completed skill evaluation')
        })
    })

    describe('retry mechanism', () => {
        it('should retry when LLM does not call any tool', async () => {
            // First response: LLM returns text but no tool call (should trigger retry)
            const mockedResponseNoTool: ApiResponse = {
                toolCalls: [], // No tool calls - this should trigger retry
                textResponse: 'I should use a tool here',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            // Second response: LLM calls continue_thinking correctly
            const mockedResponseWithTool: ApiResponse = {
                toolCalls: [{
                    id: 'continue_id',
                    call_id: 'continue_call_id',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: false,
                        totalThoughts: 1,
                        summary: 'Corrected response with tool call'
                    })
                }],
                textResponse: 'Now I call the tool',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            vi.mocked(mockedApiClient.makeRequest)
                .mockResolvedValueOnce(mockedResponseNoTool)
                .mockResolvedValueOnce(mockedResponseWithTool)

            const spy = vi.spyOn(mockedApiClient, 'makeRequest')

            // Perform thinking phase
            const thinkingResult = await thinkingModule.performThinkingPhase('workspace context')

            // Verify that two API calls were made (retry happened)
            expect(spy).toHaveBeenCalledTimes(2)

            // Verify the thinking completed successfully
            expect(thinkingResult.rounds.length).toBe(1)
            expect(thinkingResult.rounds[0].continueThinking).toBe(false)
            expect(thinkingResult.summary).toBe('Corrected response with tool call')
        })

        it('should use fallback when max retries exceeded without tool call', async () => {
            // Create a ThinkingModule with summarization disabled to avoid extra API calls
            const noSummaryThinkingModule = new ThinkingModule(
                mockedApiClient,
                mockedLogger,
                { enableSummarization: false },
                mockedTurnMemoryStore
            )

            // All responses: LLM returns text but no tool call
            const mockedResponseNoTool: ApiResponse = {
                toolCalls: [], // No tool calls
                textResponse: 'I am not using the tool',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            // Mock 3 responses (original + 2 retries = 3 total attempts with default config)
            vi.mocked(mockedApiClient.makeRequest)
                .mockResolvedValueOnce(mockedResponseNoTool)
                .mockResolvedValueOnce(mockedResponseNoTool)
                .mockResolvedValueOnce(mockedResponseNoTool)

            const spy = vi.spyOn(mockedApiClient, 'makeRequest')

            // Perform thinking phase
            const thinkingResult = await noSummaryThinkingModule.performThinkingPhase('workspace context')

            // Verify that 3 API calls were made (maxRetriesPerRound + 1)
            expect(spy).toHaveBeenCalledTimes(3)

            // Verify fallback behavior - should stop thinking
            expect(thinkingResult.rounds.length).toBe(1)
            expect(thinkingResult.rounds[0].continueThinking).toBe(false)
            expect(thinkingResult.rounds[0].content).toContain('I am not using the tool')
        })

        it('should include retry warning in prompt on retry attempts', async () => {
            // First response: No tool call
            const mockedResponseNoTool: ApiResponse = {
                toolCalls: [],
                textResponse: 'No tool called',
                requestTime: 100,
                tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
            }

            // Second response: With tool call
            const mockedResponseWithTool: ApiResponse = {
                toolCalls: [{
                    id: 'continue_id',
                    call_id: 'continue_call_id',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: false,
                        totalThoughts: 1,
                        summary: 'Success after retry'
                    })
                }],
                textResponse: 'Tool called',
                requestTime: 100,
                tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
            }

            vi.mocked(mockedApiClient.makeRequest)
                .mockResolvedValueOnce(mockedResponseNoTool)
                .mockResolvedValueOnce(mockedResponseWithTool)

            const spy = vi.spyOn(mockedApiClient, 'makeRequest')

            await thinkingModule.performThinkingPhase('workspace context')

            // Verify second call includes retry warning
            const secondCallArgs = spy.mock.calls[1]
            const systemPrompt = secondCallArgs[0] as string
            expect(systemPrompt).toContain('RETRY ATTEMPT')
            expect(systemPrompt).toContain('No required tool was called')
        })

        it('should retry on API errors', async () => {
            // First response: API error
            vi.mocked(mockedApiClient.makeRequest)
                .mockRejectedValueOnce(new Error('Network timeout'))

            // Second response: Success
            const mockedResponseSuccess: ApiResponse = {
                toolCalls: [{
                    id: 'continue_id',
                    call_id: 'continue_call_id',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: false,
                        totalThoughts: 1,
                        summary: 'Success after error retry'
                    })
                }],
                textResponse: 'Success',
                requestTime: 100,
                tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
            }

            vi.mocked(mockedApiClient.makeRequest)
                .mockResolvedValueOnce(mockedResponseSuccess)

            // We need to reset and re-setup since we used mockRejectedValueOnce
            vi.clearAllMocks()
            vi.mocked(mockedApiClient.makeRequest)
                .mockRejectedValueOnce(new Error('Network timeout'))
                .mockResolvedValueOnce(mockedResponseSuccess)

            const spy = vi.spyOn(mockedApiClient, 'makeRequest')

            // Perform thinking phase
            const thinkingResult = await thinkingModule.performThinkingPhase('workspace context')

            // Verify that two API calls were made (retry happened)
            expect(spy).toHaveBeenCalledTimes(2)

            // Verify success
            expect(thinkingResult.rounds.length).toBe(1)
            expect(thinkingResult.rounds[0].continueThinking).toBe(false)
        })

        it('should return failure round after max retries on API errors', async () => {
            // Create a new mock API client specifically for this test
            const freshMockedApiClient: ApiClient = {
                makeRequest: vi.fn().mockRejectedValue(new Error('Persistent network error'))
            }

            // Create a ThinkingModule with summarization disabled to avoid extra API calls
            const noSummaryThinkingModule = new ThinkingModule(
                freshMockedApiClient,
                mockedLogger,
                { enableSummarization: false },
                mockedTurnMemoryStore
            )

            // Perform thinking phase
            const thinkingResult = await noSummaryThinkingModule.performThinkingPhase('workspace context')

            // Verify that 3 API calls were made (maxRetriesPerRound + 1)
            // Note: With maxRetriesPerRound=2 (default), we expect 3 calls (attempt 0, 1, 2)
            expect(freshMockedApiClient.makeRequest).toHaveBeenCalledTimes(3)

            // Verify failure handling
            expect(thinkingResult.rounds.length).toBe(1)
            expect(thinkingResult.rounds[0].continueThinking).toBe(false)
            expect(thinkingResult.rounds[0].content).toContain('Thinking round failed')
            expect(thinkingResult.rounds[0].content).toContain('Persistent network error')
        })

        it('should respect custom maxRetriesPerRound config', async () => {
            // Create a new ThinkingModule with maxRetriesPerRound=1 and summarization disabled
            const customConfigThinkingModule = new ThinkingModule(
                mockedApiClient,
                mockedLogger,
                { maxRetriesPerRound: 1, enableSummarization: false },
                mockedTurnMemoryStore
            )

            // All responses: No tool call
            const mockedResponseNoTool: ApiResponse = {
                toolCalls: [],
                textResponse: 'No tool',
                requestTime: 100,
                tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
            }

            vi.mocked(mockedApiClient.makeRequest).mockResolvedValue(mockedResponseNoTool)

            const spy = vi.spyOn(mockedApiClient, 'makeRequest')

            await customConfigThinkingModule.performThinkingPhase('workspace context')

            // Verify that only 2 API calls were made (maxRetriesPerRound=1 + 1 original)
            expect(spy).toHaveBeenCalledTimes(2)
        })
    })

    describe('thinking workflow', () => {
        it('should auto-increment thoughtNumber across multiple thinking rounds', async () => {
            // Mock first response with continueThinking: true
            const mockedResponse1: ApiResponse = {
                toolCalls: [{
                    id: 'continue_id_1',
                    call_id: 'continue_call_id_1',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: true,
                        totalThoughts: 3,
                        nextFocus: 'Evaluate available skills for literature search'
                    })
                }],
                textResponse: 'First thought: Analyzing the task requirements',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            // Mock second response with continueThinking: true
            const mockedResponse2: ApiResponse = {
                toolCalls: [{
                    id: 'continue_id_2',
                    call_id: 'continue_call_id_2',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: true,
                        totalThoughts: 3,
                        nextFocus: 'Evaluate tool options'
                    })
                }],
                textResponse: 'Second thought: Evaluating available tools',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            // Mock third response with continueThinking: false
            const mockedResponse3: ApiResponse = {
                toolCalls: [{
                    id: 'continue_id_3',
                    call_id: 'continue_call_id_3',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: false,
                        totalThoughts: 3,
                        summary: 'Completed analysis. Ready to proceed with action phase.'
                    })
                }],
                textResponse: 'Third thought: Finalizing the action plan',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            vi.mocked(mockedApiClient.makeRequest)
                .mockResolvedValueOnce(mockedResponse1)
                .mockResolvedValueOnce(mockedResponse2)
                .mockResolvedValueOnce(mockedResponse3)

            // Perform thinking phase
            const thinkingResult = await thinkingModule.performThinkingPhase('workspace context')

            // Verify that three thinking rounds were executed
            expect(thinkingResult.rounds.length).toBe(3)

            // Verify that thoughtNumber was auto-incremented correctly
            expect(thinkingResult.rounds[0].thoughtNumber).toBe(1)
            expect(thinkingResult.rounds[1].thoughtNumber).toBe(2)
            expect(thinkingResult.rounds[2].thoughtNumber).toBe(3)

            // Verify that totalThoughts was controlled by LLM (remained at 3)
            expect(thinkingResult.rounds[0].totalThoughts).toBe(3)
            expect(thinkingResult.rounds[1].totalThoughts).toBe(3)
            expect(thinkingResult.rounds[2].totalThoughts).toBe(3)

            // Verify that continueThinking was set correctly
            expect(thinkingResult.rounds[0].continueThinking).toBe(true)
            expect(thinkingResult.rounds[1].continueThinking).toBe(true)
            expect(thinkingResult.rounds[2].continueThinking).toBe(false)

            // Verify that summary was captured from the last round
            expect(thinkingResult.summary).toContain('Completed analysis')
        })

        it('should reset thoughtNumber to 1 when starting a new thinking phase', async () => {
            // First thinking phase
            const mockedResponse1: ApiResponse = {
                toolCalls: [{
                    id: 'continue_id_1',
                    call_id: 'continue_call_id_1',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: false,
                        totalThoughts: 2,
                        summary: 'First thinking phase completed'
                    })
                }],
                textResponse: 'First phase thought',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            vi.mocked(mockedApiClient.makeRequest)
                .mockResolvedValueOnce(mockedResponse1)

            // Perform first thinking phase
            const result1 = await thinkingModule.performThinkingPhase('workspace context')
            expect(result1.rounds[0].thoughtNumber).toBe(1)

            // Second thinking phase (should reset to 1)
            const mockedResponse2: ApiResponse = {
                toolCalls: [{
                    id: 'continue_id_2',
                    call_id: 'continue_call_id_2',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: false,
                        totalThoughts: 2,
                        summary: 'Second thinking phase completed'
                    })
                }],
                textResponse: 'Second phase thought',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            vi.mocked(mockedApiClient.makeRequest)
                .mockResolvedValueOnce(mockedResponse2)

            // Perform second thinking phase
            const result2 = await thinkingModule.performThinkingPhase('workspace context')
            expect(result2.rounds[0].thoughtNumber).toBe(1)
        })

        it('should allow LLM to update totalThoughts while thoughtNumber auto-increments', async () => {
            // First response: LLM estimates 3 thoughts
            const mockedResponse1: ApiResponse = {
                toolCalls: [{
                    id: 'continue_id_1',
                    call_id: 'continue_call_id_1',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: true,
                        totalThoughts: 3
                    })
                }],
                textResponse: 'First thought',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            // Second response: LLM updates estimate to 5 thoughts
            const mockedResponse2: ApiResponse = {
                toolCalls: [{
                    id: 'continue_id_2',
                    call_id: 'continue_call_id_2',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: true,
                        totalThoughts: 5
                    })
                }],
                textResponse: 'Second thought',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            // Third response: LLM completes
            const mockedResponse3: ApiResponse = {
                toolCalls: [{
                    id: 'continue_id_3',
                    call_id: 'continue_call_id_3',
                    type: 'function_call',
                    name: 'continue_thinking',
                    arguments: JSON.stringify({
                        continueThinking: false,
                        totalThoughts: 5,
                        summary: 'Thinking completed'
                    })
                }],
                textResponse: 'Third thought',
                requestTime: 100,
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 20,
                    totalTokens: 30
                }
            }

            vi.mocked(mockedApiClient.makeRequest)
                .mockResolvedValueOnce(mockedResponse1)
                .mockResolvedValueOnce(mockedResponse2)
                .mockResolvedValueOnce(mockedResponse3)

            const thinkingResult = await thinkingModule.performThinkingPhase('workspace context')

            // Verify thoughtNumber auto-incremented
            expect(thinkingResult.rounds[0].thoughtNumber).toBe(1)
            expect(thinkingResult.rounds[1].thoughtNumber).toBe(2)
            expect(thinkingResult.rounds[2].thoughtNumber).toBe(3)

            // Verify totalThoughts was updated by LLM
            expect(thinkingResult.rounds[0].totalThoughts).toBe(3)
            expect(thinkingResult.rounds[1].totalThoughts).toBe(5)
            expect(thinkingResult.rounds[2].totalThoughts).toBe(5)
        })
    })
})