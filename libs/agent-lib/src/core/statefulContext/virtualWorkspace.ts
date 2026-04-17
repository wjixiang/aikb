import { injectable, inject, optional, postConstruct } from 'inversify';
import { getLogger } from '@shared/logger';
import {
  type VirtualWorkspaceConfig,
  type Tool,
  type IVirtualWorkspace,
  type ToolCallResult,
  type ComponentStateBase,
  type ToolComponent,
  tdiv,
  MdDiv,
  MdParagraph,
  MdHeading,
  type TUIElement,
  MdElement,
  renderToolSection,
  ExportOptions,
  ExportResult,
} from '../../components/index.js';
import { TYPES } from '../di/types.js';
import type { IToolManager, ToolDefinition } from '../tools/index.js';
import { globalToolDefinitions } from './globalTools.js';

export const DefaultVirtualWorkspaceConfig: VirtualWorkspaceConfig = {
  id: 'default-workspace',
  name: 'Default Workspace',
  renderMode: 'tui',
  expertMode: false,
  alwaysRenderAllComponents: false,
};

@injectable()
export class VirtualWorkspace implements IVirtualWorkspace {
  private config: VirtualWorkspaceConfig;
  private components: Array<ToolComponent> = [];
  private toolManager: IToolManager;
  private externalRenderers: Map<string, () => Promise<TUIElement[]>> =
    new Map();
  private logger = getLogger('VirtualWorkspace');

  constructor(
    @inject(TYPES.IToolManager) toolManager: IToolManager,
    @inject(TYPES.VirtualWorkspaceConfig)
    @optional()
    config: Partial<VirtualWorkspaceConfig> = {},
    @inject(TYPES.ToolComponents)
    @optional()
    diComponents?: ToolComponent[],
  ) {
    this.config = {
      ...DefaultVirtualWorkspaceConfig,
      ...config,
    };

    this.toolManager = toolManager;

    if (diComponents && diComponents.length > 0) {
      this.components.push(...diComponents);
    }
  }

  @postConstruct()
  private init(): void {
    for (const definition of globalToolDefinitions) {
      this.toolManager.registerTool(definition);
    }
    for (const component of this.components) {
      this._registerComponentTools(component);
    }
  }

  private _registerComponentTools(component: ToolComponent): void {
    for (const tool of component.toolSet.values()) {
      this.toolManager.registerTool({
        tool,
        handler: (params) => component.handleToolCall(tool.toolName, params),
        componentKey: component.componentId,
      });
    }
  }

  getToolManager(): IToolManager {
    return this.toolManager;
  }

  getComponent(id: string): ToolComponent | undefined {
    return this.components.find((c) => c.componentId === id);
  }

  getComponentKeys(): string[] {
    return this.components.map((c) => c.componentId);
  }

  async renderComponentToolsSection(): Promise<TUIElement | null> {
    const tools: Tool[] = [];

    for (const component of this.components) {
      for (const tool of component.toolSet.values()) {
        if (this.toolManager.hasTool(tool.toolName)) {
          tools.push(tool);
        }
      }
    }

    if (tools.length === 0) {
      return null;
    }

    const container = new tdiv({
      styles: {
        showBorder: true,
        border: { line: 'double' },
      },
    });

    container.addChild(
      new tdiv({
        content: `COMPONENT TOOLS`,
        styles: { align: 'center' },
      }),
    );

    const toolSection = renderToolSection(tools);
    container.addChild(toolSection);

    return container;
  }

  renderToolBox() {
    const container = new tdiv({
      content: 'TOOL BOX',
      styles: {
        align: 'center',
        showBorder: true,
      },
    });

    const allTools = this.toolManager.getAllTools();
    const globalTools = allTools
      .filter((d) => !d.componentKey)
      .map((d) => d.tool);

    if (globalTools.length > 0) {
      const globalToolsSection = renderToolSection(globalTools);
      container.addChild(globalToolsSection);
    }

    return container;
  }

  private async _render(): Promise<TUIElement | MdElement> {
    if (this.config.renderMode === 'markdown') {
      return this._renderMarkdown();
    }
    return this._renderTUI();
  }

  private async _renderMarkdown(): Promise<MdElement> {
    const container = new MdDiv(
      { content: `# VIRTUAL WORKSPACE: ${this.config.name}` },
      [],
      0,
    );

    if (this.config.description) {
      container.addChild(
        new MdParagraph(
          { content: `**Description:** ${this.config.description}` },
          undefined,
          1,
        ),
      );
    }

    for (const component of this.components) {
      const componentContainer = new MdDiv(
        {
          content: `## ${component.componentId}`,
          styles: { showBorder: true },
        },
        [],
        1,
      );

      const componentRender = await component.renderImply();
      for (const element of componentRender) {
        const rendered = element.render(this.config.renderMode);
        componentContainer.addChild(
          new MdParagraph({ content: rendered }, undefined, 2),
        );
      }
      container.addChild(componentContainer);
    }

    for (const [id, renderer] of this.externalRenderers) {
      const elements = await renderer();
      for (const element of elements) {
        const rendered = element.render(this.config.renderMode);
        container.addChild(
          new MdParagraph({ content: rendered }, undefined, 1),
        );
      }
    }

    return container;
  }

