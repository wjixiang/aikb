import type { ToolName, ModeConfig } from "../types"

import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS, DiffStrategy } from "../shared/tools"
import { Mode, getModeConfig, isToolAllowedForMode, getGroupName } from "../shared/modes"

import { ToolArgs } from "./types"
import { getSemanticSearchDescription } from "./semantic-search"
import attempt_completion from "./native-tools/attempt_completion"
import { getAttemptCompletionDescription } from "./attempt-completion"
import { convertOpenAIToolToAnthropic } from "./native-tools"

import { Tool } from './types'
import { semantic_search_tool } from './tools/semantic_search'
import { ToolCallingHandler } from "./toolCallingHandler"

export const toolSet = new Map<ToolName, Tool>()

function registerTools() {
    toolSet.set('semantic_search', semantic_search_tool)
    toolSet.set('attempt_completion', {
        desc: {
            native: attempt_completion,
            xml: (args) => getAttemptCompletionDescription(args),
        },
        resolve: async (args: any) => {
            // For attempt_completion, just return a success message
            return "Task completed successfully";
        },
    })
}
registerTools()


// Map of tool names to their description functions
const toolDescriptionMap: Record<string, (args: ToolArgs) => string | undefined> = {
    semantic_search: (args) => getSemanticSearchDescription(args),
    attempt_completion: (args) => getAttemptCompletionDescription(args),
}

export function getToolDescriptionsForMode(
    mode: Mode,
    settings?: Record<string, any>,
    modelId?: string,
): string {
    const config = getModeConfig(mode)
    const args: ToolArgs = {
        settings: {
            ...settings,
            modelId,
        }
    }

    const tools = new Set<string>()

    // Add tools from mode's groups
    config.groups.forEach((groupEntry) => {
        const groupName = getGroupName(groupEntry)
        const toolGroup = TOOL_GROUPS[groupName]
        if (toolGroup) {
            toolGroup.tools.forEach((tool) => {
                if (
                    isToolAllowedForMode(
                        tool as ToolName,
                        mode,
                        undefined,
                        undefined,
                    )
                ) {
                    tools.add(tool)
                }
            })
        }
    })

    // Add always available tools
    ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))

    // Map tool descriptions for allowed tools
    const descriptions = Array.from(tools).map((toolName) => {
        const descriptionFn = toolDescriptionMap[toolName]
        if (!descriptionFn) {
            return undefined
        }

        const description = descriptionFn({
            ...args,
            toolOptions: undefined, // No tool options in group-based approach
        })

        return description
    })

    return `# Tools\n\n${descriptions.filter(Boolean).join("\n\n")}`
}


export { ToolCallingHandler }

// Export native tool definitions (JSON schema format for OpenAI-compatible APIs)
export { nativeTools } from "./native-tools"
export { convertOpenAIToolToAnthropic, convertOpenAIToolsToAnthropic } from './native-tools/converters'