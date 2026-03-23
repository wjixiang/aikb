/**
 * Unit tests for AgentCard Registry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentCardRegistry } from '../AgentCard';
import type { AgentCard } from '../types';

describe('AgentCardRegistry', () => {
  let registry: AgentCardRegistry;

  const createTestAgent = (instanceId: string, capabilities: string[] = [], skills: string[] = []): AgentCard => ({
    instanceId,
    name: `Agent ${instanceId}`,
    description: `Test agent ${instanceId}`,
    version: '1.0.0',
    capabilities,
    skills,
    endpoint: instanceId,
  });

  beforeEach(() => {
    registry = new AgentCardRegistry();
  });

  describe('register', () => {
    it('should register an agent card', () => {
      const agent = createTestAgent('agent-001', ['search'], ['pubmed']);

      registry.register(agent);

      expect(registry.hasAgent('agent-001')).toBe(true);
    });

    it('should throw error when registering without instanceId', () => {
      const agent = createTestAgent('');

      expect(() => registry.register(agent)).toThrow('Agent card must have an instanceId');
    });

    it('should index agent by capabilities', () => {
      const agent = createTestAgent('agent-001', ['search', 'analysis'], []);

      registry.register(agent);

      const foundBySearch = registry.findByCapability('search');
      expect(foundBySearch).toHaveLength(1);
      expect(foundBySearch[0].instanceId).toBe('agent-001');

      const foundByAnalysis = registry.findByCapability('analysis');
      expect(foundByAnalysis).toHaveLength(1);
    });

    it('should index agent by skills', () => {
      const agent = createTestAgent('agent-001', [], ['pubmed', 'paper-analysis']);

      registry.register(agent);

      const foundByPubmed = registry.findBySkill('pubmed');
      expect(foundByPubmed).toHaveLength(1);

      const foundByAnalysis = registry.findBySkill('paper-analysis');
      expect(foundByAnalysis).toHaveLength(1);
    });

    it('should replace existing agent with same instanceId', () => {
      const agent1 = createTestAgent('agent-001', ['search'], []);
           registry.register(agent1);

      const agent2 = createTestAgent('agent-001', ['analysis'], []);
      registry.register(agent2);

      const found = registry.getAgent('agent-001');
      expect(found?.capabilities).toEqual(['analysis']);
    });
  });

  describe('unregister', () => {
    it('should unregister an agent', () => {
      const agent = createTestAgent('agent-001', ['search'], ['pubmed']);
      registry.register(agent);

      registry.unregister('agent-001');

      expect(registry.hasAgent('agent-001')).toBe(false);
    });

    it('should remove from capability index', () => {
      const agent = createTestAgent('agent-001', ['search'], []);
      registry.register(agent);

      registry.unregister('agent-001');

      const found = registry.findByCapability('search');
      expect(found).toHaveLength(0);
    });

    it('should not throw when unregistering non-existent agent', () => {
      expect(() => registry.unregister('non-existent')).not.toThrow();
    });
  });

  describe('getAgent', () => {
    it('should return agent card by instanceId', () => {
      const agent = createTestAgent('agent-001', ['search'], ['pubmed']);
      registry.register(agent);

      const found = registry.getAgent('agent-001');

      expect(found).toBeDefined();
      expect(found?.name).toBe('Agent agent-001');
    });

    it('should return undefined for non-existent agent', () => {
      const found = registry.getAgent('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('findByCapability', () => {
    it('should find agents by capability', () => {
      registry.register(createTestAgent('agent-001', ['search'], []));
      registry.register(createTestAgent('agent-002', ['analysis'], []));
      registry.register(createTestAgent('agent-003', ['search'], []));

      const found = registry.findByCapability('search');

      expect(found).toHaveLength(2);
      expect(found.map(a => a.instanceId)).toContain('agent-001');
      expect(found.map(a => a.instanceId)).toContain('agent-003');
    });

    it('should return empty array for non-existent capability', () => {
      registry.register(createTestAgent('agent-001', ['search'], []));

      const found = registry.findByCapability('non-existent');

      expect(found).toHaveLength(0);
    });
  });

  describe('findBySkill', () => {
    it('should find agents by skill', () => {
      registry.register(createTestAgent('agent-001', [], ['pubmed']));
      registry.register(createTestAgent('agent-002', [], ['analysis']));

      const found = registry.findBySkill('pubmed');

      expect(found).toHaveLength(1);
      expect(found[0].instanceId).toBe('agent-001');
    });
  });

  describe('getAllAgents', () => {
    it('should return all registered agents', () => {
      registry.register(createTestAgent('agent-001'));
      registry.register(createTestAgent('agent-002'));
      registry.register(createTestAgent('agent-003'));

      const all = registry.getAllAgents();

      expect(all).toHaveLength(3);
    });
  });

  describe('getAgentSummaries', () => {
    it('should return simplified agent summaries', () => {
      registry.register(createTestAgent('agent-001', ['search'], ['pubmed']));

      const summaries = registry.getAgentSummaries();

      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toEqual({
        instanceId: 'agent-001',
        name: 'Agent agent-001',
        capabilities: ['search'],
        skills: ['pubmed'],
      });
    });
  });

  describe('updateAgent', () => {
    it('should update an existing agent', () => {
      registry.register(createTestAgent('agent-001', ['search'], []));

      registry.updateAgent('agent-001', { capabilities: ['analysis'] });

      const updated = registry.getAgent('agent-001');
      expect(updated?.capabilities).toEqual(['analysis']);
    });

    it('should throw error when updating non-existent agent', () => {
      expect(() => registry.updateAgent('non-existent', { capabilities: ['search'] }))
        .toThrow('Agent not found');
    });
  });

  describe('clear', () => {
    it('should clear all registrations', () => {
      registry.register(createTestAgent('agent-001'));
      registry.register(createTestAgent('agent-002'));

      registry.clear();

      expect(registry.getAllAgents()).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return registry statistics', () => {
      registry.register(createTestAgent('agent-001', ['search', 'analysis'], ['pubmed']));

      const stats = registry.getStats();

      expect(stats.totalAgents).toBe(1);
      expect(stats.totalCapabilities).toBe(2);
      expect(stats.totalSkills).toBe(1);
    });
  });
});