  private async _renderTUI(): Promise<TUIElement> {
    const container = new tdiv({
      content: '',
      styles: { showBorder: false },
    });

    const workspaceHeader = new tdiv({
      content: `VIRTUAL WORKSPACE: ${this.config.name}`,
      styles: {
        height: 0,
        showBorder: true,
        border: { line: 'double' },
        align: 'center',
      },
    });
    container.addChild(workspaceHeader);

    if (this.config.description) {
      container.addChild(
        new tdiv({
          content: `Description: ${this.config.description}`,
          styles: { showBorder: false, margin: { bottom: 1 } },
        }),
      );
    }

    for (const component of this.components) {
      const componentContainer = new tdiv({
        content: component.componentId,
        styles: { showBorder: true },
      });

      const componentRender = await component.renderImply();
      componentRender.forEach((element) =>
        componentContainer.addChild(element),
      );
      container.addChild(componentContainer);
    }

    for (const [, renderer] of this.externalRenderers) {
      const elements = await renderer();
      elements.forEach((element) => container.addChild(element));
    }

    return container;
  }

  async render(): Promise<string> {
    const context = await this._render();
    return context.render();
  }

  getConfig(): VirtualWorkspaceConfig {
    return { ...this.config };
  }

  getStats(): {
    componentCount: number;
    componentKeys: string[];
    totalTools: number;
  } {
    let totalTools = 0;
    for (const component of this.components) {
      totalTools += component.toolSet.size;
    }

    return {
      componentCount: this.components.length,
      componentKeys: this.components.map((c) => c.componentId),
      totalTools,
    };
  }

  async handleToolCall(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<ToolCallResult<any>> {
    try {
      const result = await this.toolManager.executeTool(toolName, params);
      return { success: true, data: { success: true, result } };
    } catch (error) {
      return {
        success: false,
        data: {
          error: error instanceof Error ? error.message : String(error),
          success: false,
        },
      };
    }
  }

  getAllTools(): Array<{
    componentKey: string | undefined;
    toolName: string;
    tool: Tool;
    source: any;
    enabled: boolean;
  }> {
    const definitions = this.toolManager.getAllTools();
    return definitions.map((d) => ({
      componentKey: d.componentKey,
      toolName: d.tool.toolName,
      tool: d.tool,
      source: d.componentKey ? 'component' : 'global',
      enabled: true,
    }));
  }

  getGlobalTools(): Map<string, Tool> {
    const globalToolsMap = new Map<string, Tool>();
    for (const definition of this.toolManager.getAllTools()) {
      if (!definition.componentKey) {
        globalToolsMap.set(definition.tool.toolName, definition.tool);
      }
    }
    return globalToolsMap;
  }

  isToolAvailable(toolName: string): boolean {
    return this.toolManager.hasTool(toolName);
  }

  getAvailableTools(): Tool[] {
    return this.toolManager.getAvailableTools();
  }

  getToolSource(
    toolName: string,
  ): { source: string; owner: string } | null {
    const info = this.toolManager.getToolSource(toolName);
    if (!info) {
      return null;
    }
    return {
      source: info.componentKey ? 'component' : 'global',
      owner: info.componentKey ?? 'global',
    };
  }

  async exportResult(
    options?: ExportOptions,
  ): Promise<Record<string, ExportResult>> {
    const results: Record<string, ExportResult> = {};

    for (const component of this.components) {
      try {
        const result = await component.exportData(options);
        results[component.componentId] = result;
      } catch (error) {
        results[component.componentId] = {
          data: {
            error: error instanceof Error ? error.message : String(error),
          },
          format: options?.format ?? 'json',
          metadata: {
            componentId: component.componentId,
            error: true,
          },
        };
      }
    }

    return results;
  }

  registerExternalRenderer(
    id: string,
    renderer: () => Promise<TUIElement[]>,
  ): void {
    this.externalRenderers.set(id, renderer);
  }

  unregisterExternalRenderer(id: string): void {
    this.externalRenderers.delete(id);
  }

  exportComponentStates(): Map<string, ComponentStateBase> {
    const states = new Map<string, ComponentStateBase>();

    for (const component of this.components) {
      if (component.exportState) {
        try {
          states.set(component.componentId, component.exportState());
        } catch (error) {
          console.error(
            `[VirtualWorkspace] Failed to export state for ${component.componentId}:`,
            error,
          );
        }
      }
    }

    return states;
  }

  importComponentStates(states: Map<string, ComponentStateBase>): void {
    for (const [componentId, state] of states) {
      try {
        const entry = this.components.find(
          (c) => c.componentId === componentId,
        );
        if (entry?.restoreState) {
          entry.restoreState(state);
        }
      } catch (error) {
        console.error(
          `[VirtualWorkspace] Failed to restore state for ${componentId}:`,
          error,
        );
      }
    }
  }
}
