import { getAllModesWithPrompts } from "llm-shared/modes"
import { ModeConfig } from "llm-types"


export async function getModesSection(
    skipXmlExamples: boolean = false,
): Promise<string> {

    // Get all modes with their overrides from extension state
    const allModes = await getAllModesWithPrompts()

    let modesContent = `====

MODES

- These are the currently available modes:
${allModes
            .map((mode: ModeConfig) => {
                let description: string
                if (mode.whenToUse && mode.whenToUse.trim() !== "") {
                    // Use whenToUse as the primary description, indenting subsequent lines for readability
                    description = mode.whenToUse.replace(/\n/g, "\n    ")
                } else {
                    // Fallback to the first sentence of roleDefinition if whenToUse is not available
                    description = mode.roleDefinition.split(".")[0]
                }
                return `  * "${mode.name}" mode (${mode.slug}) - ${description}`
            })
            .join("\n")}`

    if (!skipXmlExamples) {
        modesContent += `
If the user asks you to create or edit a new mode for this project, you should read the instructions by using the fetch_instructions tool, like this:
<fetch_instructions>
<task>create_mode</task>
</fetch_instructions>
`
    } else {
        modesContent += `
If the user asks you to create or edit a new mode for this project, you should read the instructions by using the fetch_instructions tool.
`
    }

    return modesContent
}
