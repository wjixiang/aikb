import { ToolResultOffloader, PERSISTED_OUTPUT_TAG, PERSISTED_OUTPUT_CLOSING_TAG } from '../toolResultOffloader';
import type { IPersistenceService } from '../../persistence/types.js';

function createMockPersistenceService(): IPersistenceService {
  return {
    saveToolResultBlob: vi.fn().mockImplementation(async (_instanceId: string, _toolUseId: string, _toolName: string, content: string) => {
      return {
        preview: content.substring(0, 100),
        originalSize: content.length,
      };
    }),
    getToolResultBlob: vi.fn().mockResolvedValue(null),
    deleteToolResultBlob: vi.fn().mockResolvedValue(undefined),
    getToolResultBlobs: vi.fn().mockResolvedValue(new Map()),
    saveMemory: vi.fn().mockResolvedValue(undefined),
    loadMemory: vi.fn().mockResolvedValue(null),
    saveInstanceMetadata: vi.fn().mockResolvedValue(undefined),
    getInstanceMetadata: vi.fn().mockResolvedValue(null),
    updateInstanceMetadata: vi.fn().mockResolvedValue(undefined),
    saveComponentState: vi.fn().mockResolvedValue(undefined),
    getComponentState: vi.fn().mockResolvedValue(null),
    getAllComponentStates: vi.fn().mockResolvedValue({}),
    deleteComponentState: vi.fn().mockResolvedValue(undefined),
    saveExportResult: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ToolResultOffloader', () => {
  const instanceId = 'test-instance-123';

  describe('processResult', () => {
    it('should return original content when under threshold', async () => {
      const persistenceService = createMockPersistenceService();
      const offloader = new ToolResultOffloader(persistenceService, instanceId);
      const content = 'small result';
      
      const result = await offloader.processResult('tool-1', 'ReadFile', content);
      
      expect(result.content).toBe(content);
      expect(result.wasPersisted).toBe(false);
    });

    it('should persist content when over threshold', async () => {
      const persistenceService = createMockPersistenceService();
      const offloader = new ToolResultOffloader(persistenceService, instanceId);
      const largeContent = 'x'.repeat(60000);
      
      const result = await offloader.processResult('tool-2', 'ReadFile', largeContent);
      
      expect(result.wasPersisted).toBe(true);
      expect(result.originalSize).toBe(60000);
      expect(result.content).toContain(PERSISTED_OUTPUT_TAG);
      expect(result.content).toContain(PERSISTED_OUTPUT_CLOSING_TAG);
      expect(result.content).toContain('ReadFile');
      expect(persistenceService.saveToolResultBlob).toHaveBeenCalledWith(
        instanceId,
        'tool-2',
        'ReadFile',
        largeContent,
      );
    });

    it('should return cached result for same toolUseId', async () => {
      const persistenceService = createMockPersistenceService();
      const offloader = new ToolResultOffloader(persistenceService, instanceId);
      const largeContent = 'x'.repeat(60000);
      
      // First call - persists
      const result1 = await offloader.processResult('tool-3', 'ReadFile', largeContent);
      expect(result1.wasPersisted).toBe(true);
      
      // Second call with same ID - should return cached
      const result2 = await offloader.processResult('tool-3', 'ReadFile', 'different content');
      expect(result2.content).toBe(result1.content);
      expect(persistenceService.saveToolResultBlob).toHaveBeenCalledTimes(1);
    });

    it('should handle persistence failure gracefully', async () => {
      const persistenceService = createMockPersistenceService();
      (persistenceService.saveToolResultBlob as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB error'));
      const offloader = new ToolResultOffloader(persistenceService, instanceId);
      const largeContent = 'x'.repeat(60000);
      
      const result = await offloader.processResult('tool-4', 'ReadFile', largeContent);
      
      expect(result.wasPersisted).toBe(false);
      expect(result.content).toBe(largeContent);
    });

    it('should work without persistence service', async () => {
      const offloader = new ToolResultOffloader(undefined, instanceId);
      const largeContent = 'x'.repeat(60000);
      
      const result = await offloader.processResult('tool-5', 'ReadFile', largeContent);
      
      expect(result.wasPersisted).toBe(false);
      expect(result.content).toBe(largeContent);
    });

    it('should handle exact threshold content', async () => {
      const persistenceService = createMockPersistenceService();
      const offloader = new ToolResultOffloader(persistenceService, instanceId);
      const exactContent = 'x'.repeat(50000);
      
      const result = await offloader.processResult('tool-6', 'ReadFile', exactContent);
      
      expect(result.wasPersisted).toBe(false);
      expect(result.content).toBe(exactContent);
    });
  });

  describe('preview message format', () => {
    it('should include tool name and size in preview', async () => {
      const persistenceService = createMockPersistenceService();
      const offloader = new ToolResultOffloader(persistenceService, instanceId);
      const largeContent = 'x'.repeat(100000);
      
      const result = await offloader.processResult('tool-7', 'BashTool', largeContent);
      
      expect(result.content).toContain('Tool "BashTool"');
      expect(result.content).toContain('97.7KB');
      expect(result.content).toContain('Preview');
    });
  });

  describe('state management', () => {
    it('should export and restore state correctly', async () => {
      const persistenceService = createMockPersistenceService();
      const offloader = new ToolResultOffloader(persistenceService, instanceId);
      const largeContent = 'x'.repeat(60000);
      
      await offloader.processResult('tool-state', 'ReadFile', largeContent);
      
      const state = offloader.getState();
      expect(state.seenIds).toContain('tool-state');
      expect(state.replacements['tool-state']).toBeDefined();
      expect(state.replacements['tool-state']).toContain(PERSISTED_OUTPUT_TAG);
      
      // Restore into new offloader
      const newOffloader = new ToolResultOffloader(persistenceService, instanceId);
      newOffloader.restoreState(state);
      
      // Same toolUseId should return cached result
      const cachedResult = await newOffloader.processResult('tool-state', 'ReadFile', 'new content');
      expect(cachedResult.content).toBe(state.replacements['tool-state']);
      expect(persistenceService.saveToolResultBlob).toHaveBeenCalledTimes(1); // Only first call
    });

    it('should handle empty state restore', () => {
      const persistenceService = createMockPersistenceService();
      const offloader = new ToolResultOffloader(persistenceService, instanceId);
      
      offloader.restoreState({ seenIds: [], replacements: {} });
      
      const state = offloader.getState();
      expect(state.seenIds).toEqual([]);
      expect(state.replacements).toEqual({});
    });
  });

  describe('threshold configuration', () => {
    it('should use custom threshold when provided', async () => {
      const persistenceService = createMockPersistenceService();
      const offloader = new ToolResultOffloader(persistenceService, instanceId, {
        maxResultSizeChars: 1000,
      });
      
      // 2000 chars > 1000 threshold
      const result = await offloader.processResult('tool-custom', 'Test', 'x'.repeat(2000));
      
      expect(result.wasPersisted).toBe(true);
      expect(result.originalSize).toBe(2000);
    });
  });
});
