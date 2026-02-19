import z from "zod";
import { Tool } from "./ui";

export const get_skill: Tool = {
    toolName: "get_skill",
    paramsSchema: z.object({
        skill_name: z.string().describe('The name of the skill to activate. Use list_skills first to see available skills.')
    }),
    desc: "Activate a skill to optimize prompts and tools for specific tasks. The skill will enhance your capabilities and provide specialized guidance."
}

export const list_skills: Tool = {
    toolName: "list_skills",
    paramsSchema: z.object({}),
    desc: "List all available skills with their descriptions. Use this to discover which skill is best suited for the current task."
}

export const deactivate_skill: Tool = {
    toolName: "deactivate_skill",
    paramsSchema: z.object({}),
    desc: "Deactivate the currently active skill and return to default mode."
}

export const attempt_completion: Tool = {
    toolName: 'attempt_completion',
    paramsSchema: z.object({
        result: z.string().describe('The final result message to present to the user')
    }),
    desc: 'Complete the task and return final result to the user. This should be called when the task is fully accomplished.'
}

export const recall_conversation: Tool = {
    toolName: 'recall_conversation',
    paramsSchema: z.object({
        turn_numbers: z.array(z.number()).optional().describe('Specific turn numbers to recall (e.g., [1, 3, 5])'),
        message_indices: z.array(z.number()).optional().describe('Specific message indices to recall'),
        last_n: z.number().optional().describe('Recall the last N messages from conversation history')
    }),
    desc: 'Recall specific conversation messages from history. By default, only summaries are available in the prompt. Use this tool to explicitly retrieve detailed conversation context when needed. The recalled messages will be injected into the next API request.'
}