/**
 * KnowledgeManageComponent Tests
 *
 * Unit tests for KnowledgeManageComponent.
 * Note: These tests focus on component logic that doesn't require external services.
 * The Apollo client-dependent functionality is tested in integrated tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnowledgeManageComponent } from '../knowledgeManageComponent';

// Mock environment
const originalEnv = process.env;

describe('KnowledgeManageComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.WIKI_SERVICE_URL = 'http://localhost:3000';
  });

  describe('constructor', () => {
    it('should create KnowledgeManageComponent instance', () => {
      const component = new KnowledgeManageComponent();
      expect(component).toBeInstanceOf(KnowledgeManageComponent);
    });

    it('should have all required tools defined', () => {
      const component = new KnowledgeManageComponent();
      expect(component.toolSet.has('fetchDocuments')).toBe(true);
      expect(component.toolSet.has('selectDocument')).toBe(true);
      expect(component.toolSet.has('createDocument')).toBe(true);
      expect(component.toolSet.has('updateDocument')).toBe(true);
      expect(component.toolSet.has('deleteDocument')).toBe(true);
      expect(component.toolSet.has('filterDocuments')).toBe(true);
      expect(component.toolSet.has('sortDocuments')).toBe(true);
      expect(component.toolSet.has('searchDocuments')).toBe(true);
      expect(component.toolSet.has('fetchEntities')).toBe(true);
      expect(component.toolSet.has('filterEntities')).toBe(true);
    });

    it('should have correct tool definitions', () => {
      const component = new KnowledgeManageComponent();

      // Verify tool schemas exist
      const fetchDocsTool = component.toolSet.get('fetchDocuments');
      expect(fetchDocsTool).toBeDefined();
      expect(fetchDocsTool?.toolName).toBe('fetchDocuments');
      expect(fetchDocsTool?.desc).toContain('Fetch');

      const createDocTool = component.toolSet.get('createDocument');
      expect(createDocTool).toBeDefined();
      expect(createDocTool?.toolName).toBe('createDocument');
    });
  });

  describe('renderImply', () => {
    it('should render component', async () => {
      const component = new KnowledgeManageComponent();
      const result = await component.renderImply();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should render without errors', async () => {
      const component = new KnowledgeManageComponent();
      const result = await component.renderImply();

      // Should render successfully
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('handleToolCall - unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const component = new KnowledgeManageComponent();

      const result = await component.handleToolCall('unknownTool', {});

      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('error');
      expect(result.data.error).toContain('Unknown tool');
    });

    it('should return error with correct summary', async () => {
      const component = new KnowledgeManageComponent();

      const result = await component.handleToolCall('unknownTool', {});

      expect(result.summary).toContain('Unknown tool');
    });
  });

  describe('exportData', () => {
    it('should export component data', async () => {
      const component = new KnowledgeManageComponent();

      const result = await component.exportData();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('format');
      expect(result).toHaveProperty('metadata');
      expect(result.format).toBe('json');
      expect(result.metadata).toHaveProperty('componentId');
      expect(result.metadata).toHaveProperty('exportedAt');
    });

    it('should respect export format option', async () => {
      const component = new KnowledgeManageComponent();

      const result = await component.exportData({ format: 'xml' });

      expect(result.format).toBe('xml');
    });

    it('should include all internal state in export', async () => {
      const component = new KnowledgeManageComponent();

      const result = await component.exportData();

      expect(result.data).toHaveProperty('allDocuments');
      expect(result.data).toHaveProperty('allEntities');
      expect(result.data).toHaveProperty('selectedDocumentId');
      expect(result.data).toHaveProperty('currentDocument');
      expect(result.data).toHaveProperty('searchResults');
      expect(result.data).toHaveProperty('backlinks');
    });

    it('should export documents as array', async () => {
      const component = new KnowledgeManageComponent();

      const result = await component.exportData();

      expect(Array.isArray(result.data.allDocuments)).toBe(true);
    });

    it('should export entities as array', async () => {
      const component = new KnowledgeManageComponent();

      const result = await component.exportData();

      expect(Array.isArray(result.data.allEntities)).toBe(true);
    });

    it('should export searchResults as array', async () => {
      const component = new KnowledgeManageComponent();

      const result = await component.exportData();

      expect(Array.isArray(result.data.searchResults)).toBe(true);
    });

    it('should export backlinks as array', async () => {
      const component = new KnowledgeManageComponent();

      const result = await component.exportData();

      expect(Array.isArray(result.data.backlinks)).toBe(true);
    });
  });

  describe('tool parameter validation', () => {
    it('should have proper paramsSchema for createDocument', () => {
      const component = new KnowledgeManageComponent();
      const tool = component.toolSet.get('createDocument');

      expect(tool?.paramsSchema).toBeDefined();
      // Zod schema should have required fields
      const schema = tool?.paramsSchema as any;
      expect(schema._def.shape).toBeDefined();
    });

    it('should have proper paramsSchema for searchDocuments', () => {
      const component = new KnowledgeManageComponent();
      const tool = component.toolSet.get('searchDocuments');

      expect(tool?.paramsSchema).toBeDefined();
      const schema = tool?.paramsSchema as any;
      expect(schema._def.shape).toBeDefined();
    });

    it('should have proper paramsSchema for filterDocuments', () => {
      const component = new KnowledgeManageComponent();
      const tool = component.toolSet.get('filterDocuments');

      expect(tool?.paramsSchema).toBeDefined();
    });
  });
});

describe('KnowledgeManageComponent Tool Descriptions', () => {
  let component: KnowledgeManageComponent;

  beforeEach(() => {
    component = new KnowledgeManageComponent();
  });

  it('should have descriptive tool names', () => {
    const toolNames = Array.from(component.toolSet.keys());

    expect(toolNames).toContain('fetchDocuments');
    expect(toolNames).toContain('createDocument');
    expect(toolNames).toContain('updateDocument');
    expect(toolNames).toContain('deleteDocument');
    expect(toolNames).toContain('filterDocuments');
    expect(toolNames).toContain('sortDocuments');
    expect(toolNames).toContain('searchDocuments');
    expect(toolNames).toContain('fetchEntities');
    expect(toolNames).toContain('filterEntities');
  });

  it('should have descriptions for all tools', () => {
    for (const [name, tool] of component.toolSet) {
      expect(tool.desc).toBeDefined();
      expect(tool.desc.length).toBeGreaterThan(0);
      expect(tool.toolName).toBe(name);
    }
  });
});

describe('KnowledgeManageComponent Empty State', () => {
  it('should initialize with empty documents', async () => {
    const component = new KnowledgeManageComponent();
    const result = await component.exportData();

    expect(result.data.allDocuments).toEqual([]);
  });

  it('should initialize with empty entities', async () => {
    const component = new KnowledgeManageComponent();
    const result = await component.exportData();

    expect(result.data.allEntities).toEqual([]);
  });

  it('should initialize with null selectedDocumentId', async () => {
    const component = new KnowledgeManageComponent();
    const result = await component.exportData();

    expect(result.data.selectedDocumentId).toBeNull();
  });

  it('should initialize with null currentDocument', async () => {
    const component = new KnowledgeManageComponent();
    const result = await component.exportData();

    expect(result.data.currentDocument).toBeNull();
  });

  it('should initialize with empty searchResults', async () => {
    const component = new KnowledgeManageComponent();
    const result = await component.exportData();

    expect(result.data.searchResults).toEqual([]);
  });

  it('should initialize with empty backlinks', async () => {
    const component = new KnowledgeManageComponent();
    const result = await component.exportData();

    expect(result.data.backlinks).toEqual([]);
  });
});
