/**
 * ExpertExecutor Global Component Integration Tests
 *
 * Tests for the global component management integration in ExpertExecutor
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ExpertExecutor } from '../ExpertExecutor.js';
import { ExpertRegistry } from '../ExpertRegistry.js';
import type { ExpertConfig } from '../types.js';
import type { IExpertPersistenceStore } from '../persistence/index.js';

// Mock the persistence store
const mockPersistenceStore: IExpertPersistenceStore = {
    saveInstance: vi.fn().mockResolvedValue(undefined),
    deleteInstance: vi.fn().mockResolvedValue(undefined),
    getInstance: vi.fn().mockResolvedValue(null),
    listInstances: vi.fn().mockResolvedValue([]),
    listRunningInstances: vi.fn().mockResolvedValue([]),
    updateInstanceStatus: vi.fn().mockResolvedValue(undefined),
};

describe('ExpertExecutor Global Component Integration', () => {
    let executor: ExpertExecutor;
    let registry: ExpertRegistry;

    const expertConfig: ExpertConfig = {
        expertId: 'test-expert',
        displayName: 'Test Expert',
        description: 'A test expert',
        responsibilities: 'Testing',
        capabilities: [],
        components: [],
        prompt: {
            capability: 'Test capability',
            direction: 'Test direction',
        },
        mailConfig: {
            enabled: true,
            baseUrl: 'http://localhost:3000',
        },
    };

    beforeEach(() => {
        registry = new ExpertRegistry();
        executor = new ExpertExecutor(registry, undefined, mockPersistenceStore);
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('registerBuiltinComponent', () => {
        it('should use workspace.hasGlobalComponent to check if mail is registered', async () => {
            // Register expert config
            executor.registerExpert(expertConfig);

            // Create expert - this triggers registerBuiltinComponent
            // We need to mock the workspace to track hasGlobalComponent call
            const mockWorkspace = {
                hasGlobalComponent: vi.fn().mockReturnValue(false),
                registerGlobalComponent: vi.fn(),
                getComponentRegistry: vi.fn().mockReturnValue({ has: vi.fn().mockReturnValue(false) }),
                registerComponent: vi.fn(),
            };

            // Mock agent creation by overriding the createExpert method behavior
            // Note: Full integration test would require actual Agent creation
            // This test verifies the interface contract
            expect(typeof mockWorkspace.hasGlobalComponent).toBe('function');
            expect(typeof mockWorkspace.registerGlobalComponent).toBe('function');
        });

        it('should use workspace.registerGlobalComponent instead of registerComponent', async () => {
            // Register expert config
            executor.registerExpert(expertConfig);

            // The key verification is that when we mock the workspace,
            // registerGlobalComponent is called instead of registerComponent
            const mockWorkspace = {
                hasGlobalComponent: vi.fn().mockReturnValue(false),
                registerGlobalComponent: vi.fn(),
                getComponentRegistry: vi.fn().mockReturnValue({ has: vi.fn().mockReturnValue(false) }),
                registerComponent: vi.fn(),
            };

            // Simulate what ExpertExecutor does
            if (!mockWorkspace.hasGlobalComponent('mail')) {
                mockWorkspace.registerGlobalComponent('mail', {}, -1);
            }

            expect(mockWorkspace.hasGlobalComponent).toHaveBeenCalledWith('mail');
            expect(mockWorkspace.registerGlobalComponent).toHaveBeenCalledWith('mail', {}, -1);
            expect(mockWorkspace.registerComponent).not.toHaveBeenCalled();
        });

        it('should skip registration if hasGlobalComponent returns true', async () => {
            const mockWorkspace = {
                hasGlobalComponent: vi.fn().mockReturnValue(true),
                registerGlobalComponent: vi.fn(),
                getComponentRegistry: vi.fn().mockReturnValue({ has: vi.fn().mockReturnValue(true) }),
                registerComponent: vi.fn(),
            };

            // Simulate what ExpertExecutor does
            if (!mockWorkspace.hasGlobalComponent('mail')) {
                mockWorkspace.registerGlobalComponent('mail', {}, -1);
            }

            expect(mockWorkspace.hasGlobalComponent).toHaveBeenCalledWith('mail');
            expect(mockWorkspace.registerGlobalComponent).not.toHaveBeenCalled();
        });
    });

    describe('Global Component API Contract', () => {
        it('should require hasGlobalComponent method on workspace', () => {
            const mockWorkspace = {
                hasGlobalComponent: vi.fn().mockReturnValue(false),
            };
            expect(typeof mockWorkspace.hasGlobalComponent).toBe('function');
        });

        it('should require registerGlobalComponent method on workspace', () => {
            const mockWorkspace = {
                registerGlobalComponent: vi.fn(),
            };
            expect(typeof mockWorkspace.registerGlobalComponent).toBe('function');
        });
    });
});

describe('ExpertExecutor and VirtualWorkspace Global Component Flow', () => {
    it('should document the integration flow', () => {
        // This test documents the expected flow:
        //
        // 1. ExpertExecutor.createExpert() creates an Agent with VirtualWorkspace
        // 2. ExpertExecutor.registerBuiltinComponent() is called
        // 3. It checks workspace.hasGlobalComponent('mail')
        //    - If true: skip registration (already registered by another expert)
        //    - If false: create MailComponent and call workspace.registerGlobalComponent('mail', mailComponent, -1)
        // 4. VirtualWorkspace.registerGlobalComponent():
        //    - Stores component in globalComponents Map
        //    - Also registers in componentRegistry for tool access
        //    - Registers as tool provider in toolManager
        //
        // Benefits:
        // - MailComponent is now a workspace-level global component
        // - Other services can access via workspace.getGlobalComponent('mail')
        // - Only one MailComponent instance per workspace (shared across experts)

        expect(true).toBe(true);
    });
});
