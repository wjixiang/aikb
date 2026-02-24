import { ApiClient, ApiResponse, ApiTimeoutConfig, ChatCompletionTool } from '../../api-client'
import { ThinkingModule } from '../ThinkingModule'
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
                    reason: 'test_reason_abc',
                    thoughtNumber: 1,
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
                    reason: 'Recall completed',
                    thoughtNumber: 1,
                    totalThoughts: 1,
                    summary: 'Test summary'
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

        // Mock the makeRequest to return the mockedResponse
        vi.mocked(mockedApiClient.makeRequest)
            .mockResolvedValueOnce(mockedResponse)
            .mockResolvedValueOnce(mockedResponse2)

        const spy = vi.spyOn(mockedApiClient, 'makeRequest')

        const thinkingResult = await thinkingModule.performThinkingPhase('workspace context')
        console.log(thinkingResult)
        console.log(spy.mock.calls[1])
        expect(JSON.stringify(spy.mock.calls[1])).toContain('test_reason_abc')
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
                        reason: 'Recall completed',
                        thoughtNumber: 1,
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
                        reason: 'Recall completed',
                        thoughtNumber: 1,
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
                        reason: 'Recall completed',
                        thoughtNumber: 1,
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
                        reason: 'Recall completed',
                        thoughtNumber: 1,
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
                        reason: 'Task analysis completed, ready to proceed to action phase',
                        thoughtNumber: 1,
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
            expect(thinkingResult.rounds[0].reason).toBe('Task analysis completed, ready to proceed to action phase')
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
                        reason: 'Need more analysis on skill requirements',
                        thoughtNumber: 1,
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
                        reason: 'Skill evaluation completed, ready to activate literature search skill',
                        thoughtNumber: 2,
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
})