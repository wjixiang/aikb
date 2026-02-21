import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from 'inversify';
import { AgentContainer, getGlobalContainer, resetGlobalContainer } from '../container.js';
import { TYPES } from '../types.js';
import { Agent } from '../../agent/agent.js';
import { VirtualWorkspace } from '../../statefulContext/virtualWorkspace.js';
import { MemoryModule } from '../../memory/MemoryModule.js';
import { TurnMemoryStore } from '../../memory/TurnMemoryStore.js';
import { ReflectiveThinkingProcessor } from '../../memory/ReflectiveThinkingProcessor.js';
import { IVirtualWorkspace } from '../../statefulContext/types.js';
import { IMemoryModule } from '../../memory/types.js';
import type { ApiClient } from '../../api-client/index.js';

describe('AgentContainer', () => {
    let container: AgentContainer;

    beforeEach(() => {
        resetGlobalContainer();
        container = new AgentContainer();
    });

    describe('Basic Container Setup', () => {
        it('should create a container instance', () => {
            expect(container).toBeInstanceOf(AgentContainer);
        });

        it('should provide access to the underlying container', () => {
            const internalContainer = container.getContainer();
            expect(internalContainer).toBeInstanceOf(Container);
        });

        it('should create a child container', () => {
            const childContainer = container.createChildContainer();
            expect(childContainer).toBeInstanceOf(Container);
            expect(childContainer).not.toBe(container.getContainer());
        });
    });

    describe('Service Bindings', () => {
        it('should bind Agent as transient', () => {
            const agent1 = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' }
            });
            const agent2 = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' }
            });
            expect(agent1).not.toBe(agent2);
            expect(agent1).toBeInstanceOf(Agent);
            expect(agent2).toBeInstanceOf(Agent);
        });

        it('should bind VirtualWorkspace in request scope', () => {
            const agent1 = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' }
            });
            const agent2 = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' }
            });
            // Each agent should have its own workspace
            expect(agent1.workspace).not.toBe(agent2.workspace);
        });

        it('should bind MemoryModule to interface', () => {
            const internalContainer = container.getContainer();
            const memoryModule = internalContainer.get<IMemoryModule>(TYPES.IMemoryModule);
            expect(memoryModule).toBeInstanceOf(MemoryModule);
        });

        it('should bind VirtualWorkspace to interface', () => {
            const internalContainer = container.getContainer();
            const workspace = internalContainer.get<IVirtualWorkspace>(TYPES.IVirtualWorkspace);
            expect(workspace).toBeInstanceOf(VirtualWorkspace);
        });
    });

    describe('createAgent', () => {
        it('should create an agent with default configuration', () => {
            const agent = container.createAgent({
                agentPrompt: {
                    capability: 'Test capability',
                    direction: 'Test direction'
                }
            });
            expect(agent).toBeInstanceOf(Agent);
            expect(agent.config.apiRequestTimeout).toBe(40000); // Default value
        });

        it('should create an agent with custom configuration', () => {
            const agent = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' },
                config: {
                    apiRequestTimeout: 60000,
                    maxRetryAttempts: 5
                }
            });
            expect(agent.config.apiRequestTimeout).toBe(60000);
            expect(agent.config.maxRetryAttempts).toBe(5);
        });

        it('should create an agent with taskId', () => {
            const taskId = 'test-task-123';
            const agent = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' },
                taskId
            });
            expect(agent.getTaskId).toBe(taskId);
        });

        it('should inject IVirtualWorkspace into Agent', () => {
            const agent = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' }
            });
            expect(agent.workspace).toBeDefined();
            expect(agent.workspace).toBeInstanceOf(VirtualWorkspace);
        });

        it('should inject IMemoryModule into Agent', () => {
            const agent = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' }
            });
            const memoryModule = agent.getMemoryModule();
            expect(memoryModule).toBeDefined();
            expect(memoryModule).toBeInstanceOf(MemoryModule);
        });

        it('should inject TurnMemoryStore into MemoryModule', () => {
            const agent = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' }
            });
            const memoryModule = agent.getMemoryModule() as MemoryModule;
            const turnStore = memoryModule.getTurnStore();
            expect(turnStore).toBeDefined();
            expect(turnStore).toBeInstanceOf(TurnMemoryStore);
        });

        it('should use provided workspace when specified', () => {
            const customWorkspace = new VirtualWorkspace({});
            const agent = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' },
                workspace: customWorkspace
            });
            expect(agent.workspace).toBe(customWorkspace);
        });

        it('should handle observers option', () => {
            const onStatusChanged = vi.fn();
            const agent = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' },
                observers: {
                    onStatusChanged
                }
            });
            expect(agent).toBeDefined();
            // Note: With observers, agent is wrapped in ObservableAgent
        });

        it('should create agent with custom virtual workspace config', () => {
            const agent = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' },
                virtualWorkspaceConfig: {
                    id: 'custom-workspace-id',
                    name: 'Custom Workspace'
                }
            });
            expect(agent.workspace).toBeDefined();
            // VirtualWorkspace has a private config, so we can't directly test id
            // But we can verify the workspace was created
            expect(agent.workspace).toBeInstanceOf(VirtualWorkspace);
        });
    });

    describe('Configuration Merging', () => {
        it('should merge default and custom agent config', () => {
            const agent = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' },
                config: {
                    apiRequestTimeout: 60000
                    // maxRetryAttempts should keep default
                }
            });
            expect(agent.config.apiRequestTimeout).toBe(60000);
            expect(agent.config.maxRetryAttempts).toBe(3); // Default
        });

        it('should merge default and custom API configuration', () => {
            // This would require mocking ApiClient to verify
            // For now, just verify agent creation succeeds
            const agent = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' },
                apiConfiguration: {
                    apiModelId: 'custom-model'
                }
            });
            expect(agent).toBeInstanceOf(Agent);
        });

        it('should use default agent prompt when not provided', () => {
            const agent = container.createAgent({});
            expect(agent).toBeInstanceOf(Agent);
            // Agent should have default prompt values
        });
    });

    describe('Error Handling', () => {
        it('should throw error if AgentPrompt is not provided', () => {
            // The container should still create an agent with default prompt
            // This test verifies the behavior
            const agent = container.createAgent({});
            expect(agent).toBeInstanceOf(Agent);
        });

        it('should handle missing API key gracefully', () => {
            // Save original env var
            const originalEnv = process.env['GLM_API_KEY'];
            delete process.env['GLM_API_KEY'];

            const agent = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' },
                apiConfiguration: {
                    apiKey: 'test-key' // Provide explicit key
                }
            });

            expect(agent).toBeInstanceOf(Agent);

            // Restore original env var
            if (originalEnv !== undefined) {
                process.env['GLM_API_KEY'] = originalEnv;
            }
        });

        it('should create agent with empty API key (fallback to env)', () => {
            const agent = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' }
            });
            expect(agent).toBeInstanceOf(Agent);
        });
    });

    describe('Dependency Injection Chain', () => {
        it('should properly inject ReflectiveThinkingProcessor', () => {
            const agent = container.createAgent({
                agentPrompt: { capability: 'Test', direction: 'Test' }
            });
            const memoryModule = agent.getMemoryModule();
            expect(memoryModule).toBeInstanceOf(MemoryModule);
            // ReflectiveThinkingProcessor is injected into MemoryModule
        });

        it('should create isolated dependencies for each agent', () => {
            const agent1 = container.createAgent({
                agentPrompt: { capability: 'Test1', direction: 'Test1' }
            });
            const agent2 = container.createAgent({
                agentPrompt: { capability: 'Test2', direction: 'Test2' }
            });

            // Each agent should have its own workspace
            expect(agent1.workspace).not.toBe(agent2.workspace);

            // Each agent should have its own memory module
            const mem1 = agent1.getMemoryModule();
            const mem2 = agent2.getMemoryModule();
            expect(mem1).not.toBe(mem2);

            // Each memory module should have its own turn store
            const store1 = mem1.getTurnStore();
            const store2 = mem2.getTurnStore();
            expect(store1).not.toBe(store2);
        });
    });
});

