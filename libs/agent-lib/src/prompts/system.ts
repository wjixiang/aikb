import { SystemPromptSettings } from './types';
import {
  getEffectiveProtocol,
  isNativeProtocol,
  ModeConfig,
  PromptComponent,
} from '../types';
// import {
//   getModeBySlug,
//   Mode,
//   modes,
//   getModeSelection,
//   defaultModeSlug,
// } from '../shared/modes';
import { getToolDescriptions, getNativeToolDescriptions } from '../tools';
import { markdownFormattingSection } from './sections/markdown-formatting';
import { getSharedToolUseSection } from './sections/tool-use';
import { getToolUseGuidelinesSection } from './sections/tool-use-guidelines';
import { getCapabilitiesSection } from './sections/capabilities';
import { getRulesSection } from './sections/rules';
import { getObjectiveSection } from './sections/objectives';
import { getRoleDefinition } from './sections/role';
import { generateWorkspaceGuide } from './sections/workspaceGuide';

interface SystemPrompt {
  system: string;
  toolUse: string;
  rules: string;
  capabilities: string;
}

async function generatePrompt(
  promptComponent?: PromptComponent,
  settings?: SystemPromptSettings,
  modelId?: string,
) {
  // Get the full mode config to ensure we have the role definition (used for groups, etc.)

  const roleDefinition = getRoleDefinition()
  // const roleDefinition = ""

  // Determine the effective protocol (defaults to 'xml')
  const effectiveProtocol = getEffectiveProtocol(settings?.toolProtocol);
  // console.log(effectiveProtocol)

  // Get tool descriptions based on protocol
  const toolsCatalog = isNativeProtocol(effectiveProtocol)
    ? `\n\n${getNativeToolDescriptions()}`
    : `\n\n${getToolDescriptions(settings, modelId)}`;

  // console.log(toolsCatalog)
  const basePrompt = `${roleDefinition}
${generateWorkspaceGuide()}

${markdownFormattingSection()}

${getSharedToolUseSection(effectiveProtocol)}

${toolsCatalog}

${
    // getToolUseGuidelinesSection(effectiveProtocol)
    ""
    }


${getRulesSection()}
`;
  return basePrompt;
}

export const SYSTEM_PROMPT = async (settings?: SystemPromptSettings, modelId?: string) => {
  const prompt = generatePrompt(undefined, settings, modelId);
  // console.log(prompt)
  return prompt
};
