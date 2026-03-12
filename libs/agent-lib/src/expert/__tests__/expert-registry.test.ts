import { describe, it, expect, beforeEach } from 'vitest';
import { ExpertRegistry } from '../ExpertRegistry';
import {
    sampleExpertConfig,
    sampleExpertConfigWithComponents,
    sampleExpertConfigs
} from './fixtures/mock-config';

describe('ExpertRegistry', () => {
    let registry: ExpertRegistry;

    beforeEach(() => {
        registry = new ExpertRegistry();
    });

    describe('register', () => {
        it('should register an expert', () => {
            registry.register(sampleExpertConfig);

            const expert = registry.get(sampleExpertConfig.expertId);
            expect(expert).toBeDefined();
            expect(expert?.expertId).toBe(sampleExpertConfig.expertId);
            expect(expert?.displayName).toBe(sampleExpertConfig.displayName);
        });

        it('should overwrite existing expert with warning', () => {
            const warnSpy = vi.spyOn(console, 'warn');

            registry.register(sampleExpertConfig);
            registry.register(sampleExpertConfig);

            expect(warnSpy).toHaveBeenCalled();
            expect(registry.get(sampleExpertConfig.expertId)).toBeDefined();
        });

        it('should log registration', () => {
            const logSpy = vi.spyOn(console, 'log');

            registry.register(sampleExpertConfig);

            expect(logSpy).toHaveBeenCalledWith(
                expect.stringContaining('Registered expert:')
            );
        });
    });

    describe('get', () => {
        it('should return expert by ID', () => {
            registry.register(sampleExpertConfig);

            const expert = registry.get(sampleExpertConfig.expertId);
            expect(expert).toEqual(sampleExpertConfig);
        });

        it('should return undefined for non-existent expert', () => {
            const expert = registry.get('non-existent');
            expect(expert).toBeUndefined();
        });
    });

    describe('getAll', () => {
        it('should return all registered experts', () => {
            sampleExpertConfigs.forEach(config => registry.register(config));

            const experts = registry.getAll();
            expect(experts).toHaveLength(sampleExpertConfigs.length);
        });

        it('should return empty array when no experts registered', () => {
            const experts = registry.getAll();
            expect(experts).toEqual([]);
        });
    });

    describe('findByCapability', () => {
        it('should find experts by capability', () => {
            registry.register(sampleExpertConfig);

            // sampleExpertConfig has capabilities: ['test-capability-1', 'test-capability-2']
            const results = registry.findByCapability('test-capability-1');
            expect(results).toHaveLength(1);
            expect(results[0].expertId).toBe(sampleExpertConfig.expertId);
        });

        it('should be case insensitive', () => {
            registry.register(sampleExpertConfig);

            const results = registry.findByCapability('TEST-CAPABILITY');
            expect(results).toHaveLength(1);
        });

        it('should return empty array when no match', () => {
            registry.register(sampleExpertConfig);

            const results = registry.findByCapability('non-existent-capability');
            expect(results).toEqual([]);
        });
    });

    describe('findByTrigger', () => {
        it('should find experts by trigger', () => {
            registry.register(sampleExpertConfig);
            registry.register(sampleExpertConfigWithComponents);

            const results = registry.findByTrigger('test');
            expect(results).toHaveLength(2);
        });

        it('should be case insensitive', () => {
            registry.register(sampleExpertConfig);

            const results = registry.findByTrigger('TEST');
            expect(results).toHaveLength(1);
        });

        it('should return empty array when no match', () => {
            registry.register(sampleExpertConfig);

            const results = registry.findByTrigger('non-existent-trigger');
            expect(results).toEqual([]);
        });
    });

    describe('listExperts', () => {
        it('should list expert summaries', () => {
            registry.register(sampleExpertConfig);

            const summaries = registry.listExperts();
            expect(summaries).toHaveLength(1);
            expect(summaries[0]).toEqual({
                expertId: sampleExpertConfig.expertId,
                displayName: sampleExpertConfig.displayName,
                description: sampleExpertConfig.description,
                whenToUse: sampleExpertConfig.whenToUse,
                triggers: sampleExpertConfig.triggers,
                capabilities: sampleExpertConfig.capabilities
            });
        });

        it('should return empty array when no experts', () => {
            const summaries = registry.listExperts();
            expect(summaries).toEqual([]);
        });
    });
});