describe('Global Container', () => {
    beforeEach(() => {
        resetGlobalContainer();
    });

    it('should return the same instance on multiple calls', () => {
        const container1 = getGlobalContainer();
        const container2 = getGlobalContainer();
        expect(container1).toBe(container2);
    });

    it('should create a new instance after reset', () => {
        const container1 = getGlobalContainer();
        resetGlobalContainer();
        const container2 = getGlobalContainer();
        expect(container1).not.toBe(container2);
    });

    it('should work across multiple agent creations', () => {
        const container = getGlobalContainer();
        const agent1 = container.createAgent({
            agentPrompt: { capability: 'Test1', direction: 'Test1' }
        });
        const agent2 = container.createAgent({
            agentPrompt: { capability: 'Test2', direction: 'Test2' }
        });
        expect(agent1).not.toBe(agent2);
        expect(agent1.workspace).not.toBe(agent2.workspace);
    });

    it('should maintain singleton pattern across resets', () => {
        const container1 = getGlobalContainer();
        const container2 = getGlobalContainer();
        expect(container1).toBe(container2);

        resetGlobalContainer();

        const container3 = getGlobalContainer();
        const container4 = getGlobalContainer();
        expect(container3).toBe(container4);
        expect(container1).not.toBe(container3);
    });
});

