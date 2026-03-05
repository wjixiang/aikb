import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'inversify';
import { SkillManager } from '../SkillManager.js';
import { defineSkill, createComponentDefinition } from '../SkillDefinition.js';
import type { Skill, Tool } from '../types.js';
import { TYPES } from '../../di/types.js';
import { PicosComponent } from '../../components/PICOS/picosComponents.js';

/**
 * Test to verify DI token resolution for skill components
 * 
 * This test verifies that when a skill uses a DI token for component definition,
 * the component is properly resolved from the container and its tools are available.
 */

describe('Skill with DI Token Components - DI Token Resolution', () => {
    let manager: SkillManager;
    let container: Container;

    beforeEach(() => {
        container = new Container();
        manager = new SkillManager();
        manager.setContainer(container);
    });

    describe('DI token resolution', () => {
        it('should resolve DI token and load tools from component', async () => {
            // Bind PicosComponent to the container
            container.bind<PicosComponent>(TYPES.PicosComponent).to(PicosComponent);

            // Create a skill that uses DI token for component
            const skillWithDIToken: Skill = defineSkill({
                name: 'test-di-token',
                displayName: 'Test DI Token',
                description: 'A test skill with DI token component',
                version: '1.0.0',
                capabilities: ['Test capability'],
                workDirection: 'Test direction',
                components: [
                    createComponentDefinition(
                        'pico-templater',
                        'PICO Templater',
                        'A PICO templater component',
                        TYPES.PicosComponent // Use DI token
                    )
                ]
            });

            manager.register(skillWithDIToken);

            // Activate the skill
            const result = await manager.activateSkill('test-di-token');
            console.log('Activation result:', result);

            // Check that component was resolved
            const component = manager.getComponent('pico-templater');
            expect(component).toBeDefined();
            expect(component).toBeInstanceOf(PicosComponent);

            // Check that skill has tools after activation
            const tools = manager.getActiveTools();
            console.log('Active tools after activation:', tools);

            // PicosComponent should have tools
            expect(tools.length).toBeGreaterThan(0);
        });

        it('should handle missing DI token gracefully', async () => {
            // Create a skill that uses DI token for component
            // but don't bind it to the container
            const skillWithDIToken: Skill = defineSkill({
                name: 'test-missing-di-token',
                displayName: 'Test Missing DI Token',
                description: 'A test skill with missing DI token component',
                version: '1.0.0',
                capabilities: ['Test capability'],
                workDirection: 'Test direction',
                components: [
                    createComponentDefinition(
                        'missing-component',
                        'Missing Component',
                        'A component that is not bound',
                        Symbol('MissingToken') // Use unbound DI token
                    )
                ]
            });

            manager.register(skillWithDIToken);

            // Activate the skill - should not throw
            const result = await manager.activateSkill('test-missing-di-token');
            console.log('Activation result for missing token:', result);

            // Activation should succeed even if component resolution fails
            expect(result.success).toBe(true);

            // Component should not be available
            const component = manager.getComponent('missing-component');
            expect(component).toBeUndefined();
        });

        it('should handle container-less SkillManager gracefully', async () => {
            // Create a SkillManager without container
            const managerWithoutContainer = new SkillManager();

            // Create a skill that uses DI token for component
            const skillWithDIToken: Skill = defineSkill({
                name: 'test-no-container',
                displayName: 'Test No Container',
                description: 'A test skill with DI token but no container',
                version: '1.0.0',
                capabilities: ['Test capability'],
                workDirection: 'Test direction',
                components: [
                    createComponentDefinition(
                        'pico-templater',
                        'PICO Templater',
                        'A PICO templater component',
                        TYPES.PicosComponent // Use DI token
                    )
                ]
            });

            managerWithoutContainer.register(skillWithDIToken);

            // Activate the skill - should not throw
            const result = await managerWithoutContainer.activateSkill('test-no-container');
            console.log('Activation result without container:', result);

            // Activation should succeed even if container is not available
            expect(result.success).toBe(true);

            // Component should not be available
            const component = managerWithoutContainer.getComponent('pico-templater');
            expect(component).toBeUndefined();
        });
    });
});
