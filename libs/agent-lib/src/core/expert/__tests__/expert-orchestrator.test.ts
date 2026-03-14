import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpertOrchestrator } from '../ExpertOrchestrator';
import { ExpertExecutor } from '../ExpertExecutor';
import { ExpertRegistry } from '../ExpertRegistry';
import { sampleExpertConfigs } from './fixtures/mock-config';

describe('ExpertOrchestrator', () => {
    let registry: ExpertRegistry;
    let executor: ExpertExecutor;
    let orchestrator: ExpertOrchestrator;

    beforeEach(() => {
        registry = new ExpertRegistry();
        sampleExpertConfigs.forEach(config => registry.register(config));
        executor = new ExpertExecutor(registry);
        orchestrator = new ExpertOrchestrator(executor, registry);
    });

    describe('constructor', () => {
        it('should create orchestrator with executor and registry', () => {
            expect(orchestrator).toBeDefined();
        });
    });

    describe('listExperts', () => {
        it('should list all registered experts', () => {
            const experts = orchestrator.listExperts();
            expect(experts).toHaveLength(sampleExpertConfigs.length);
        });

        it('should return expert summaries with required fields', () => {
            const experts = orchestrator.listExperts();
            expect(experts[0]).toHaveProperty('expertId');
            expect(experts[0]).toHaveProperty('displayName');
            expect(experts[0]).toHaveProperty('description');
        });

        it('should return empty list when no experts registered', () => {
            const emptyRegistry = new ExpertRegistry();
            const emptyExecutor = new ExpertExecutor(emptyRegistry);
            const emptyOrchestrator = new ExpertOrchestrator(emptyExecutor, emptyRegistry);

            const experts = emptyOrchestrator.listExperts();
            expect(experts).toHaveLength(0);
        });
    });
});
