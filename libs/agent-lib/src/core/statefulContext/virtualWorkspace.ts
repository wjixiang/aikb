import { injectable, inject, optional, postConstruct } from 'inversify';
import pino from 'pino';
import {
  ToolComponent,
  type VirtualWorkspaceConfig,
  type Tool,
  type IVirtualWorkspace,
  type ToolCallResult,
  type ComponentStateBase,
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
import { ToolManager } from '../tools/ToolManager.js';
import {
  ComponentRegistry,
  type ComponentRegistration,
} from '../../components/index.js';
import { ComponentToolProvider } from '../tools/providers/ComponentToolProvider.js';
import { GlobalToolProvider } from '../tools/providers/GlobalToolProvider.js';
import type { A2AHandler } from '../a2a/index.js';

/** Component registration for DI-managed components */
export interface DIComponentRegistration {
  /** Component instance (uses component.componentId as identifier) */
  component: ToolComponent;
  /** Registration priority (higher = registered first) */
  priority?: number;
}

export const DefaultVirtualWorkspaceConfig: VirtualWorkspaceConfig = {
  id: 'default-workspace',
  name: 'Default Workspace',
  renderMode: 'tui',
  toolCallLogCount: 10,
  expertMode: false,
  alwaysRenderAllComponents: false,
};

export interface ToolCallSummary {
  toolName: string;
  success: boolean;
  summary: string;
  timestamp: number;
  componentKey?: string;
}

@injectable()
export class VirtualWorkspace implements IVirtualWorkspace {
  private config: VirtualWorkspaceConfig;
  protected componentRegistry: ComponentRegistry;
  private toolManager: IToolManager;
  private toolCallLog: ToolCallSummary[] = [];
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
    @inject(ComponentRegistry) componentRegistry: ComponentRegistry,
    @inject(GlobalToolProvider) globalToolProvider: GlobalToolProvider,
    @inject(TYPES.VirtualWorkspaceConfig)
    @optional()
    config: Partial<VirtualWorkspaceConfig> = {},
    @inject(TYPES.ToolComponents)
    @optional()
    diComponents?: DIComponentRegistration[],
    @inject(TYPES.IA2AHandler)
    @optional()
    a2aHandler?: A2AHandler,
  ) {
    this.config = {
      ...DefaultVirtualWorkspaceConfig,
      ...config,
    };

    this.componentRegistry = componentRegistry;
    this.toolManager = toolManager;
    this.globalToolProvider = globalToolProvider;
    this._a2aHandler = a2aHandler;

    if (diComponents && diComponents.length > 0) {
      for (const { component, priority } of diComponents) {
        this.componentRegistry.register(
          component.componentId,
          component,
          priority,
        );
      }
    }
  }

  @postConstruct()
  private init(): void {
    this.registerComponentTools();
    this.toolManager.registerProvider(this.globalToolProvider);
  }

  protected _registerToolProvider(component: ToolComponent): void {
    const provider = new ComponentToolProvider(
      component.componentId,
      component,
      this.notifyToolExecuted.bind(this),
    );
    this.toolManager.registerProvider(provider);
  }

  private registerComponentTools(): void {
    const registrations = this.componentRegistry.getAllRegistrations();
    for (const registration of registrations) {
      this._registerToolProvider(registration.component);
    }
  }

  getToolManager(): IToolManager {
    return this.toolManager;
  }

  getComponentRegistry(): ComponentRegistry {
    return this.componentRegistry;
  }

  getComponent(id: string): ToolComponent | undefined {
    return this.componentRegistry.get(id);
  }

  getComponentKeys(): string[] {
    return this.componentRegistry.getIds();
  }

  /**
   * Add a component dynamically after initialization
   * This registers the component and its tools
   */
  addComponent(component: ToolComponent): void {
    this.componentRegistry.register(component.componentId, component);
    this._registerToolProvider(component);
    this.logger.debug(
      { componentId: component.componentId },
      'Component added dynamically',
    );
  }

  getA2AHandler(): A2AHandler | undefined {
    return this._a2aHandler;
  }

  private onToolAvailabilityChange?: (() => void) | undefined;

  setOnToolAvailabilityChange(callback: () => void): void {
    this.onToolAvailabilityChange = callback;
  }

  private onToolExecuted?: (
    toolName: string,
    params: any,
    result: any,
    success: boolean,
    componentKey: string,
    customSummary?: string,
  ) => void;

  setOnToolExecuted(
    callback: (
      toolName: string,
      params: any,
      result: any,
      success: boolean,
      componentKey: string,
      customSummary?: string,
    ) => void,
  ): void {
    this.onToolExecuted = callback;
  }

  notifyToolExecuted(
    toolName: string,
    params: any,
    result: any,
    success: boolean,
    componentKey: string,
    customSummary?: string,
  ): void {
    const maxCount = this.config.toolCallLogCount ?? 3;

    if (maxCount <= 0) {
      return;
    }

    const summary =
      customSummary ?? this.summarizeToolResult(toolName, result, componentKey);

    this.toolCallLog.push({
      toolName,
      success,
      summary,
      timestamp: Date.now(),
      componentKey,
    });

    if (this.toolCallLog.length > maxCount) {
      this.toolCallLog = this.toolCallLog.slice(-maxCount);
    }
  }

  private summarizeToolResult(
    toolName: string,
    result: any,
    componentKey?: string,
  ): string {
    if (!result) {
      return componentKey
        ? `[${componentKey}][${toolName}] (no result)`
        : '(no result)';
    }

    try {
      let summary: string;

      if (typeof result === 'string') {
        summary =
          result.length > 200 ? result.substring(0, 200) + '...' : result;
      } else if (typeof result === 'object') {
        if ('summary' in result && typeof result.summary === 'string') {
          summary = result.summary;
        } else if ('error' in result && typeof result.error === 'string') {
          summary = `Error: ${result.error}`;
        } else if ('data' in result && typeof result.data === 'object') {
          const data = result.data as any;
          if ('error' in data && typeof data.error === 'string') {
            summary = `Error: ${data.error}`;
          } else {
            const dataStr = JSON.stringify(result.data);
            summary =
              dataStr.length > 200
                ? dataStr.substring(0, 200) + '...'
                : dataStr;
          }
        } else if ('result' in result && typeof result.result === 'string') {
          summary =
            result.result.length > 200
              ? result.result.substring(0, 200) + '...'
              : result.result;
        } else if ('message' in result) {
          const msg = String(result.message);
          summary = msg.length > 200 ? msg.substring(0, 200) + '...' : msg;
        } else {
          summary = `[${Object.keys(result).join(', ')}]`;
        }
      } else {
        summary = String(result);
      }

      return componentKey ? `[${componentKey}] ${summary}` : summary;
    } catch {
      return componentKey
        ? `[${componentKey}] (result processing failed)`
        : '(result processing failed)';
    }
  }

  getToolCallLog(): ToolCallSummary[] {
    return [...this.toolCallLog];
  }

  renderToolCallLogSectionMarkdown(): MdElement {
    const maxCount = this.config.toolCallLogCount ?? 3;
    const container = new MdDiv({ styles: { showBorder: false } }, [], 0);

    const sliderIndicator =
      this.toolCallLog.length > maxCount
        ? ` (showing last ${maxCount} of ${this.toolCallLog.length})`
        : '';
    container.addChild(
      new MdHeading({ content: `Recent Tool Calls${sliderIndicator}` }, [], 1),
    );

    const logEntries = this.toolCallLog.slice(-maxCount);
    logEntries.forEach((entry, index) => {
      const isLatest = index === logEntries.length - 1;
      const prefix = isLatest ? '**>**' : '-';
      const status = entry.success ? '`OK`' : '`FAIL`';

      container.addChild(
        new MdParagraph(
          {
            content: `${prefix} ${status} \`${entry.toolName}\`: ${entry.summary}`,
          },
          [],
          2,
        ),
      );
    });

    return container;
  }

  async renderComponentToolsSection(): Promise<TUIElement | null> {
    const componentIds = this.componentRegistry.getIds();
    const tools: Tool[] = [];

    for (const id of componentIds) {
      const component = this.componentRegistry.get(id);
      if (component) {
        for (const tool of component.toolSet.values()) {
          if (this.toolManager.isToolEnabled(tool.toolName)) {
            tools.push(tool);
          }
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

  renderToolCallLogSection(): TUIElement {
    const maxCount = this.config.toolCallLogCount ?? 10;

    const container = new tdiv({
      styles: { showBorder: false },
    });

    const sliderIndicator =
      this.toolCallLog.length > maxCount
        ? ` (showing last ${maxCount} of ${this.toolCallLog.length})`
        : '';
    container.addChild(
      new tdiv({
        content: `**Recent Tool Calls**${sliderIndicator}`,
        styles: { showBorder: false },
      }),
    );

    const logEntries = this.toolCallLog.slice(-maxCount);
    logEntries.forEach((entry, index) => {
      const isLatest = index === logEntries.length - 1;
      const prefix = isLatest ? '**>**' : '-';
      const status = entry.success ? '`OK`' : '`FAIL`';

      container.addChild(
        new tdiv({
          content: `${prefix} ${status} \`${entry.toolName}\`: ${entry.summary}`,
          styles: { showBorder: false },
        }),
      );
    });

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

    const sortedRegistrations = this.componentRegistry.getAllRegistrations();

    for (const registration of sortedRegistrations) {
      const componentContainer = new MdDiv(
        {
          content: `## ${registration.component.componentId}`,
          styles: { showBorder: true },
        },
        [],
        1,
      );

      const componentRender = await registration.component.renderImply();
      for (const element of componentRender) {
        const rendered = element.render(this.config.renderMode);
        componentContainer.addChild(
          new MdParagraph({ content: rendered }, undefined, 2),
        );
      }
      container.addChild(componentContainer);
    }

    if (this.toolCallLog.length > 0) {
      container.addChild(this.renderToolCallLogSectionMarkdown());
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

    const sortedRegistrations = this.componentRegistry.getAllRegistrations();

    for (const registration of sortedRegistrations) {
      const componentContainer = new tdiv({
        content: registration.component.componentId,
        styles: { showBorder: true },
      });

      const componentRender = await registration.component.renderImply();
      componentRender.forEach((element) =>
        componentContainer.addChild(element),
      );
      container.addChild(componentContainer);
    }

    if (this.toolCallLog.length > 0) {
      container.addChild(this.renderToolCallLogSection());
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
    const componentKeys = this.componentRegistry.getIds();
    const totalTools = this.componentRegistry.getToolCount();

    return {
      componentCount: this.componentRegistry.size,
      componentKeys,
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

    const registrations = this.componentRegistry.getAllRegistrations();
    for (const registration of registrations) {
      try {
        const result = await registration.component.exportData(options);
        results[registration.component.componentId] = result;
      } catch (error) {
        results[registration.component.componentId] = {
          data: {
            error: error instanceof Error ? error.message : String(error),
          },
          format: options?.format ?? 'json',
          metadata: {
            componentId: registration.component.componentId,
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
    const registrations = this.componentRegistry.getAllRegistrations();

    for (const registration of registrations) {
      if (registration.component.exportState) {
        try {
          states.set(
            registration.component.componentId,
            registration.component.exportState(),
          );
        } catch (error) {
          console.error(
            `[VirtualWorkspace] Failed to export state for ${registration.component.componentId}:`,
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
        const registration =
          this.componentRegistry.getRegistration(componentId);
        if (registration?.component.restoreState) {
          registration.component.restoreState(state);
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

export type { ComponentRegistration };
