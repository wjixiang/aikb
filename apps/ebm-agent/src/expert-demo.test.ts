/**
 * Expert Demo Test - Run via vitest to avoid tsx/esbuild decorator issues
 *
 * Usage:
 *   pnpm vitest run src/expert-demo.test.ts
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

describe('Expert Config Loading', () => {
    it('should load expert config', async () => {
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');

        expect(existsSync(expertDir)).toBe(true);

        const configPath = join(expertDir, 'config.json');
        expect(existsSync(configPath)).toBe(true);

        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        expect(config.id).toBe('hi-agent');
        expect(config.displayName).toBeDefined();
    });

    it('should have valid index.ts with createExpertConfig', async () => {
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');
        const indexPath = join(expertDir, 'index.ts');

        expect(existsSync(indexPath)).toBe(true);

        // Try to import the expert
        const expertModule = await import(`file://${indexPath}`);
        expect(expertModule.default).toBeDefined();
    });

    it('should be able to load ExpertConfig from index.ts', async () => {
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');
        const indexPath = join(expertDir, 'index.ts');

        // Import the expert factory - createSimpleExpertConfig is called at module load time
        const expertModule = await import(`file://${indexPath}`);
        const expertConfig = expertModule.default;

        // createSimpleExpertConfig returns ExpertConfig directly (not a factory function)
        expect(expertConfig.expertId).toBe('hi-agent');
        expect(expertConfig.displayName).toBeDefined();
        expect(expertConfig.description).toBeDefined();
    });

    it('should have Workspace.ts for custom components', async () => {
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');
        const workspacePath = join(expertDir, 'Workspace.ts');

        expect(existsSync(workspacePath)).toBe(true);

        // Try to import the workspace
        const workspaceModule = await import(`file://${workspacePath}`);
        expect(workspaceModule.HiAgentWorkspace).toBeDefined();
    });

    it('should load components from Workspace.ts getComponents()', async () => {
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');
        const workspacePath = join(expertDir, 'Workspace.ts');

        // Import the workspace
        const workspaceModule = await import(`file://${workspacePath}`);
        const Workspace = workspaceModule.HiAgentWorkspace;

        // Get components
        const components = Workspace.getComponents();
        expect(components.length).toBeGreaterThan(0);

        // Check component is a ToolComponent instance
        const component = components[0];
        expect(component).toBeDefined();
        expect(component.componentId).toBe('hello');
        expect(component.displayName).toBe('Hello Component');
    });

    it('should create ExpertConfig with components from Workspace', async () => {
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');
        const indexPath = join(expertDir, 'index.ts');

        // Import the expert config
        const expertModule = await import(`file://${indexPath}`);
        const expertConfig = expertModule.default;

        // Check components are defined
        expect(expertConfig.components).toBeDefined();
        expect(expertConfig.components.length).toBeGreaterThan(0);

        // Check component definition
        const comp = expertConfig.components[0];
        expect(comp.componentId).toBe('component-0');
        expect(comp.instance).toBeDefined();
    });

    it('should be able to instantiate component from ExpertConfig', async () => {
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');
        const indexPath = join(expertDir, 'index.ts');

        // Import the expert config
        const expertModule = await import(`file://${indexPath}`);
        const expertConfig = expertModule.default;

        // Get component instance
        const comp = expertConfig.components[0];
        const instance = comp.instance;

        // If it's a factory function, call it
        let componentInstance;
        if (typeof instance === 'function') {
            componentInstance = instance();
        } else {
            componentInstance = instance;
        }

        // Check component works
        expect(componentInstance).toBeDefined();
        expect(componentInstance.componentId).toBe('hello');
        expect(typeof componentInstance.handleToolCall).toBe('function');
        expect(typeof componentInstance.renderImply).toBe('function');
    });

    it('should be able to call tool on component instance', async () => {
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');
        const indexPath = join(expertDir, 'index.ts');

        // Import the expert config
        const expertModule = await import(`file://${indexPath}`);
        const expertConfig = expertModule.default;

        // Get component instance
        const comp = expertConfig.components[0];
        let componentInstance;
        if (typeof comp.instance === 'function') {
            componentInstance = comp.instance();
        } else {
            componentInstance = comp.instance;
        }

        // Test tool call
        await componentInstance.handleToolCall('hello', { name: 'Claude' });

        // Check state changed
        const state = componentInstance.getState();
        expect(state.message).toBe('Hello, Claude!');
    });

    it('should be able to render component', async () => {
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');
        const indexPath = join(expertDir, 'index.ts');

        // Import the expert config
        const expertModule = await import(`file://${indexPath}`);
        const expertConfig = expertModule.default;

        // Get component instance
        const comp = expertConfig.components[0];
        let componentInstance;
        if (typeof comp.instance === 'function') {
            componentInstance = comp.instance();
        } else {
            componentInstance = comp.instance;
        }

        // Test render
        const rendered = await componentInstance.renderImply();
        expect(rendered).toBeDefined();
        expect(rendered.length).toBeGreaterThan(0);
    });
});

/**
 * Expert Instantiation Demo
 *
 * 展示如何实例化 Expert 并运行的完整流程
 */
