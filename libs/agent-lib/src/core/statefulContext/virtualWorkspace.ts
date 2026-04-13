import { injectable, inject, optional, postConstruct } from 'inversify';
import pino from 'pino';
import {
  type VirtualWorkspaceConfig,
  type Tool,
  type IVirtualWorkspace,
  type ToolCallResult,
  type ComponentStateBase,
  type ToolComponent,
  tdiv,
  MdDiv,
  MdHeading,
  MdParagraph,
  type TUIElement,
  MdElement,
  renderToolSection,
  ExportOptions,
  ExportResult,
} from '../../components/index.js';
import { ToolSource } from '../tools/IToolProvider.js';
import { TYPES } from '../di/types.js';
import type { IToolManager } from '../tools/index.js';
import { ComponentToolProvider } from '../tools/providers/ComponentToolProvider.js';
import { GlobalToolProvider } from '../tools/providers/GlobalToolProvider.js';
import type { A2AHandler } from '../a2a/index.js';

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
  private globalToolProvider: GlobalToolProvider;
  private _a2aHandler?: A2AHandler;
  private logger = pino({
    level: process.env['LOG_LEVEL'] || 'debug',
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  constructor(
    @inject(TYPES.IToolManager) toolManager: IToolManager,
    @inject(GlobalToolProvider) globalToolProvider: GlobalToolProvider,
    @inject(TYPES.VirtualWorkspaceConfig)
    @optional()
    config: Partial<VirtualWorkspaceConfig> = {},
    @inject(TYPES.ToolComponents)
    @optional()
    diComponents?: ToolComponent[],
    @inject(TYPES.IA2AHandler)
    @optional()
    a2aHandler?: A2AHandler,
  ) {
    this.config = {
      ...DefaultVirtualWorkspaceConfig,
      ...config,
    };

    this.toolManager = toolManager;
    this.globalToolProvider = globalToolProvider;
    this._a2aHandler = a2aHandler;

    if (diComponents && diComponents.length > 0) {
      this.components.push(...diComponents);
    }
  }

  @postConstruct()
  private init(): void {
    for (const component of this.components) {
      this._registerToolProvider(component);
    }
    this.toolManager.registerProvider(this.globalToolProvider);
  }

  protected _registerToolProvider(component: ToolComponent): void {
    const provider = new ComponentToolProvider(
      component.componentId,
      component,
    );
    this.toolManager.registerProvider(provider);
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

  getA2AHandler(): A2AHandler | undefined {
    return this._a2aHandler;
  }

  private onToolAvailabilityChange?: (() => void) | undefined;

  setOnToolAvailabilityChange(callback: () => void): void {
    this.onToolAvailabilityChange = callback;
  }

  async renderComponentToolsSection(): Promise<TUIElement | null> {
    const tools: Tool[] = [];

    for (const component of this.components) {
      for (const tool of component.toolSet.values()) {
        if (this.toolManager.isToolEnabled(tool.toolName)) {
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
      .filter((reg) => reg.source === ToolSource.GLOBAL)
      .map((reg) => reg.tool);

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
    source: ToolSource;
    enabled: boolean;
  }> {
    const registrations = this.toolManager.getAllTools();
    return registrations.map((reg) => ({
      componentKey:
        reg.source === ToolSource.COMPONENT
          ? reg.providerId.replace('component:', '')
          : undefined,
      toolName: reg.tool.toolName,
      tool: reg.tool,
      source: reg.source,
      enabled: reg.enabled,
    }));
  }

  getGlobalTools(): Map<string, Tool> {
    const globalToolsMap = new Map<string, Tool>();
    const allTools = this.toolManager.getAllTools();
    for (const registration of allTools) {
      if (registration.source === ToolSource.GLOBAL) {
        globalToolsMap.set(registration.tool.toolName, registration.tool);
      }
    }
    return globalToolsMap;
  }

  isToolAvailable(toolName: string): boolean {
    return this.toolManager.isToolEnabled(toolName);
  }

  getAvailableTools(): Tool[] {
    return this.toolManager.getAvailableTools();
  }

  getToolSource(
    toolName: string,
  ): { source: ToolSource; owner: string } | null {
    const source = this.toolManager.getToolSource(toolName);
    if (source) {
      return {
        source: source.source,
        owner: source.providerId,
      };
    }
    return null;
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
