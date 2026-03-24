import { ToolComponent, ExportOptions } from '../core/toolComponent.js';
import { Tool } from '../core/types.js';
import { TUIElement, tdiv, th, tp } from '../ui/index.js';
import type { ToolCallResult } from '../core/types.js';
import { createPrismaToolSet } from './prismaTools.js';
import type { PrismaChecklistItem, PrismaChecklist } from './prismaSchemas.js';
import { DEFAULT_PRISMA_ITEMS } from './prismaSchemas.js';

export interface ManuscriptMetadata {
  title?: string;
  authors?: string[];
  registrationNumber?: string;
  registrationDate?: string;
  protocolLink?: string;
}

export interface ValidationResult {
  isValid: boolean;
  message: string;
  missingItems: number[];
  completedItems: number[];
  notApplicableItems: number[];
}

export interface ProgressResult {
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  notStartedItems: number;
  notApplicableItems: number;
  completionPercentage: number;
  sectionProgress: Record<
    string,
    {
      total: number;
      completed: number;
      percentage: number;
    }
  >;
}

export class PrismaCheckListComponent extends ToolComponent {
  override componentId = 'prisma-checklist';
  override displayName = 'PRISMA Checklist';
  override description = 'PRISMA 2020 checklist for systematic review reporting';
  override componentPrompt = `## PRISMA Checklist

This component provides the PRISMA 2020 checklist for systematic review and meta-analysis reporting.

**Purpose:**
- Ensure complete reporting of systematic reviews
- Track progress through 27 checklist items
- Identify missing information in manuscripts
- Support transparent and reproducible reporting

**Workflow:**
1. Initialize checklist with manuscript metadata
2. Work through items sequentially
3. Update item status (Yes, No, Not Applicable)
4. Add notes for items needing attention
5. Filter items by status or section
6. Export completed checklist

**Sections:**
- Title, Abstract, Introduction
- Methods (Eligibility criteria, Information sources, Study risk of bias assessment, Synthesis methods)
- Results (Study selection, Study characteristics, Risk of bias in studies, Results of syntheses)
- Discussion (Discussion, Other information)
- Funding and registration`;

  toolSet: Map<string, Tool>;
  handleToolCall: (
    toolName: string,
    params: any,
  ) => Promise<ToolCallResult<any>>;

  // Internal state
  private checklistItems: Map<number, PrismaChecklistItem> = new Map();
  private metadata: ManuscriptMetadata = {};
  private validationResult: ValidationResult | null = null;
  private progressResult: ProgressResult | null = null;
  private exportResult: string | null = null;
  private filteredItems: PrismaChecklistItem[] | null = null;

  constructor() {
    super();
    this.toolSet = this.initializeToolSet();
    this.handleToolCall = this.handleToolCallImpl.bind(this);
    this.initializeDefaultItems();
  }

  private initializeToolSet(): Map<string, Tool> {
    return createPrismaToolSet();
  }

  private initializeDefaultItems(): void {
    // Initialize all default PRISMA items
    DEFAULT_PRISMA_ITEMS.forEach((item) => {
      this.checklistItems.set(item.itemNumber, {
        ...item,
        status: 'not_started',
        location: undefined,
        notes: undefined,
      });
    });
  }

  renderImply = async () => {
    const elements: TUIElement[] = [];

    // Render header
    elements.push(
      new th({
        content: 'PRISMA 2020 Checklist',
        styles: {
          align: 'center',
        },
      }),
    );

    // Render manuscript metadata
    if (this.metadata.title || this.metadata.authors) {
      elements.push(this.renderMetadata());
    }

    // Render progress if available
    if (this.progressResult) {
      elements.push(this.renderProgress());
    }

    // Render validation result if available
    if (this.validationResult) {
      elements.push(this.renderValidationResult());
    }

    // Render export result if available
    if (this.exportResult) {
      elements.push(this.renderExportResult());
    }

    // Render checklist items (filtered or all)
    elements.push(this.renderChecklistItems());

    return elements;
  };

