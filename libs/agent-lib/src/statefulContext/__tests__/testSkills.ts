import { defineSkill, createComponentDefinition } from '../../skills/SkillDefinition.js';
import { TYPES } from '../../di/types.js';

/**
 * Test skill with component A (search functionality)
 */
export const testSkillA = defineSkill({
    name: 'test-skill-a',
    displayName: 'Test Skill A',
    description: 'A test skill with search functionality',
    whenToUse: 'Use this skill when you need to search for something',
    version: '1.0.0',
    triggers: ['search', 'query'],
    capabilities: ['Search for something'],
    workDirection: 'Search direction',
    components: [
        createComponentDefinition(
            'search-component',
            'Search Component',
            'Provides search functionality',
            TYPES.TestToolComponentA // Use DI token for singleton resolution
        )
    ]
});

/**
 * Test skill with component B (counter functionality)
 */
export const testSkillB = defineSkill({
    name: 'test-skill-b',
    displayName: 'Test Skill B',
    description: 'A test skill with counter functionality',
    whenToUse: 'Use this skill when you need to count something',
    version: '1.0.0',
    triggers: ['counter', 'increment'],
    capabilities: ['Counter functionality'],
    workDirection: 'Counter direction',
    components: [
        createComponentDefinition(
            'counter-component',
            'Counter Component',
            'Provides counter functionality',
            TYPES.TestToolComponentB // Use DI token for singleton resolution
        )
    ]
});

/**
 * Test skill with component C (toggle functionality)
 */
export const testSkillC = defineSkill({
    name: 'test-skill-c',
    displayName: 'Test Skill C',
    description: 'A test skill with toggle functionality',
    whenToUse: 'Use this skill when you need to toggle something',
    version: '1.0.0',
    triggers: ['toggle', 'flag'],
    capabilities: ['Toggle functionality'],
    workDirection: 'Toggle direction',
    components: [
        createComponentDefinition(
            'toggle-component',
            'Toggle Component',
            'Provides toggle functionality',
            TYPES.TestToolComponentC // Use DI token for singleton resolution
        )
    ]
});

/**
 * Test skill with multiple components
 */
export const testSkillMulti = defineSkill({
    name: 'test-skill-multi',
    displayName: 'Test Skill Multi',
    description: 'A test skill with multiple components',
    whenToUse: 'Use this skill when you need multiple functionalities',
    version: '1.0.0',
    triggers: ['multi', 'combined'],
    capabilities: ['Multiple functionalities'],
    workDirection: 'Multi direction',
    components: [
        createComponentDefinition(
            'search-component',
            'Search Component',
            'Provides search functionality',
            TYPES.TestToolComponentA // Use DI token for singleton resolution
        ),
        createComponentDefinition(
            'counter-component',
            'Counter Component',
            'Provides counter functionality',
            TYPES.TestToolComponentB // Use DI token for singleton resolution
        ),
        createComponentDefinition(
            'toggle-component',
            'Toggle Component',
            'Provides toggle functionality',
            TYPES.TestToolComponentC // Use DI token for singleton resolution
        )
    ]
});
