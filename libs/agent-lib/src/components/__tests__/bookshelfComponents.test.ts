/**
 * BookshelfComponents Tests
 *
 * Unit tests for BookViewerComponent and WorkspaceInfoComponent.
 * Note: These tests focus on component logic. The Apollo client-dependent
 * functionality is tested in integrated tests with a real service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkspaceInfoComponent } from '../bookshelfComponents';

// Mock environment
const originalEnv = process.env;

describe('WorkspaceInfoComponent', () => {
  let component: WorkspaceInfoComponent;

  beforeEach(() => {
    component = new WorkspaceInfoComponent();
    process.env = { ...originalEnv };
  });

  describe('constructor', () => {
    it('should create WorkspaceInfoComponent instance', () => {
      expect(component).toBeInstanceOf(WorkspaceInfoComponent);
    });

    it('should have correct toolSet', () => {
      expect(component.toolSet.has('updateTimestamp')).toBe(true);
    });
  });

  describe('renderImply', () => {
    it('should render workspace info', async () => {
      const result = await component.renderImply();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should render without errors', async () => {
      const result = await component.renderImply();

      // Should render successfully
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('handleToolCall', () => {
    it('should handle updateTimestamp tool call', async () => {
      const beforeUpdate = new Date().toISOString();

      const result = await component.handleToolCall('updateTimestamp', {});

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('timestamp');
      expect(result.summary).toContain('更新时间戳');
    });

    it('should return error for unknown tool', async () => {
      const result = await component.handleToolCall('unknownTool', {});

      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('error');
      expect(result.data.error).toContain('Unknown tool');
    });
  });

  describe('exportData', () => {
    it('should export component data', async () => {
      const result = await component.exportData();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('format');
      expect(result).toHaveProperty('metadata');
      expect(result.format).toBe('json');
      expect(result.data).toHaveProperty('lastUpdated');
    });

    it('should respect export format option', async () => {
      const result = await component.exportData({ format: 'xml' });

      expect(result.format).toBe('xml');
    });

    it('should include componentId in metadata', async () => {
      const result = await component.exportData();

      expect(result.metadata).toHaveProperty('componentId');
      expect(result.metadata.componentId).toBe('workspace-info');
    });
  });
});

describe('WorkspaceInfoComponent State', () => {
  it('should initialize with current timestamp', async () => {
    const component = new WorkspaceInfoComponent();
    const result = await component.exportData();

    expect(result.data).toBeDefined();
    expect(result.data.lastUpdated).toBeDefined();
    expect(typeof result.data.lastUpdated).toBe('string');
  });

  it('should update timestamp on updateTimestamp call', async () => {
    const component = new WorkspaceInfoComponent();
    const beforeResult = await component.exportData();
    const beforeTimestamp = beforeResult.data.lastUpdated;

    // Wait a tiny bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    await component.handleToolCall('updateTimestamp', {});

    const afterResult = await component.exportData();
    const afterTimestamp = afterResult.data.lastUpdated;

    expect(afterTimestamp).toBeDefined();
    expect(afterTimestamp).not.toBe(beforeTimestamp);
  });
});
