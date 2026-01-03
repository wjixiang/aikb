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
import { getToolDescriptionsForMode } from '../tools';
import { markdownFormattingSection } from './sections/markdown-formatting';
import { getSharedToolUseSection } from './sections/tool-use';
import { getToolUseGuidelinesSection } from './sections/tool-use-guidelines';
import { getCapabilitiesSection } from './sections/capabilities';
import { getRulesSection } from './sections/rules';
import { getObjectiveSection } from './sections/objectives';

async function generatePrompt(
  promptComponent?: PromptComponent,
  settings?: SystemPromptSettings,
  modelId?: string,
) {
  // Get the full mode config to ensure we have the role definition (used for groups, etc.)

  const roleDefinition = ""

  // Determine the effective protocol (defaults to 'xml')
  const effectiveProtocol = getEffectiveProtocol(settings?.toolProtocol);
  // console.log(effectiveProtocol)

  const toolsCatalog = isNativeProtocol(effectiveProtocol)
    ? ''
    : `\n\n${getToolDescriptionsForMode(settings, modelId)}`;

  // console.log(toolsCatalog)
  const basePrompt = `${roleDefinition}

${markdownFormattingSection()}

${getSharedToolUseSection(effectiveProtocol)}${toolsCatalog}

${getToolUseGuidelinesSection(effectiveProtocol)}

${getCapabilitiesSection()}

${getRulesSection()}

${getObjectiveSection()}
`;
  return basePrompt;
}

export const SYSTEM_PROMPT = async () => {
  return generatePrompt();
};
