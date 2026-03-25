/**
 * VirtualWorkspace Tests
 *
 * Tests for the component-based architecture using AgentContainer DI
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentContainer } from '../../di/container.js';
import { VirtualWorkspace } from '../virtualWorkspace.js';
import type { DIComponentRegistration } from '../../di/UnifiedAgentConfig.js';
import { TestComponent, TestComponent2 } from './testComponents.js';

function createTestWorkspace(
  config: Partial<{ id: string; name: string }> = {},
  diComponents?: DIComponentRegistration[],
): Promise<{ workspace: VirtualWorkspace; container: AgentContainer }> {
  const container = new AgentContainer({
    api: { apiKey: 'test-key' },
    workspace: {
      id: config.id ?? 'test-workspace',
      name: config.name ?? 'Test Workspace',
    },
    components: diComponents,
  });

  return container.getAgent().then((agent) => ({
    workspace: agent.workspace as VirtualWorkspace,
    container,
  }));
}

describe('VirtualWorkspace (Component-based)', () => {
  describe('Component Registration', () => {
    it('should register a component via DI', async () => {
      const component = new TestComponent();
      const diComponents: DIComponentRegistration[] = [{ component }];

      const { workspace } = await createTestWorkspace(
        { id: 'di-test', name: 'DI Test' },
        diComponents,
      );

      const retrieved = workspace.getComponent('test-component');
      expect(retrieved).toBe(component);
    });

    it('should register multiple components via DI', async () => {
      const component1 = new TestComponent();
      const component2 = new TestComponent2();

      const diComponents: DIComponentRegistration[] = [
        { component: component1 },
        { component: component2 },
      ];

      const { workspace } = await createTestWorkspace(
        { id: 'multi-test', name: 'Multi Test' },
        diComponents,
      );

      // Components are registered with their componentId
      expect(workspace.getComponent('test-component')).toBe(component1);
      expect(workspace.getComponent('test-component-2')).toBe(component2);
    });

    it('should get all component keys', async () => {
      const component1 = new TestComponent();
      const component2 = new TestComponent2();

      const diComponents: DIComponentRegistration[] = [
        { component: component1 },
        { component: component2 },
      ];

      const { workspace } = await createTestWorkspace(
        { id: 'keys-test', name: 'Keys Test' },
        diComponents,
      );

      const keys = workspace.getComponentKeys();
      expect(keys).toContain('test-component');
      expect(keys).toContain('test-component-2');
    });
  });

  describe('Rendering', () => {
    it('should render workspace with registered components', async () => {
      const component = new TestComponent();
      const diComponents: DIComponentRegistration[] = [{ component }];

      const { workspace } = await createTestWorkspace(
        { id: 'render-test', name: 'Render Test' },
        diComponents,
      );

      const rendered = await workspace.render();
      expect(rendered).toContain('VIRTUAL WORKSPACE: Render Test');
      expect(rendered).toContain('test-component');
    });

    it('should render components section', async () => {
      const component = new TestComponent();
      const diComponents: DIComponentRegistration[] = [{ component }];

      const { workspace } = await createTestWorkspace(
        { id: 'section-test', name: 'Section Test' },
        diComponents,
      );

      const rendered = await workspace.renderComponentToolsSection();
      expect(rendered?.render()).toContain('COMPONENT TOOLS');
      expect(rendered?.render()).toContain('test_tool');
    });
  });

  describe('Tool Management', () => {
    it('should get available tools from components', async () => {
      const component = new TestComponent();
      const diComponents: DIComponentRegistration[] = [{ component }];

      const { workspace } = await createTestWorkspace(
        { id: 'tool-test', name: 'Tool Test' },
        diComponents,
      );

      const tools = workspace.getAvailableTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.find((t) => t.toolName === 'test_tool')).toBeDefined();
    });

    it('should check if tool is available', async () => {
      const component = new TestComponent();
      const diComponents: DIComponentRegistration[] = [{ component }];

      const { workspace } = await createTestWorkspace(
        { id: 'avail-test', name: 'Avail Test' },
        diComponents,
      );

      expect(workspace.isToolAvailable('test_tool')).toBe(true);
      expect(workspace.isToolAvailable('nonexistent_tool')).toBe(false);
    });

    it('should execute tool call', async () => {
      const component = new TestComponent();
      const diComponents: DIComponentRegistration[] = [{ component }];

      const { workspace } = await createTestWorkspace(
        { id: 'exec-test', name: 'Exec Test' },
        diComponents,
      );

      const result = await workspace.handleToolCall('test_tool', {});
      expect(result.success).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should get workspace config', async () => {
      const { workspace } = await createTestWorkspace({
        id: 'test-workspace',
        name: 'Test Workspace',
      });

      const config = workspace.getConfig();
      expect(config.id).toBe('test-workspace');
      expect(config.name).toBe('Test Workspace');
    });

    it('should get workspace stats', async () => {
      const component = new TestComponent();
      const diComponents: DIComponentRegistration[] = [{ component }];

      const { workspace } = await createTestWorkspace(
        { id: 'stats-test', name: 'Stats Test' },
        diComponents,
      );

      const stats = workspace.getStats();
      // componentCount includes global A2ATaskComponent + RuntimeControlComponent + test-component
      expect(stats.componentCount).toBe(3);
      expect(stats.componentKeys).toContain('test-component');
      expect(stats.componentKeys).toContain('a2a-task');
      expect(stats.componentKeys).toContain('runtime-control');
    });
  });

  describe('render component according to render mode', () => {
    it('should render in markdown', async () => {
      const component = new TestComponent();
      const diComponents: DIComponentRegistration[] = [{ component }];

      const container = new AgentContainer({
        api: { apiKey: 'test-key' },
        workspace: {
          id: 'markdown-test',
          name: 'Markdown Test',
          renderMode: 'markdown',
        },
        components: diComponents,
      });

      const agent = await container.getAgent();
      const workspace = agent.workspace as VirtualWorkspace;

      const rendered = await workspace.render();
      expect(rendered).toContain('VIRTUAL WORKSPACE: Markdown Test');
    });
  });
});