describe('Expert Instantiation', () => {
    it('should show complete expert instantiation flow', async () => {
        /**
         * Expert 实例化完整流程：
         *
         * 1. 加载 Expert 配置
         *    const expertConfig = (await import('./expert/index.ts')).default;
         *
         * 2. 创建 ExpertRegistry
         *    const registry = new ExpertRegistry();
         *
         * 3. 注册 Expert 配置
         *    registry.register(expertConfig);
         *
         * 4. 创建 ExpertExecutor
         *    const executor = new ExpertExecutor(registry);
         *
         * 5. 注册配置到 Executor
         *    executor.registerExpert(expertConfig);
         *
         * 6. 创建 Expert 实例
         *    const instance = await executor.createExpert(expertConfig.expertId);
         *
         * 7. 激活 Expert
         *    await instance.activate();
         *
         * 8. 执行任务
         *    const result = await instance.execute({ task: '...', input: {...} });
         */

        // 加载 Expert 配置
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');
        const indexPath = join(expertDir, 'index.ts');
        const expertModule = await import(`file://${indexPath}`);
        const expertConfig = expertModule.default;

        // 验证配置结构
        expect(expertConfig.expertId).toBe('hi-agent');
        expect(expertConfig.displayName).toBeDefined();
        expect(expertConfig.components).toBeDefined();
        expect(expertConfig.components.length).toBeGreaterThan(0);

        // 打印完整的实例化流程
        console.log('=== Expert 实例化流程 ===');
        console.log('1. 加载配置: expertConfig =', JSON.stringify({
            expertId: expertConfig.expertId,
            displayName: expertConfig.displayName,
            components: expertConfig.components.length
        }, null, 2));
        console.log('2. 创建 ExpertRegistry: new ExpertRegistry()');
        console.log('3. 注册配置: registry.register(expertConfig)');
        console.log('4. 创建 ExpertExecutor: new ExpertExecutor(registry)');
        console.log('5. 注册到 Executor: executor.registerExpert(expertConfig)');
        console.log('6. 创建实例: await executor.createExpert("hi-agent")');
        console.log('7. 激活: await instance.activate()');
        console.log('8. 执行: await instance.execute({ task, input })');
        console.log('========================');
    });

    it('should run component directly without ExpertExecutor', async () => {
        // 直接运行组件的示例（无需完整的 Expert 系统）

        // 1. 加载 Expert 配置
        const expertDir = join(process.cwd(), 'experts', 'hi-agent');
        const indexPath = join(expertDir, 'index.ts');
        const expertModule = await import(`file://${indexPath}`);
        const expertConfig = expertModule.default;

        // 2. 获取组件实例
        const componentDef = expertConfig.components[0];
        let component;
        if (typeof componentDef.instance === 'function') {
            component = componentDef.instance();
        } else {
            component = componentDef.instance;
        }

        // 3. 调用工具
        await component.handleToolCall('hello', { name: 'World' });

        // 4. 获取状态
        const state = component.getState();

        // 验证
        expect(state.message).toBe('Hello, World!');

        console.log('=== 直接运行组件 ===');
        console.log('组件:', component.componentId);
        console.log('状态:', state);
        console.log('====================');
    });
});
