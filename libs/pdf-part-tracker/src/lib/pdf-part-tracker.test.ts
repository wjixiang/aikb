import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PdfPartTracker } from './pdf-part-tracker-impl';
import { PdfPartTrackerFactory } from './pdf-part-tracker-factory';
import { IPdfPartTracker } from './pdf-part-tracker.interface';

describe('PdfPartTracker', () => {
  let tracker: IPdfPartTracker;

  beforeEach(() => {
    tracker = new PdfPartTracker();
  });

  afterEach(() => {
    PdfPartTrackerFactory.resetInstance();
  });

  it('should initialize tracking for a PDF', async () => {
    const trackingId = await tracker.initializeTracking('test-pdf-123', 5);

    expect(trackingId).toBeDefined();
    expect(typeof trackingId).toBe('string');

    const progress = await tracker.getTrackingProgress(trackingId);
    expect(progress.totalParts).toBe(5);
    expect(progress.completedParts).toBe(0);
    expect(progress.isComplete).toBe(false);
    expect(progress.completedPartNumbers).toEqual([]);
  });

  it('should mark parts as completed', async () => {
    const trackingId = await tracker.initializeTracking('test-pdf-123', 3);

    // Mark first part as completed
    const result1 = await tracker.markPartCompleted(trackingId, 1, {
      content: 'Part 1 content',
    });
    expect(result1).toBe(true);

    let progress = await tracker.getTrackingProgress(trackingId);
    expect(progress.completedParts).toBe(1);
    expect(progress.completedPartNumbers).toEqual([1]);
    expect(progress.isComplete).toBe(false);

    // Mark second part as completed
    const result2 = await tracker.markPartCompleted(trackingId, 2, {
      content: 'Part 2 content',
    });
    expect(result2).toBe(true);

    progress = await tracker.getTrackingProgress(trackingId);
    expect(progress.completedParts).toBe(2);
    expect(progress.completedPartNumbers).toEqual([1, 2]);
    expect(progress.isComplete).toBe(false);

    // Mark third part as completed
    const result3 = await tracker.markPartCompleted(trackingId, 3, {
      content: 'Part 3 content',
    });
    expect(result3).toBe(true);

    progress = await tracker.getTrackingProgress(trackingId);
    expect(progress.completedParts).toBe(3);
    expect(progress.completedPartNumbers).toEqual([1, 2, 3]);
    expect(progress.isComplete).toBe(true);
  });

  it('should not mark the same part twice', async () => {
    const trackingId = await tracker.initializeTracking('test-pdf-123', 2);

    const result1 = await tracker.markPartCompleted(trackingId, 1, {
      content: 'Part 1 content',
    });
    expect(result1).toBe(true);

    const result2 = await tracker.markPartCompleted(trackingId, 1, {
      content: 'Part 1 content again',
    });
    expect(result2).toBe(false);

    const progress = await tracker.getTrackingProgress(trackingId);
    expect(progress.completedParts).toBe(1);
    expect(progress.completedPartNumbers).toEqual([1]);
  });

  it('should return completed parts data', async () => {
    const trackingId = await tracker.initializeTracking('test-pdf-123', 2);

    await tracker.markPartCompleted(trackingId, 1, {
      content: 'Part 1 content',
    });
    await tracker.markPartCompleted(trackingId, 2, {
      content: 'Part 2 content',
    });

    const completedParts = await tracker.getCompletedParts(trackingId);
    expect(completedParts).toHaveLength(2);
    expect(completedParts[0].partNumber).toBe(1);
    expect(completedParts[0].data).toEqual({ content: 'Part 1 content' });
    expect(completedParts[1].partNumber).toBe(2);
    expect(completedParts[1].data).toEqual({ content: 'Part 2 content' });
  });

  it('should handle cleanup', async () => {
    const trackingId = await tracker.initializeTracking('test-pdf-123', 2);

    await tracker.markPartCompleted(trackingId, 1, {
      content: 'Part 1 content',
    });

    const cleanupResult = await tracker.cleanupTracking(trackingId);
    expect(cleanupResult).toBe(true);

    // Should throw error when trying to get progress for cleaned up tracking
    await expect(tracker.getTrackingProgress(trackingId)).rejects.toThrow();
  });

  it('should handle non-existent tracking IDs', async () => {
    const result1 = await tracker.markPartCompleted('non-existent-id', 1);
    expect(result1).toBe(false);

    const result2 = await tracker.isTrackingComplete('non-existent-id');
    expect(result2).toBe(false);

    const result3 = await tracker.cleanupTracking('non-existent-id');
    expect(result3).toBe(false);

    await expect(
      tracker.getTrackingProgress('non-existent-id'),
    ).rejects.toThrow();
    await expect(
      tracker.getCompletedParts('non-existent-id'),
    ).rejects.toThrow();
  });
});

describe('PdfPartTrackerFactory', () => {
  afterEach(() => {
    PdfPartTrackerFactory.resetInstance();
  });

  it('should create in-memory tracker by default', () => {
    const tracker = PdfPartTrackerFactory.getInstance();
    expect(tracker).toBeInstanceOf(PdfPartTracker);
  });

  it('should create in-memory tracker when specified', () => {
    const tracker = PdfPartTrackerFactory.createTracker('memory');
    expect(tracker).toBeInstanceOf(PdfPartTracker);
  });

  it('should return singleton instance', () => {
    const tracker1 = PdfPartTrackerFactory.getInstance();
    const tracker2 = PdfPartTrackerFactory.getInstance();
    expect(tracker1).toBe(tracker2);
  });

  it('should reset singleton instance', () => {
    const tracker1 = PdfPartTrackerFactory.getInstance();
    PdfPartTrackerFactory.resetInstance();
    const tracker2 = PdfPartTrackerFactory.getInstance();
    expect(tracker1).not.toBe(tracker2);
  });

  it('should return tracker type', () => {
    expect(PdfPartTrackerFactory.getTrackerType()).toBe('memory');
  });
});
