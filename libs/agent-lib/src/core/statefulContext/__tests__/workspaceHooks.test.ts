/**
 * Workspace Hooks Tests
 *
 * Tests for the hook-based API for workspace global components
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualWorkspace } from '../virtualWorkspace.js';
import {
    createWorkspaceHooks,
    isHookableComponent,
} from '../workspaceHooks.js';
import { TestComponent } from './testComponents.js';

describe('Workspace Hooks API', () => {
    let workspace: VirtualWorkspace;

    beforeEach(() => {
        workspace = new VirtualWorkspace({
            id: 'hooks-test-workspace',
            name: 'Hooks Test Workspace',
        });
    });

    describe('createWorkspaceHooks', () => {
        it('should create workspace hooks', () => {
            const hooks = createWorkspaceHooks(workspace);
            expect(hooks).toBeDefined();
        });
    });

    describe('Type guards', () => {
        it('isHookableComponent should return true for components with handleToolCall', () => {
            const component = new TestComponent();
            expect(isHookableComponent(component as any)).toBe(true);
        });

        it('isHookableComponent should return false for undefined', () => {
            expect(isHookableComponent(undefined)).toBe(false);
        });
    });
});