  private renderMetadata(): TUIElement {
    const container = new tdiv({
      styles: { showBorder: true, padding: { vertical: 1 } },
    });

    container.addChild(
      new th({
        content: '📄 Manuscript Information',
        level: 2,
        styles: { align: 'center' },
      }),
    );

    if (this.metadata.title) {
      container.addChild(
        new tp({
          content: `**Title**: ${this.metadata.title}`,
          indent: 1,
        }),
      );
    }

    if (this.metadata.authors && this.metadata.authors.length > 0) {
      container.addChild(
        new tp({
          content: `**Authors**: ${this.metadata.authors.join(', ')}`,
          indent: 1,
        }),
      );
    }

    if (this.metadata.registrationNumber) {
      container.addChild(
        new tp({
          content: `**Registration**: ${this.metadata.registrationNumber}`,
          indent: 1,
        }),
      );
    }

    if (this.metadata.registrationDate) {
      container.addChild(
        new tp({
          content: `**Registration Date**: ${this.metadata.registrationDate}`,
          indent: 1,
        }),
      );
    }

    if (this.metadata.protocolLink) {
      container.addChild(
        new tp({
          content: `**Protocol**: ${this.metadata.protocolLink}`,
          indent: 1,
        }),
      );
    }

    return container;
  }

  private renderProgress(): TUIElement {
    const container = new tdiv({
      styles: { showBorder: true, padding: { vertical: 1 } },
    });

    const progress = this.progressResult!;
    const progressBar = this.createProgressBar(progress.completionPercentage);

    container.addChild(
      new th({
        content: '📊 Checklist Progress',
        level: 2,
        styles: { align: 'center' },
      }),
    );

    container.addChild(
      new tp({
        content: `${progressBar} ${progress.completionPercentage.toFixed(1)}%`,
        indent: 1,
      }),
    );

    container.addChild(
      new tp({
        content: `Completed: ${progress.completedItems} | In Progress: ${progress.inProgressItems} | Not Started: ${progress.notStartedItems} | N/A: ${progress.notApplicableItems}`,
        indent: 1,
      }),
    );

    // Render section progress
    container.addChild(
      new tp({
        content: '',
        indent: 0,
      }),
    );

    for (const [section, sectionProgress] of Object.entries(
      progress.sectionProgress,
    )) {
      const sectionBar = this.createProgressBar(sectionProgress.percentage);
      container.addChild(
        new tp({
          content: `${section}: ${sectionBar} ${sectionProgress.completed}/${sectionProgress.total} (${sectionProgress.percentage.toFixed(0)}%)`,
          indent: 1,
        }),
      );
    }

    return container;
  }

