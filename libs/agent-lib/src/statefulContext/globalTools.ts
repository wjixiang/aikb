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