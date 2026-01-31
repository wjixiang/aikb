import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { KnowledgeManageComponent, Document, Entity, SearchResult } from '../knowledgeManageComponent';
import * as z from 'zod';

describe('KnowledgeManageComponent', () => {
    let component: KnowledgeManageComponent;

    beforeEach(() => {
        // Reset environment
        (process.env as any)['WIKI_SERVICE_URL'] = 'http://localhost:3001';

        // Create component
        component = new KnowledgeManageComponent();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with toolSet', () => {
            expect(component.toolSet).toBeInstanceOf(Map);
            expect(component.toolSet.size).toBeGreaterThan(0);
        });

        it('should have renderImply method', () => {
            expect(typeof component.renderImply).toBe('function');
        });

        it('should have handleToolCall method', () => {
            expect(typeof component.handleToolCall).toBe('function');
        });
    });

    describe('Tool Definitions', () => {
        it('should have fetchDocuments tool', () => {
            const tool = component.toolSet.get('fetchDocuments');
            expect(tool).toBeDefined();
            expect(tool?.toolName).toBe('fetchDocuments');
        });

        it('should have selectDocument tool', () => {
            const tool = component.toolSet.get('selectDocument');
            expect(tool).toBeDefined();
            expect(tool?.toolName).toBe('selectDocument');
        });

        it('should have createDocument tool', () => {
            const tool = component.toolSet.get('createDocument');
            expect(tool).toBeDefined();
            expect(tool?.toolName).toBe('createDocument');
        });

        it('should have updateDocument tool', () => {
            const tool = component.toolSet.get('updateDocument');
            expect(tool).toBeDefined();
            expect(tool?.toolName).toBe('updateDocument');
        });

        it('should have deleteDocument tool', () => {
            const tool = component.toolSet.get('deleteDocument');
            expect(tool).toBeDefined();
            expect(tool?.toolName).toBe('deleteDocument');
        });

        it('should have filterDocuments tool', () => {
            const tool = component.toolSet.get('filterDocuments');
            expect(tool).toBeDefined();
            expect(tool?.toolName).toBe('filterDocuments');
        });

        it('should have sortDocuments tool', () => {
            const tool = component.toolSet.get('sortDocuments');
            expect(tool).toBeDefined();
            expect(tool?.toolName).toBe('sortDocuments');
        });

        it('should have searchDocuments tool', () => {
            const tool = component.toolSet.get('searchDocuments');
            expect(tool).toBeDefined();
            expect(tool?.toolName).toBe('searchDocuments');
        });

        it('should have fetchEntities tool', () => {
            const tool = component.toolSet.get('fetchEntities');
            expect(tool).toBeDefined();
            expect(tool?.toolName).toBe('fetchEntities');
        });

        it('should have filterEntities tool', () => {
            const tool = component.toolSet.get('filterEntities');
            expect(tool).toBeDefined();
            expect(tool?.toolName).toBe('filterEntities');
        });
    });

    describe('Tool Schemas', () => {
        it('should have valid fetchDocuments schema', () => {
            const tool = component.toolSet.get('fetchDocuments');
            expect(tool?.paramsSchema).toBeInstanceOf(z.ZodObject);
        });

        it('should have valid selectDocument schema', () => {
            const tool = component.toolSet.get('selectDocument');
            expect(tool?.paramsSchema).toBeInstanceOf(z.ZodObject);
        });

        it('should have valid createDocument schema', () => {
            const tool = component.toolSet.get('createDocument');
            expect(tool?.paramsSchema).toBeInstanceOf(z.ZodObject);
        });

        it('should have valid updateDocument schema', () => {
            const tool = component.toolSet.get('updateDocument');
            expect(tool?.paramsSchema).toBeInstanceOf(z.ZodObject);
        });

        it('should have valid deleteDocument schema', () => {
            const tool = component.toolSet.get('deleteDocument');
            expect(tool?.paramsSchema).toBeInstanceOf(z.ZodObject);
        });

        it('should have valid filterDocuments schema', () => {
            const tool = component.toolSet.get('filterDocuments');
            expect(tool?.paramsSchema).toBeInstanceOf(z.ZodObject);
        });

        it('should have valid sortDocuments schema', () => {
            const tool = component.toolSet.get('sortDocuments');
            expect(tool?.paramsSchema).toBeInstanceOf(z.ZodObject);
        });

        it('should have valid searchDocuments schema', () => {
            const tool = component.toolSet.get('searchDocuments');
            expect(tool?.paramsSchema).toBeInstanceOf(z.ZodObject);
        });

        it('should have valid fetchEntities schema', () => {
            const tool = component.toolSet.get('fetchEntities');
            expect(tool?.paramsSchema).toBeInstanceOf(z.ZodObject);
        });

        it('should have valid filterEntities schema', () => {
            const tool = component.toolSet.get('filterEntities');
            expect(tool?.paramsSchema).toBeInstanceOf(z.ZodObject);
        });
    });

    describe('Tool Descriptions', () => {
        it('should have descriptive fetchDocuments tool', () => {
            const tool = component.toolSet.get('fetchDocuments');
            expect(tool?.desc).toBeDefined();
            expect(tool?.desc).toContain('Fetch');
        });

        it('should have descriptive createDocument tool', () => {
            const tool = component.toolSet.get('createDocument');
            expect(tool?.desc).toBeDefined();
            expect(tool?.desc).toContain('Create');
        });

        it('should have descriptive updateDocument tool', () => {
            const tool = component.toolSet.get('updateDocument');
            expect(tool?.desc).toBeDefined();
            expect(tool?.desc).toContain('Update');
        });

        it('should have descriptive deleteDocument tool', () => {
            const tool = component.toolSet.get('deleteDocument');
            expect(tool?.desc).toBeDefined();
            expect(tool?.desc).toContain('Delete');
        });

        it('should have descriptive searchDocuments tool', () => {
            const tool = component.toolSet.get('searchDocuments');
            expect(tool?.desc).toBeDefined();
            expect(tool?.desc).toContain('Search');
        });
    });

    describe('Rendering', () => {
        it('should render component as TUIElement array', async () => {
            const rendered = await component.render();
            expect(Array.isArray(rendered)).toBe(true);
        });

        it('should render with tool section', async () => {
            const rendered = await component.render();
            expect(rendered.length).toBeGreaterThan(0);
        });
    });

    describe('Tool Call Handling', () => {
        it('should handle fetchDocuments tool call', async () => {
            await expect(component.handleToolCall('fetchDocuments', {})).resolves.not.toThrow();
        });

        it('should handle fetchEntities tool call', async () => {
            await expect(component.handleToolCall('fetchEntities', {})).resolves.not.toThrow();
        });

        it('should handle unknown tool call gracefully', async () => {
            await expect(component.handleToolCall('unknownTool', {})).resolves.not.toThrow();
        });
    });

    describe('Integration Tests', () => {
        it('should render with all sections', async () => {
            const rendered = await component.render();
            expect(Array.isArray(rendered)).toBe(true);
            expect(rendered.length).toBeGreaterThan(0);
        });
    });
});
