import { Container } from 'inversify';
import { TYPES } from '../../../di/types';
import { ExpertRegistry } from '../../ExpertRegistry';
import { ExpertExecutor } from '../../ExpertExecutor';
import { ExpertOrchestrator } from '../../ExpertOrchestrator';
import { ILogger } from '../../../utils/logging/types';

/**
 * Mock Logger for testing
 */
export const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
};

/**
 * Create a test container with Expert dependencies
 */
export function createTestContainer(): Container {
    const container = new Container();

    // Bind Logger
    container.bind<ILogger>(TYPES.Logger).toConstantValue(mockLogger as any);

    // Bind Expert components
    container.bind<ExpertRegistry>(ExpertRegistry).toSelf();
    container.bind<ExpertExecutor>(ExpertExecutor).toSelf();
    container.bind<ExpertOrchestrator>(ExpertOrchestrator).toSelf();

    // Bind ExpertRegistry to IExpertRegistry (if needed)
    // container.bind<IExpertRegistry>(TYPES.IExpertRegistry).to(ExpertRegistry);

    return container;
}

/**
 * Get Expert components from container
 */
export function getExpertComponents(container: Container) {
    return {
        registry: container.get<ExpertRegistry>(ExpertRegistry),
        executor: container.get<ExpertExecutor>(ExpertExecutor),
        orchestrator: container.get<ExpertOrchestrator>(ExpertOrchestrator)
    };
}

/**
 * Reset all mock loggers
 */
export function resetMocks() {
    mockLogger.info.mockClear();
    mockLogger.debug.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
}