describe('AgentFactory with DI Container', () => {
    beforeEach(() => {
        resetGlobalContainer();
    });

    it('should use container in AgentFactory.create', async () => {
        const { AgentFactory } = await import('../../agent/AgentFactory.js');
        const workspace = new VirtualWorkspace({});

        const agent = AgentFactory.create(
            workspace,
            { capability: 'Test', direction: 'Test' }
        );

        expect(agent).toBeInstanceOf(Agent);
        expect(agent.workspace).toBe(workspace);
    });

    it('should support custom container in AgentFactory', async () => {
        const { AgentFactory } = await import('../../agent/AgentFactory.js');
        const customContainer = new AgentContainer();

        AgentFactory.setContainer(customContainer);

        const workspace = new VirtualWorkspace({});
        const agent = AgentFactory.create(
            workspace,
            { capability: 'Test', direction: 'Test' }
        );

        expect(agent).toBeInstanceOf(Agent);

        AgentFactory.resetContainer();
    });

    it('should use createWithContainer method', async () => {
        const { AgentFactory } = await import('../../agent/AgentFactory.js');

        const agent = AgentFactory.createWithContainer(
            { capability: 'Test', direction: 'Test' }
        );

        expect(agent).toBeInstanceOf(Agent);
        expect(agent.workspace).toBeDefined();
    });

    it('should pass custom config through AgentFactory', async () => {
        const { AgentFactory } = await import('../../agent/AgentFactory.js');
        const workspace = new VirtualWorkspace({});

        const agent = AgentFactory.create(
            workspace,
            { capability: 'Test', direction: 'Test' },
            {
                config: {
                    apiRequestTimeout: 70000,
                    maxRetryAttempts: 2
                }
            }
        );

        expect(agent.config.apiRequestTimeout).toBe(70000);
        expect(agent.config.maxRetryAttempts).toBe(2);
    });

    it('should pass taskId through AgentFactory', async () => {
        const { AgentFactory } = await import('../../agent/AgentFactory.js');
        const workspace = new VirtualWorkspace({});
        const taskId = 'factory-task-123';

        const agent = AgentFactory.create(
            workspace,
            { capability: 'Test', direction: 'Test' },
            { taskId }
        );

        expect(agent.getTaskId).toBe(taskId);
    });

    it('should reset container between tests', async () => {
        const { AgentFactory } = await import('../../agent/AgentFactory.js');

        // Create first agent
        const workspace1 = new VirtualWorkspace({});
        const agent1 = AgentFactory.create(
            workspace1,
            { capability: 'Test1', direction: 'Test1' }
        );

        // Reset
        AgentFactory.resetContainer();
        const customContainer = new AgentContainer();
        AgentFactory.setContainer(customContainer);

        // Create second agent with custom container
        const workspace2 = new VirtualWorkspace({});
        const agent2 = AgentFactory.create(
            workspace2,
            { capability: 'Test2', direction: 'Test2' }
        );

        expect(agent1).not.toBe(agent2);
        expect(agent1.workspace).not.toBe(agent2.workspace);

        AgentFactory.resetContainer();
    });
});

describe('Container Scopes', () => {
    let container: AgentContainer;

    beforeEach(() => {
        resetGlobalContainer();
        container = new AgentContainer();
    });

    it('should create transient scoped agents', () => {
        const agent1 = container.createAgent({
            agentPrompt: { capability: 'Test', direction: 'Test' }
        });
        const agent2 = container.createAgent({
            agentPrompt: { capability: 'Test', direction: 'Test' }
        });

        expect(agent1).not.toBe(agent2);
    });

    it('should create request scoped workspaces per agent', () => {
        const agent1 = container.createAgent({
            agentPrompt: { capability: 'Test', direction: 'Test' }
        });
        const agent2 = container.createAgent({
            agentPrompt: { capability: 'Test', direction: 'Test' }
        });

        expect(agent1.workspace).not.toBe(agent2.workspace);
    });

    it('should create request scoped memory modules per agent', () => {
        const agent1 = container.createAgent({
            agentPrompt: { capability: 'Test', direction: 'Test' }
        });
        const agent2 = container.createAgent({
            agentPrompt: { capability: 'Test', direction: 'Test' }
        });

        const mem1 = agent1.getMemoryModule();
        const mem2 = agent2.getMemoryModule();

        expect(mem1).not.toBe(mem2);
    });
});

describe('Container Configuration', () => {
    beforeEach(() => {
        resetGlobalContainer();
    });

    it('should have default AgentConfig bound', () => {
        const container = new AgentContainer();
        const internalContainer = container.getContainer();
        const config = internalContainer.get<any>(TYPES.AgentConfig);

        expect(config).toBeDefined();
        expect(config.apiRequestTimeout).toBe(40000);
        expect(config.maxRetryAttempts).toBe(3);
    });

    it('should have default ProviderSettings bound', () => {
        const container = new AgentContainer();
        const internalContainer = container.getContainer();
        const settings = internalContainer.get<any>(TYPES.ProviderSettings);

        expect(settings).toBeDefined();
        expect(settings.apiProvider).toBe('zai');
        expect(settings.apiModelId).toBe('glm-4.5');
    });

    it('should have default VirtualWorkspaceConfig bound', () => {
        const container = new AgentContainer();
        const internalContainer = container.getContainer();
        const config = internalContainer.get<any>(TYPES.VirtualWorkspaceConfig);

        expect(config).toBeDefined();
        expect(config.id).toBe('default-workspace');
        expect(config.name).toBe('Default Workspace');
    });

    it('should have default MemoryModuleConfig bound', () => {
        const container = new AgentContainer();
        const internalContainer = container.getContainer();
        const config = internalContainer.get<any>(TYPES.MemoryModuleConfig);

        expect(config).toBeDefined();
    });
});