  private createProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  }

  private renderValidationResult(): TUIElement {
    const container = new tdiv({
      styles: { showBorder: true, padding: { vertical: 1 } },
    });

    const status = this.validationResult!.isValid ? '✓ Valid' : '✗ Incomplete';
    const statusColor = this.validationResult!.isValid ? 'green' : 'yellow';

    container.addChild(
      new th({
        content: `Validation Result: ${status}`,
        level: 2,
        styles: { align: 'center' },
      }),
    );

    container.addChild(
      new tp({
        content: this.validationResult!.message,
        indent: 1,
      }),
    );

    if (this.validationResult!.missingItems.length > 0) {
      container.addChild(
        new tp({
          content: '',
          indent: 1,
        }),
      );
      container.addChild(
        new tp({
          content: 'Missing Items:',
          indent: 1,
        }),
      );
      this.validationResult!.missingItems.forEach((itemNum) => {
        const item = this.checklistItems.get(itemNum);
        container.addChild(
          new tp({
            content: `  - Item ${itemNum}: ${item?.topic || 'Unknown'}`,
            indent: 1,
          }),
        );
      });
    }

    return container;
  }

  private renderExportResult(): TUIElement {
    const container = new tdiv({
      styles: { showBorder: true, padding: { vertical: 1 } },
    });

    container.addChild(
      new th({
        content: '📋 Export Result',
        level: 2,
        styles: { align: 'center' },
      }),
    );

    container.addChild(
      new tp({
        content: this.exportResult!,
        indent: 1,
      }),
    );

    return container;
  }

  private renderChecklistItems(): TUIElement {
    const container = new tdiv({
      styles: { showBorder: true },
    });

    container.addChild(
      new th({
        content: 'Checklist Items',
        level: 2,
        styles: { align: 'center' },
      }),
    );

    const itemsToRender =
      this.filteredItems ||
      Array.from(this.checklistItems.values()).sort(
        (a, b) => a.itemNumber - b.itemNumber,
      );

    // Group by section
    const sections = new Map<string, PrismaChecklistItem[]>();
    for (const item of itemsToRender) {
      if (!sections.has(item.section)) {
        sections.set(item.section, []);
      }
      sections.get(item.section)!.push(item);
    }

    // Render each section
    for (const [section, items] of sections.entries()) {
      container.addChild(this.renderSection(section, items));
    }

    return container;
  }

  private renderSection(
    section: string,
    items: PrismaChecklistItem[],
  ): TUIElement {
    const sectionDiv = new tdiv({
      styles: { showBorder: true, padding: { vertical: 1 } },
    });

    sectionDiv.addChild(
      new th({
        content: section,
        level: 3,
      }),
    );

    for (const item of items) {
      sectionDiv.addChild(this.renderChecklistItem(item));
    }

    return sectionDiv;
  }

  private renderChecklistItem(item: PrismaChecklistItem): TUIElement {
    const itemDiv = new tdiv({
      styles: { showBorder: false, padding: { vertical: 0.5 } },
    });

    const statusIcon = this.getStatusIcon(item.status);
    const statusText = this.getStatusText(item.status);

    itemDiv.addChild(
      new tp({
        content: `${statusIcon} **Item ${item.itemNumber}** - ${item.topic} [${statusText}]`,
        indent: 1,
      }),
    );

    itemDiv.addChild(
      new tp({
        content: item.checklistItem,
        indent: 2,
      }),
    );

    if (item.location) {
      itemDiv.addChild(
        new tp({
          content: `📍 Location: ${item.location}`,
          indent: 2,
        }),
      );
    }

    if (item.notes) {
      itemDiv.addChild(
        new tp({
          content: `📝 Notes: ${item.notes}`,
          indent: 2,
        }),
      );
    }

    return itemDiv;
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '🔄';
      case 'not_applicable':
        return '⏭️';
      default:
        return '⬜';
    }
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'completed':
        return 'Done';
      case 'in_progress':
        return 'In Progress';
      case 'not_applicable':
        return 'N/A';
      default:
        return 'Not Started';
    }
  }

  private async handleToolCallImpl(
    toolName: string,
    params: any,
  ): Promise<ToolCallResult<any>> {
    switch (toolName) {
      case 'set_checklist_item':
        return this.handleSetChecklistItem(params);
      case 'set_multiple_items':
        return this.handleSetMultipleItems(params);
      case 'filter_checklist':
        return this.handleFilterChecklist(params);
      case 'export_checklist':
        return this.handleExportChecklist(params);
      case 'validate_checklist':
        return this.handleValidateChecklist(params);
      case 'clear_checklist':
        return this.handleClearChecklist(params);
      case 'get_progress':
        return this.handleGetProgress();
      case 'set_manuscript_metadata':
        return this.handleSetManuscriptMetadata(params);
      default:
        return {
          success: false,
          data: { error: `Unknown tool: ${toolName}` },
          summary: `[PRISMA] 未知工具: ${toolName}`,
        };
    }
  }

  private handleSetChecklistItem(params: any): ToolCallResult<any> {
    const { itemNumber, status, location, notes } = params;

    const item = this.checklistItems.get(itemNumber);
    if (!item) {
      return {
        success: false,
        data: { error: `Invalid item number: ${itemNumber}` },
        summary: `[PRISMA] 无效项目编号: ${itemNumber}`,
      };
    }

    // Update the item
    this.checklistItems.set(itemNumber, {
      ...item,
      status,
      location: location || item.location,
      notes: notes || item.notes,
    });

    // Clear previous results since checklist changed
    this.validationResult = null;
    this.progressResult = null;
    this.exportResult = null;
    this.filteredItems = null;

    return {
      success: true,
      data: { itemNumber, status },
      summary: `[PRISMA] 更新项目 ${itemNumber}: ${status}`,
    };
  }

  private handleSetMultipleItems(params: any): ToolCallResult<any> {
    const { items } = params;
    let updatedCount = 0;

    for (const itemUpdate of items) {
      const { itemNumber, status, location, notes } = itemUpdate;
      const item = this.checklistItems.get(itemNumber);

      if (item) {
        this.checklistItems.set(itemNumber, {
          ...item,
          status,
          location: location || item.location,
          notes: notes || item.notes,
        });
        updatedCount++;
      }
    }

    // Clear previous results since checklist changed
    this.validationResult = null;
    this.progressResult = null;
    this.exportResult = null;
    this.filteredItems = null;

    return {
      success: true,
      data: { updatedCount },
      summary: `[PRISMA] 批量更新 ${updatedCount} 个项目`,
    };
  }

  private handleFilterChecklist(params: any): ToolCallResult<any> {
    const { section, status, topic } = params;

    let filtered = Array.from(this.checklistItems.values());

    if (section) {
      filtered = filtered.filter((item) => item.section === section);
    }

    if (status) {
      filtered = filtered.filter((item) => item.status === status);
    }

    if (topic) {
      filtered = filtered.filter((item) =>
        item.topic.toLowerCase().includes(topic.toLowerCase()),
      );
    }

    this.filteredItems = filtered;
    return {
      success: true,
      data: { count: filtered.length },
      summary: `[PRISMA] 筛选结果: ${filtered.length} 个项目`,
    };
  }

  private handleExportChecklist(params: any): ToolCallResult<any> {
    const { format, includeCompletedOnly } = params;

    let items = Array.from(this.checklistItems.values());

    if (includeCompletedOnly) {
      items = items.filter((item) => item.status === 'completed');
    }

    switch (format) {
      case 'json':
        this.exportResult = this.generateJsonOutput(items);
        break;
      case 'markdown':
        this.exportResult = this.generateMarkdownOutput(items);
        break;
      case 'csv':
        this.exportResult = this.generateCsvOutput(items);
        break;
      default:
        return {
          success: false,
          data: { error: `Invalid export format: ${format}` },
          summary: `[PRISMA] 无效导出格式`,
        };
    }
    return {
      success: true,
      data: { format, count: items.length },
      summary: `[PRISMA] 导出成功: ${format} 格式, ${items.length} 个项目`,
    };
  }

  private handleValidateChecklist(params: any): ToolCallResult<any> {
    const { requiredItems } = params;

    const required =
      requiredItems || Array.from({ length: 27 }, (_, i) => i + 1);
    const missingItems: number[] = [];
    const completedItems: number[] = [];
    const notApplicableItems: number[] = [];

    for (const itemNumber of required) {
      const item = this.checklistItems.get(itemNumber);
      if (!item) continue;

      if (item.status === 'completed') {
        completedItems.push(itemNumber);
      } else if (item.status === 'not_applicable') {
        notApplicableItems.push(itemNumber);
      } else {
        missingItems.push(itemNumber);
      }
    }

    const isValid = missingItems.length === 0;

    let message = '';
    if (isValid) {
      message = `Your PRISMA checklist is complete! All ${completedItems.length} required items have been completed.`;
      if (notApplicableItems.length > 0) {
        message += ` ${notApplicableItems.length} items were marked as not applicable.`;
      }
    } else {
      message = `Your PRISMA checklist is incomplete. ${missingItems.length} required items are missing or not completed.`;
    }

    this.validationResult = {
      isValid,
      message,
      missingItems,
      completedItems,
      notApplicableItems,
    };

    return {
      success: isValid,
      data: {
        isValid,
        message,
        missingItems,
        completedItems,
        notApplicableItems,
      },
      summary: `[PRISMA] 验证完成: ${isValid ? '通过' : '未通过'}`,
    };
  }

  private handleClearChecklist(params: any): ToolCallResult<any> {
    const { confirm } = params;

    if (!confirm) {
      return {
        success: false,
        data: {
          error:
            'Clearing the checklist requires confirmation. Set confirm=true to proceed.',
        },
        summary: '[PRISMA] 清除清单需要确认',
      };
    }

    // Reset all items to not_started
    for (const [itemNumber, item] of this.checklistItems.entries()) {
      this.checklistItems.set(itemNumber, {
        ...item,
        status: 'not_started',
        location: undefined,
        notes: undefined,
      });
    }

    // Clear all results
    this.validationResult = null;
    this.progressResult = null;
    this.exportResult = null;
    this.filteredItems = null;
    this.metadata = {};

    return {
      success: true,
      data: { cleared: true },
      summary: '[PRISMA] 已清除清单',
    };
  }

  private handleGetProgress(): ToolCallResult<any> {
    const items = Array.from(this.checklistItems.values());

    const completedItems = items.filter(
      (item) => item.status === 'completed',
    ).length;
    const inProgressItems = items.filter(
      (item) => item.status === 'in_progress',
    ).length;
    const notStartedItems = items.filter(
      (item) => item.status === 'not_started',
    ).length;
    const notApplicableItems = items.filter(
      (item) => item.status === 'not_applicable',
    ).length;

    const totalItems = items.length - notApplicableItems;
    const completionPercentage =
      totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

    // Calculate section progress
    const sectionProgress: Record<
      string,
      { total: number; completed: number; percentage: number }
    > = {};

    for (const item of items) {
      if (item.status === 'not_applicable') continue;

      if (!sectionProgress[item.section]) {
        sectionProgress[item.section] = {
          total: 0,
          completed: 0,
          percentage: 0,
        };
      }

      sectionProgress[item.section].total++;
      if (item.status === 'completed') {
        sectionProgress[item.section].completed++;
      }
    }

    for (const section of Object.keys(sectionProgress)) {
      const progress = sectionProgress[section];
      progress.percentage =
        progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
    }

    this.progressResult = {
      totalItems,
      completedItems,
      inProgressItems,
      notStartedItems,
      notApplicableItems,
      completionPercentage,
      sectionProgress,
    };

    return {
      success: true,
      data: this.progressResult,
      summary: `[PRISMA] 进度: ${completedItems}/${totalItems} (${completionPercentage.toFixed(1)}%)`,
    };
  }

  private handleSetManuscriptMetadata(params: any): ToolCallResult<any> {
    const {
      title,
      authors,
      registrationNumber,
      registrationDate,
      protocolLink,
    } = params;

    this.metadata = {
      ...this.metadata,
      ...(title !== undefined && { title }),
      ...(authors !== undefined && { authors }),
      ...(registrationNumber !== undefined && { registrationNumber }),
      ...(registrationDate !== undefined && { registrationDate }),
      ...(protocolLink !== undefined && { protocolLink }),
    };

    return {
      success: true,
      data: { metadata: this.metadata },
      summary: `[PRISMA] 设置稿件元数据: ${this.metadata.title || 'Untitled'}`,
    };
  }

  private generateJsonOutput(items: PrismaChecklistItem[]): string {
    const output = {
      metadata: this.metadata,
      items: items.sort((a, b) => a.itemNumber - b.itemNumber),
    };

    return JSON.stringify(output, null, 2);
  }

  private generateMarkdownOutput(items: PrismaChecklistItem[]): string {
    let output = '# PRISMA 2020 Checklist\n\n';

    if (this.metadata.title) {
      output += `**Title**: ${this.metadata.title}\n\n`;
    }

    if (this.metadata.authors && this.metadata.authors.length > 0) {
      output += `**Authors**: ${this.metadata.authors.join(', ')}\n\n`;
    }

    if (this.metadata.registrationNumber) {
      output += `**Registration**: ${this.metadata.registrationNumber}\n\n`;
    }

    output += '## Checklist Items\n\n';

    // Group by section
    const sections = new Map<string, PrismaChecklistItem[]>();
    for (const item of items) {
      if (!sections.has(item.section)) {
        sections.set(item.section, []);
      }
      sections.get(item.section)!.push(item);
    }

    for (const [section, sectionItems] of sections.entries()) {
      output += `### ${section}\n\n`;

      for (const item of sectionItems.sort(
        (a, b) => a.itemNumber - b.itemNumber,
      )) {
        const statusIcon = this.getStatusIcon(item.status);
        output += `#### ${statusIcon} Item ${item.itemNumber}: ${item.topic}\n\n`;
        output += `${item.checklistItem}\n\n`;

        if (item.location) {
          output += `**Location**: ${item.location}\n\n`;
        }

        if (item.notes) {
          output += `**Notes**: ${item.notes}\n\n`;
        }

        output += '---\n\n';
      }
    }

    return output;
  }

  private generateCsvOutput(items: PrismaChecklistItem[]): string {
    const headers = [
      'Item #',
      'Section',
      'Topic',
      'Checklist Item',
      'Status',
      'Location',
      'Notes',
    ];
    let output = headers.join(',') + '\n';

    for (const item of items.sort((a, b) => a.itemNumber - b.itemNumber)) {
      const row = [
        item.itemNumber,
        `"${item.section}"`,
        `"${item.topic}"`,
        `"${item.checklistItem.replace(/"/g, '""')}"`,
        item.status,
        `"${(item.location || '').replace(/"/g, '""')}"`,
        `"${(item.notes || '').replace(/"/g, '""')}"`,
      ];
      output += row.join(',') + '\n';
    }

    return output;
  }

  /**
   * Get the current checklist state
   */
  getChecklist(): PrismaChecklist {
    return {
      metadata: this.metadata,
      items: Array.from(this.checklistItems.values()).sort(
        (a, b) => a.itemNumber - b.itemNumber,
      ),
    };
  }

  /**
   * Get a specific checklist item
   */
  getChecklistItem(itemNumber: number): PrismaChecklistItem | undefined {
    return this.checklistItems.get(itemNumber);
  }

  /**
   * Get manuscript metadata
   */
  getMetadata(): ManuscriptMetadata {
    return { ...this.metadata };
  }

  async exportData(options?: ExportOptions) {
    return {
      data: this.getChecklist(),
      format: options?.format ?? 'json',
      metadata: {
        componentId: this.componentId,
        exportedAt: new Date().toISOString(),
      },
    };
  }
}
