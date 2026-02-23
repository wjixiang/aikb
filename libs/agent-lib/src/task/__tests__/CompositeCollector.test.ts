/**
 * CompositeCollector Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CompositeCollector, createCompositeCollector } from '../collector/CompositeCollector.js';
import { TextCollector } from '../collector/TextCollector.js';
import { ToolCallCollector } from '../collector/ToolCallCollector.js';
import type { CollectionContext } from '../types.js';

describe('CompositeCollector', () => {
    let textCollector: TextCollector;
    let toolCallCollector: ToolCallCollector;
    let compositeCollector: CompositeCollector;

    beforeEach(() => {
        textCollector = new TextCollector();
        toolCallCollector = new ToolCallCollector();
        compositeCollector = new CompositeCollector({
            collectors: [textCollector, toolCallCollector],
            stopOnFirstSuccess: true,
        });
    });

    describe('type', () => {
        it('should have type "composite"', () => {
            expect(compositeCollector.type).toBe('composite');
        });
    });

    describe('canCollect', () => {
        it('should return true if any collector can collect', () => {
            expect(compositeCollector.canCollect('some text')).toBe(true);
            expect(compositeCollector.canCollect({ name: 'tool' })).toBe(true);
        });

        it('should return true for objects (tool call collector)', () => {
            expect(compositeCollector.canCollect({})).toBe(true);
        });

        it('should return true for strings (text collector)', () => {
            expect(compositeCollector.canCollect('text')).toBe(true);
        });
    });

    describe('collect with stopOnFirstSuccess=true', () => {
        beforeEach(() => {
            compositeCollector = new CompositeCollector({
                collectors: [textCollector, toolCallCollector],
                stopOnFirstSuccess: true,
            });
        });

        it('should use first matching collector', () => {
            const result = compositeCollector.collect('some text');

            expect(result.type).toBe('text');
            expect(result.data).toBe('some text');
        });

        it('should stop after first successful collection', () => {
            const result = compositeCollector.collect('text data');

            // Should use text collector (first in list)
            expect(result.type).toBe('text');
        });
    });

    describe('collect with stopOnFirstSuccess=false', () => {
        beforeEach(() => {
            compositeCollector = new CompositeCollector({
                collectors: [textCollector, toolCallCollector],
                stopOnFirstSuccess: false,
            });
        });

        it('should collect from all matching collectors', () => {
            const result = compositeCollector.collect('some text');

            expect(result.type).toBe('composite');
            expect(Array.isArray(result.data)).toBe(true);
            expect(result.data).toHaveLength(2); // Both collectors can handle strings
        });

        it('should include metadata about collector types', () => {
            const result = compositeCollector.collect('text');

            expect(result.metadata?.collectorTypes).toBeDefined();
            expect(Array.isArray(result.metadata?.collectorTypes)).toBe(true);
        });

        it('should include result count in metadata', () => {
            const result = compositeCollector.collect('text');

            expect(result.metadata?.resultCount).toBeDefined();
            expect(result.metadata?.resultCount).toBeGreaterThan(0);
        });
    });

    describe('collect with no matching collectors', () => {
        it('should return default result with error', () => {
            const collector = new CompositeCollector({
                collectors: [textCollector], // Only text collector
                stopOnFirstSuccess: true,
            });

            const result = collector.collect(123); // Number can't be collected by text collector

            expect(result.type).toBe('composite');
            expect(result.data).toBe(123);
            expect(result.metadata?.error).toBeDefined();
        });
    });

    describe('addCollector', () => {
        it('should add a new collector to the chain', () => {
            const newCollector = new TextCollector();
            const initialLength = (compositeCollector as any).collectors.length;

            compositeCollector.addCollector(newCollector);

            expect((compositeCollector as any).collectors.length).toBe(initialLength + 1);
        });
    });

    describe('removeCollector', () => {
        it('should remove a collector by type', () => {
            const initialLength = (compositeCollector as any).collectors.length;

            compositeCollector.removeCollector('text');

            expect((compositeCollector as any).collectors.length).toBe(initialLength - 1);
        });

        it('should do nothing if collector type not found', () => {
            const initialLength = (compositeCollector as any).collectors.length;

            compositeCollector.removeCollector('non-existent');

            expect((compositeCollector as any).collectors.length).toBe(initialLength);
        });
    });

    describe('createCompositeCollector factory', () => {
        it('should create with stopOnFirstSuccess=true by default', () => {
            const collector = createCompositeCollector([
                textCollector,
                toolCallCollector,
            ]);

            expect(collector).toBeInstanceOf(CompositeCollector);
            expect((collector as any).stopOnFirstSuccess).toBe(true);
        });

        it('should create with custom stopOnFirstSuccess', () => {
            const collector = createCompositeCollector(
                [textCollector, toolCallCollector],
                false
            );

            expect((collector as any).stopOnFirstSuccess).toBe(false);
        });
    });

    describe('collector order', () => {
        it('should try collectors in order', () => {
            // Text collector is first, should be used for strings
            const result = compositeCollector.collect('text');

            expect(result.type).toBe('text');
        });
    });
});
