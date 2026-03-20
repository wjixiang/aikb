/**
 * Action Prompt Builder
 *
 * Builds the system prompt for the action phase using shared common modules.
 */

import type { IVirtualWorkspace } from '../../../components/core/types.js';
import type { AgentPrompt } from '../../agent/agent.js';
import { generateWorkspaceGuide } from '../sections/workspaceGuide.js';
import { generateRuntimeTaskGuide } from '../sections/runtimeTaskGuide.js';
import { generateActionPhaseGuidance } from '../sections/actionPhaseGuidance.js';
import {
  getBaseInstruction,
  getActionPhaseToolGuidance,
  getExecutionGuidelines,
} from '../common/index.js';

/**
 * Configuration for ActionPromptBuilder
 */
export interface ActionPromptBuilderConfig {
  workspace: IVirtualWorkspace;
  agentPrompt: AgentPrompt;
  hasMailComponent: boolean;
}

/**
 * Builder class for constructing action phase prompts
 */
export class ActionPromptBuilder {
  private thinkingSummary?: string;

  constructor(private config: ActionPromptBuilderConfig) {}

  /**
   * Set thinking summary (from thinking phase)
   */
  setThinkingSummary(summary: string | undefined): this {
    this.thinkingSummary = summary;
    return this;
  }

  /**
   * Build the base system prompt (without action phase guidance)
   */
  async buildSystemPrompt(): Promise<string> {
    const { workspace, agentPrompt, hasMailComponent } = this.config;

    // Render workspace components (async call)
    const componentToolsSection = await workspace.renderComponentToolsSection();
    const componentToolsRendered = componentToolsSection
      ? componentToolsSection.render()
      : '';
    const taskGuide = hasMailComponent ? generateRuntimeTaskGuide() : '';

    return `
${generateWorkspaceGuide()}
${this.renderAgentPrompt()}
${taskGuide}
${workspace.renderToolBox().render()}
${componentToolsRendered}
    `.trim();
  }

  /**
   * Build the enhanced system prompt with action phase guidance prepended
   * This is used when there's a thinking summary to follow
   */
  async buildEnhancedPrompt(): Promise<string> {
    const actionPhaseGuidance = generateActionPhaseGuidance(
      this.thinkingSummary,
    );
    const systemPrompt = await this.buildSystemPrompt();

    return `${actionPhaseGuidance}\n\n${systemPrompt}`;
  }

  /**
   * Build the full prompt for action phase
   * If thinkingSummary is set, includes action phase guidance
   */
  async build(): Promise<string> {
    if (this.thinkingSummary) {
      return this.buildEnhancedPrompt();
    }
    return this.buildSystemPrompt();
  }

  /**
   * Render the agent prompt section
   */
  private renderAgentPrompt(): string {
    const { agentPrompt } = this.config;
    const capability = agentPrompt.capability;
    const direction = agentPrompt.direction;

    return `
------------
Capabilities
------------
${capability}

--------------
Work Direction
--------------
${direction}

`;
  }
}
