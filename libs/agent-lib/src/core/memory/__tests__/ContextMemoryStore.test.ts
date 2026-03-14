/**
 * Tests for ContextMemoryStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextMemoryStore } from '../ContextMemoryStore';

describe('ContextMemoryStore', () => {
    let store: ContextMemoryStore;

    beforeEach(() => {
        store = new ContextMemoryStore();
    });

    describe('storeContext', () => {
        it('should store a context snapshot', () => {
            const context = 'Test workspace context';
            const snapshot = store.storeContext(context, ['tool1', 'tool2']);

            expect(snapshot.id).toBeDefined();
            expect(snapshot.turnNumber).toBe(1);
            expect(snapshot.fullContext).toBe(context);
            expect(snapshot.toolCalls).toEqual(['tool1', 'tool2']);
            expect(snapshot.tokenCount).toBeGreaterThan(0);
        });

        it('should increment turn number for each context', () => {
            const snapshot1 = store.storeContext('Context 1');
            const snapshot2 = store.storeContext('Context 2');
            const snapshot3 = store.storeContext('Context 3');

            expect(snapshot1.turnNumber).toBe(1);
            expect(snapshot2.turnNumber).toBe(2);
            expect(snapshot3.turnNumber).toBe(3);
        });
    });

    describe('storeSummary', () => {
        it('should store a summary for a context', () => {
            const snapshot = store.storeContext('Test context');
            const summary = store.storeSummary(
                snapshot.id,
                'Test summary',
                ['insight1', 'insight2']
            );

            expect(summary.id).toBe(`sum_${snapshot.id}`);
            expect(summary.contextId).toBe(snapshot.id);
            expect(summary.summary).toBe('Test summary');
            expect(summary.insights).toEqual(['insight1', 'insight2']);
        });

        it('should update context with summary reference', () => {
            const snapshot = store.storeContext('Test context');
            store.storeSummary(snapshot.id, 'Test summary', []);

            const retrieved = store.getContext(snapshot.id);
            expect(retrieved?.summary).toBe('Test summary');
        });

        it('should throw error for non-existent context', () => {
            expect(() => {
                store.storeSummary('invalid-id', 'Summary', []);
            }).toThrow('Context invalid-id not found');
        });
    });

    describe('getContext', () => {
        it('should retrieve context by ID', () => {
            const snapshot = store.storeContext('Test context');
            const retrieved = store.getContext(snapshot.id);

            expect(retrieved).toEqual(snapshot);
        });

        it('should return undefined for non-existent ID', () => {
            const retrieved = store.getContext('invalid-id');
            expect(retrieved).toBeUndefined();
        });
    });

    describe('getContextByTurn', () => {
        it('should retrieve context by turn number', () => {
            store.storeContext('Context 1');
            const snapshot2 = store.storeContext('Context 2');
            store.storeContext('Context 3');

            const retrieved = store.getContextByTurn(2);
            expect(retrieved).toEqual(snapshot2);
        });

        it('should return undefined for non-existent turn', () => {
            const retrieved = store.getContextByTurn(999);
            expect(retrieved).toBeUndefined();
        });
    });

    describe('getAllSummaries', () => {
        it('should return all summaries in chronological order', () => {
            const ctx1 = store.storeContext('Context 1');
            const ctx2 = store.storeContext('Context 2');
            const ctx3 = store.storeContext('Context 3');

            store.storeSummary(ctx1.id, 'Summary 1', []);
            store.storeSummary(ctx3.id, 'Summary 3', []);
            store.storeSummary(ctx2.id, 'Summary 2', []);

            const summaries = store.getAllSummaries();

            expect(summaries).toHaveLength(3);
            expect(summaries[0].turnNumber).toBe(1);
            expect(summaries[1].turnNumber).toBe(2);
            expect(summaries[2].turnNumber).toBe(3);
        });
    });

    describe('getRecentSummaries', () => {
        it('should return last N summaries', () => {
            for (let i = 1; i <= 10; i++) {
                const ctx = store.storeContext(`Context ${i}`);
                store.storeSummary(ctx.id, `Summary ${i}`, []);
            }

            const recent = store.getRecentSummaries(3);

            expect(recent).toHaveLength(3);
            expect(recent[0].turnNumber).toBe(8);
            expect(recent[1].turnNumber).toBe(9);
            expect(recent[2].turnNumber).toBe(10);
        });

        it('should return all summaries if count exceeds total', () => {
            const ctx1 = store.storeContext('Context 1');
            const ctx2 = store.storeContext('Context 2');

            store.storeSummary(ctx1.id, 'Summary 1', []);
            store.storeSummary(ctx2.id, 'Summary 2', []);

            const recent = store.getRecentSummaries(10);

            expect(recent).toHaveLength(2);
        });
    });

    describe('searchSummaries', () => {
        beforeEach(() => {
            const ctx1 = store.storeContext('Context 1');
            const ctx2 = store.storeContext('Context 2');
            const ctx3 = store.storeContext('Context 3');

            store.storeSummary(ctx1.id, 'Found performance issue', ['performance']);
            store.storeSummary(ctx2.id, 'Fixed the bug', ['bugfix']);
            store.storeSummary(ctx3.id, 'Optimized performance', ['performance', 'optimization']);
        });

        it('should find summaries by keyword in summary text', () => {
            const results = store.searchSummaries('performance');

            expect(results).toHaveLength(2);
            expect(results[0].turnNumber).toBe(1);
            expect(results[1].turnNumber).toBe(3);
        });

        it('should find summaries by keyword in insights', () => {
            const results = store.searchSummaries('bugfix');

            expect(results).toHaveLength(1);
            expect(results[0].turnNumber).toBe(2);
        });

        it('should be case-insensitive', () => {
            const results = store.searchSummaries('PERFORMANCE');

            expect(results).toHaveLength(2);
        });

        it('should return empty array for no matches', () => {
            const results = store.searchSummaries('nonexistent');

            expect(results).toHaveLength(0);
        });
    });

    describe('getTotalSummaryTokens', () => {
        it('should calculate total tokens across all summaries', () => {
            const ctx1 = store.storeContext('Context 1');
            const ctx2 = store.storeContext('Context 2');

            store.storeSummary(ctx1.id, 'Short summary', []);
            store.storeSummary(ctx2.id, 'Another short summary', []);

            const total = store.getTotalSummaryTokens();

            expect(total).toBeGreaterThan(0);
        });
    });

    describe('export and import', () => {
        it('should export and import memory state', () => {
            // Create some data
            const ctx1 = store.storeContext('Context 1', ['tool1']);
            const ctx2 = store.storeContext('Context 2', ['tool2']);
            store.storeSummary(ctx1.id, 'Summary 1', ['insight1']);
            store.storeSummary(ctx2.id, 'Summary 2', ['insight2']);

            // Export
            const exported = store.export();

            // Create new store and import
            const newStore = new ContextMemoryStore();
            newStore.import(exported);

            // Verify
            expect(newStore.getCurrentTurn()).toBe(2);
            expect(newStore.getAllSummaries()).toHaveLength(2);
            expect(newStore.getContextByTurn(1)?.fullContext).toBe('Context 1');
            expect(newStore.getContextByTurn(2)?.fullContext).toBe('Context 2');
        });

        it('should clear existing data on import', () => {
            // Create initial data
            const ctx1 = store.storeContext('Context 1');
            store.storeSummary(ctx1.id, 'Summary 1', []);

            // Export
            const exported = store.export();

            // Add more data
            const ctx2 = store.storeContext('Context 2');
            store.storeSummary(ctx2.id, 'Summary 2', []);

            // Import should clear and restore
            store.import(exported);

            expect(store.getCurrentTurn()).toBe(1);
            expect(store.getAllSummaries()).toHaveLength(1);
        });
    });

    describe('clear', () => {
        it('should clear all data', () => {
            const ctx1 = store.storeContext('Context 1');
            store.storeSummary(ctx1.id, 'Summary 1', []);

            store.clear();

            expect(store.getCurrentTurn()).toBe(0);
            expect(store.getAllSummaries()).toHaveLength(0);
            expect(store.getContext(ctx1.id)).toBeUndefined();
        });
    });
});
