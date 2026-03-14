import { vi } from 'vitest';
import type { ExpertArtifact, ExpertTask, ExpertResult, ExpertStatus } from '../types';

/**
 * Mock Agent for testing Expert
 */
export interface MockAgentOptions {
    startDelay?: number;
    shouldFail?: boolean;
    failError?: Error;
    mockOutput?: any;
    mockSummary?: string;
}

export function createMockAgent(options: MockAgentOptions = {}) {
    const {
        startDelay = 0,
        shouldFail = false,
        failError = new Error('Mock failure'),
        mockOutput = { result: 'mock output' },
        mockSummary = 'Task completed successfully'
    } = options;

    let currentStatus: ExpertStatus = 'idle';

    const agent = {
        // Status
        get status() {
            return currentStatus;
        },

        // Workspace mock
        workspace: {
            getStats: vi.fn().mockReturnValue({
                componentCount: 1,
                totalTools: 5
            }),
            getComponent: vi.fn().mockReturnValue(null),
            getComponentKeys: vi.fn().mockReturnValue(['test-component']),
            getComponentState: vi.fn().mockReturnValue({})
        },

        // Tool execution
        toolManager: {
            executeTool: vi.fn().mockResolvedValue({ success: true, result: 'tool executed' }),
            isToolEnabled: vi.fn().mockReturnValue(true),
            getAvailableTools: vi.fn().mockReturnValue([])
        },

        // Lifecycle
        start: vi.fn().mockImplementation(async () => {
            if (startDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, startDelay));
            }
            currentStatus = 'running';
            if (shouldFail) {
                throw failError;
            }
            return agent;
        }),

        abort: vi.fn().mockImplementation((reason: string, source: string) => {
            currentStatus = 'idle';
        }),

        // Memory
        memoryModule: {
            addMessage: vi.fn(),
            getAllMessages: vi.fn().mockReturnValue([]),
            startTurn: vi.fn(),
            getCurrentTurn: vi.fn().mockReturnValue({})
        },

        // Logger
        logger: {
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        }
    };

    return agent;
}

/**
 * Create a mock ExpertResult
 */
export function createMockExpertResult(overrides: Partial<ExpertResult> = {}): ExpertResult {
    return {
        expertId: 'test-expert',
        success: true,
        output: { result: 'test output' },
        summary: 'Test completed',
        artifacts: [],
        duration: 100,
        ...overrides
    };
}

/**
 * Create a mock ExpertTask
 */
export function createMockExpertTask(overrides: Partial<ExpertTask> = {}): ExpertTask {
    return {
        taskId: 'task-1',
        description: 'Test task',
        ...overrides
    };
}

/**
 * Create a mock ExpertArtifact
 */
export function createMockExpertArtifact(overrides: Partial<ExpertArtifact> = {}): ExpertArtifact {
    return {
        type: 'data',
        name: 'test-artifact',
        content: { key: 'value' },
        shareable: true,
        ...overrides
    };
}
