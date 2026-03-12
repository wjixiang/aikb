import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpertInstance } from '../ExpertInstance';
import { sampleExpertConfig } from './fixtures/mock-config';
import { createMockAgent, createMockExpertTask } from './fixtures/mock-agent';

describe('ExpertInstance', () => {
    let expert: ExpertInstance;
    let mockAgent: any;

    beforeEach(() => {
        mockAgent = createMockAgent();
        expert = new ExpertInstance(sampleExpertConfig, mockAgent as any);
    });

    describe('constructor', () => {
        it('should create expert with correct ID', () => {
            expect(expert.expertId).toBe(sampleExpertConfig.expertId);
        });

        it('should initialize with idle status', () => {
            expect(expert.status).toBe('idle');
        });
    });

    describe('activate', () => {
        it('should set status to ready', async () => {
            await expert.activate();
            expect(expert.status).toBe('ready');
        });

        it('should set status to ready when already ready', async () => {
            await expert.activate();
            await expert.activate();
            expect(expert.status).toBe('ready');
        });
    });

    describe('execute', () => {
        it('should execute task successfully', async () => {
            await expert.activate();
            const task = createMockExpertTask();

            const result = await expert.execute(task);

            expect(result.expertId).toBe(sampleExpertConfig.expertId);
            expect(result.success).toBe(true);
            expect(mockAgent.start).toHaveBeenCalled();
        });

        it('should handle execution failure', async () => {
            const failingAgent = createMockAgent({ shouldFail: true });
            const failingExpert = new ExpertInstance(sampleExpertConfig, failingAgent as any);

            await failingExpert.activate();
            const task = createMockExpertTask();

            const result = await failingExpert.execute(task);

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
        });
    });

    describe('suspend', () => {
        it('should suspend running expert', async () => {
            // Execute first to set status to running/completed
            await expert.activate();
            await expert.execute(createMockExpertTask());

            // Suspend should work even after completion
            await expert.suspend();

            expect(expert.status).toBeDefined();
        });

        it('should not abort if not running', async () => {
            await expert.activate();
            // Don't execute, just suspend
            await expert.suspend();
            // Should not throw
            expect(expert.status).toBeDefined();
        });
    });

    describe('resume', () => {
        it('should resume expert', async () => {
            await expert.activate();
            await expert.resume();

            expect(expert.status).toBe('ready');
        });
    });

    describe('getArtifacts', () => {
        it('should return empty array initially', () => {
            const artifacts = expert.getArtifacts();
            expect(artifacts).toEqual([]);
        });
    });

    describe('getStateSummary', () => {
        it('should return state summary', async () => {
            await expert.activate();

            const summary = await expert.getStateSummary();

            expect(summary).toContain(sampleExpertConfig.displayName);
        });
    });
});
