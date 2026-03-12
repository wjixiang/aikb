import type { ExpertConfig, ExpertComponentDefinition } from '../types';

/**
 * Sample Expert Config for testing
 */
export const sampleExpertConfig: ExpertConfig = {
    expertId: 'test-expert',
    displayName: 'Test Expert',
    description: 'A test expert for unit testing',
    whenToUse: 'When testing Expert functionality',
    triggers: ['test', 'testing'],
    responsibilities: 'Responsible for testing Expert functionality',
    capabilities: ['test-capability-1', 'test-capability-2'],
    prompt: {
        capability: 'This expert can test functionality',
        direction: '1. Test step one\n2. Test step two'
    },
    components: [],
    systemPrompt: 'You are a test expert'
};

/**
 * Expert Config with Components
 */
export const sampleExpertConfigWithComponents: ExpertConfig = {
    ...sampleExpertConfig,
    expertId: 'test-expert-with-components',
    components: [
        {
            componentId: 'test-component-1',
            displayName: 'Test Component 1',
            description: 'First test component',
            instance: Symbol('TestComponent1')
        },
        {
            componentId: 'test-component-2',
            displayName: 'Test Component 2',
            description: 'Second test component',
            instance: Symbol('TestComponent2'),
            shared: true
        }
    ] as ExpertComponentDefinition[]
};

/**
 * Multiple Expert Configs for testing registry
 */
export const sampleExpertConfigs: ExpertConfig[] = [
    sampleExpertConfig,
    sampleExpertConfigWithComponents,
    {
        expertId: 'another-expert',
        displayName: 'Another Expert',
        description: 'Another test expert',
        triggers: ['another', 'test'],
        responsibilities: 'Another testing responsibility',
        capabilities: ['capability-a', 'capability-b'],
        prompt: {
            capability: 'Another capability',
            direction: 'Another direction'
        },
        components: []
    }
];

/**
 * Sample SOP content for testing
 */
export const sampleSOPContent = `# Test Expert

## Overview
This is a test expert for unit testing purposes.

## When to Use
Use this expert when testing Expert functionality.

## Parameters
- **input** (required): Test input
- **options** (optional, default: {}): Test options

## Steps

### Phase 1: Preparation
1. **Prepare Test Data**
   - Prepare the test data

### Phase 2: Execution
1. **Execute Test**
   - Execute the test

## Examples

**Input:**
\`\`\`
test input
\`\`\`

**Expected Output:**
\`\`\`
test output
\`\`\`

## Constraints
- You MUST complete the test
- You SHOULD verify results
- You MAY provide additional context
`;

/**
 * Sample config.json content
 */
export const sampleConfigJson = {
    expertId: 'test-expert',
    displayName: 'Test Expert',
    description: 'A test expert for unit testing',
    category: 'testing',
    tags: ['test', 'unit'],
    triggers: ['test']
};
