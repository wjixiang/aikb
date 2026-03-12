/**
 * Expert Registry
 *
 * Manages all available Expert configurations
 * Replaces the registration functionality of the original SkillManager
 */

import { injectable } from 'inversify';
import type { ExpertConfig, ExpertSummary, IExpertRegistry } from './types.js';

@injectable()
export class ExpertRegistry implements IExpertRegistry {
    private experts: Map<string, ExpertConfig> = new Map();

    register(expert: ExpertConfig): void {
        if (this.experts.has(expert.expertId)) {
            console.warn(`[ExpertRegistry] Expert "${expert.expertId}" already registered, overwriting`);
        }
        this.experts.set(expert.expertId, expert);
        console.log(`[ExpertRegistry] Registered expert: ${expert.displayName}`);
    }

    get(expertId: string): ExpertConfig | undefined {
        return this.experts.get(expertId);
    }

    getAll(): ExpertConfig[] {
        return Array.from(this.experts.values());
    }

    findByCapability(capability: string): ExpertConfig[] {
        return Array.from(this.experts.values()).filter(expert =>
            expert.capabilities.some(cap =>
                cap.toLowerCase().includes(capability.toLowerCase())
            )
        );
    }

    findByTrigger(trigger: string): ExpertConfig[] {
        const lowerTrigger = trigger.toLowerCase();
        return Array.from(this.experts.values()).filter(expert =>
            expert.triggers?.some(t => t.toLowerCase().includes(lowerTrigger))
        );
    }

    listExperts(): ExpertSummary[] {
        return Array.from(this.experts.values()).map(expert => ({
            expertId: expert.expertId,
            displayName: expert.displayName,
            description: expert.description,
            whenToUse: expert.whenToUse,
            triggers: expert.triggers,
            capabilities: expert.capabilities
        }));
    }
}
