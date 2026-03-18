import { Container } from 'inversify';
import { TYPES } from '../../../di/types';
import { ExpertRegistry } from '../../ExpertRegistry';
import { ExpertExecutor } from '../../ExpertExecutor';
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

    return container;
}

/**
 * Get Expert components from container
 */
export function getExpertComponents(container: Container) {
    return {
        registry: container.get<ExpertRegistry>(ExpertRegistry),
        executor: container.get<ExpertExecutor>(ExpertExecutor),
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
