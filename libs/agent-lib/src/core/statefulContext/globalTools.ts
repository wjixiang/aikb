import z from "zod";
import { Tool } from "./index.js";

export const get_skill: Tool = {
    toolName: "get_skill",
    paramsSchema: z.object({
        skill_name: z.string().describe('The name of the skill to activate. Use list_skills first to see available skills.')
    }),
    desc: "Activate a skill to optimize prompts and tools for specific tasks. The skill will enhance your capabilities and provide specialized guidance.",
    examples: [
        {
            description: 'Activate a specific skill',
            params: { skill_name: 'pubmed-search' },
            expectedResult: 'Skill activated, specialized prompts and tools enabled',
        },
    ],
}

export const list_skills: Tool = {
    toolName: "list_skills",
    paramsSchema: z.object({}),
    desc: "List all available skills with their descriptions. Use this to discover which skill is best suited for the current task.",
    examples: [
        {
            description: 'List all available skills',
            params: {},
            expectedResult: 'Returns list of skills with names and descriptions',
        },
    ],
}

export const deactivate_skill: Tool = {
    toolName: "deactivate_skill",
    paramsSchema: z.object({}),
    desc: "Deactivate the currently active skill and return to default mode.",
    examples: [
        {
            description: 'Deactivate current skill',
            params: {},
            expectedResult: 'Skill deactivated, returned to default mode',
        },
    ],
}

export const attempt_completion: Tool = {
    toolName: 'attempt_completion',
    paramsSchema: z.object({
        result: z.string().describe('The final result message to present to the user')
    }),
    desc: 'Complete the task and return final result to the user. This MUST be called when the task is fully accomplished.',
    examples: [
        {
            description: 'Complete with simple result',
            params: { result: 'Task completed successfully. Found 25 PubMed articles matching the query.' },
            expectedResult: 'Task ends, result presented to user',
        },
        {
            description: 'Complete with detailed summary',
            params: { result: 'Search completed:\n- Query: cancer immunotherapy\n- Filters: Systematic Review, 2020-2025\n- Results: 15 articles found\n- Top match: PMID 12345678 "Title..."' },
            expectedResult: 'Task ends with detailed summary presented to user',
        },
    ],
}

export const recall_conversation: Tool = {
    toolName: 'recall_conversation',
    paramsSchema: z.object({
        turn_numbers: z.array(z.number()).optional().describe('Specific turn numbers to recall (e.g., [1, 3, 5])'),
        message_indices: z.array(z.number()).optional().describe('Specific message indices to recall'),
        last_n: z.number().optional().describe('Recall the last N messages from conversation history')
    }),
    desc: 'Recall specific conversation messages from history. By default, only summaries are available in the prompt. Use this tool to explicitly retrieve detailed conversation context when needed. The recalled messages will be injected into the next API request.',
    examples: [
        {
            description: 'Recall last 3 messages',
            params: { last_n: 3 },
            expectedResult: 'Last 3 messages injected into context',
        },
        {
            description: 'Recall specific turn',
            params: { turn_numbers: [1] },
            expectedResult: 'Turn 1 messages retrieved',
        },
    ],
}