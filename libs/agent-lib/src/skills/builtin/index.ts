/**
 * Built-in Skills Registry
 *
 * Centralized registration of all built-in skills.
 * Import and register skills here instead of scanning directories.
 */

import type { Skill } from '../types.js';

// Import built-in skills
import paperAnalysisSkill from './paper-analysis.skill.js';
import metaAnalysisArticleRetrievalSkill from './meta-analysis-article-retrieval.skill.js';
import picoExtractionSkill from './pico-extraction.skill.js';
import prismaChecklistSkill from './prisma-checklist.skill.js';
import prismaFlowDiagramSkill from './prisma-flow-diagram.skill.js';

/**
 * All built-in skills
 * Add new skills to this array
 */
export const builtinSkills: Skill[] = [
    // paperAnalysisSkill,
    metaAnalysisArticleRetrievalSkill,
    picoExtractionSkill,
    prismaChecklistSkill,
    prismaFlowDiagramSkill,
];

/**
 * Get all built-in skills
 */
export function getBuiltinSkills(): Skill[] {
    return builtinSkills;
}

/**
 * Get a built-in skill by name
 */
export function getBuiltinSkill(name: string): Skill | undefined {
    return builtinSkills.find(skill => skill.name === name);
}

/**
 * Check if a skill is built-in
 */
export function isBuiltinSkill(name: string): boolean {
    return builtinSkills.some(skill => skill.name === name);
}

/**
 * Get built-in skill names
 */
export function getBuiltinSkillNames(): string[] {
    return builtinSkills.map(skill => skill.name);
}

/**
 * Get built-in skills by category
 */
export function getBuiltinSkillsByCategory(category: string): Skill[] {
    // Note: Category info is in metadata, not in Skill interface
    // This is a placeholder - you may need to extend Skill interface
    return builtinSkills.filter(skill => {
        // Check if skill has category in triggers or description
        return skill.description.toLowerCase().includes(category.toLowerCase());
    });
}

/**
 * Get built-in skills by tag
 */
export function getBuiltinSkillsByTag(tag: string): Skill[] {
    return builtinSkills.filter(skill =>
        skill.triggers?.some(t => t.toLowerCase().includes(tag.toLowerCase()))
    );
}
