import { SystemPromptSettings } from './types';
import {
  getEffectiveProtocol,
  isNativeProtocol,
  ModeConfig,
  PromptComponent,
} from '../types';
import {
  getModeBySlug,
  Mode,
  modes,
  getModeSelection,
  defaultModeSlug,
} from '../shared/modes';
import { getModesSection } from './sections/modes';
import { getToolDescriptionsForMode } from '../tools';
import { markdownFormattingSection } from './sections/markdown-formatting';
import { getSharedToolUseSection } from './sections/tool-use';
import { getToolUseGuidelinesSection } from './sections/tool-use-guidelines';
import { getCapabilitiesSection } from './sections/capabilities';
import { getRulesSection } from './sections/rules';
import { getObjectiveSection } from './sections/objectives';

async function generatePrompt(
  mode: Mode,
  promptComponent?: PromptComponent,
  settings?: SystemPromptSettings,
  modelId?: string,
) {
  // Get the full mode config to ensure we have the role definition (used for groups, etc.)
  const modeConfig =
    getModeBySlug(mode) || modes.find((m) => m.slug === mode) || modes[0];
  const { roleDefinition, baseInstructions } = getModeSelection(
    mode,
    promptComponent,
  );

  // Determine the effective protocol (defaults to 'xml')
  const effectiveProtocol = getEffectiveProtocol(settings?.toolProtocol);
  // console.log(effectiveProtocol)

  const modesSection = await getModesSection();

  const toolsCatalog = isNativeProtocol(effectiveProtocol)
    ? ''
    : `\n\n${getToolDescriptionsForMode(mode, settings, modelId)}`;

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

export const SYSTEM_PROMPT = async (mode: Mode = defaultModeSlug) => {
  return generatePrompt(mode);
};
