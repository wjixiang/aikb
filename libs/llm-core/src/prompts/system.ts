import { SystemPromptSettings } from "./types";
import { ModeConfig, PromptComponent } from 'llm-types'
import { getModeBySlug, Mode, modes, getModeSelection } from 'llm-shared/modes'

async function generatePrompt(
    mode: Mode,
    promptComponent?: PromptComponent,
    customModeConfigs?: ModeConfig[],
    settings?: SystemPromptSettings,
) {

    // Get the full mode config to ensure we have the role definition (used for groups, etc.)
    const modeConfig = getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0]
    const { roleDefinition, baseInstructions } = getModeSelection(mode, promptComponent, customModeConfigs)


}

export const SYSTEM_PROMPT = async () => {
    return `
    
  `;
};
