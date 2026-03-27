import { ReactiveToolComponent } from 'agent-lib/components';
import type { ExportOptions, ToolCallResult } from 'agent-lib/components';
import { TUIElement, tdiv, th, tp } from 'agent-lib/components/ui';
import { createPrismaFlowToolSet } from './prismaFlowTools.js';
import type {
  DatabaseFlow,
  OtherMethodsFlow,
  IncludedStudies,
  ExclusionReason,
  PrismaFlowDiagram,
} from './prismaFlowSchemas.js';

export interface ValidationResult {
  isValid: boolean;
  message: string;
  warnings: string[];
}

interface PrismaFlowState {
  databaseFlow: DatabaseFlow;
  otherMethodsFlow: OtherMethodsFlow;
  included: IncludedStudies;
  validationResult: ValidationResult | null;
  exportResult: string | null;
}

export class PrismaFlowComponent extends ReactiveToolComponent<PrismaFlowState> {
  override componentId = 'prisma-flow';
  override displayName = 'PRISMA Flow Diagram';
  override description =
    'Build PRISMA 2020 flow diagrams for systematic reviews';
  override componentPrompt = `## PRISMA Flow Diagram

This component builds PRISMA 2020 flow diagrams for systematic reviews and meta-analyses.

**Workflow:**
1. Add identification records from databases (databases, registers)
2. Add screening records (duplicates removed, screened records)
3. Add eligibility records (full-text assessed, excluded records)
4. Add included studies (new studies, ongoing studies)
5. Validate the diagram for completeness
6. Export in various formats

**Best Practices:**
- Follow PRISMA 2020 guidelines for accurate reporting
- Include both new and ongoing studies
- Track exclusion reasons at each stage
- Export final diagram for publication`;

  constructor() {
    super();
  }

  protected override initialState(): PrismaFlowState {
    return {
      databaseFlow: {},
      otherMethodsFlow: {},
      included: { studiesIncluded: 0, reportsIncluded: 0 },
      validationResult: null,
      exportResult: null,
    };
  }

  protected override toolDefs() {
    const tools = createPrismaFlowToolSet();
    const defs: Record<
      string,
      { desc: string; paramsSchema: any; examples?: any[] }
    > = {};
    for (const [name, tool] of tools) {
      defs[name] = {
        desc: tool.desc,
        paramsSchema: tool.paramsSchema,
        examples: tool.examples,
      };
    }
    return defs;
  }

  renderImply = async () => {
    const elements: TUIElement[] = [];
    const s = this.snapshot;

    elements.push(
      new th({
        content: 'PRISMA 2020 Flow Diagram',
      }),
    );

    if (s.validationResult) {
      elements.push(this.renderValidationResult());
    }

    if (s.exportResult) {
      elements.push(this.renderExportResult());
    }

    elements.push(this.renderFlowDiagramAsText());

    return elements;
  };

  private renderValidationResult(): TUIElement {
    const container = new tdiv({});
    const s = this.snapshot;

    const status = s.validationResult!.isValid ? 'VALID' : 'ISSUES FOUND';

    container.addChild(
      new th({
        content: `Validation: ${status}`,
        level: 2,
      }),
    );

    container.addChild(
      new tp({
        content: s.validationResult!.message,
      }),
    );

    if (s.validationResult!.warnings.length > 0) {
      container.addChild(
        new tp({
          content: 'Warnings:',
        }),
      );
      s.validationResult!.warnings.forEach((warning) => {
        container.addChild(
          new tp({
            content: `- ${warning}`,
          }),
        );
      });
    }

    return container;
  }

  private renderExportResult(): TUIElement {
    const container = new tdiv({});
    const s = this.snapshot;

    container.addChild(
      new th({
        content: 'Export Result',
        level: 2,
      }),
    );

    container.addChild(
      new tp({
        content: s.exportResult!,
      }),
    );

    return container;
  }

  private renderFlowDiagramAsText(): TUIElement {
    const container = new tdiv({});
    const s = this.snapshot;

    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('PRISMA 2020 FLOW DIAGRAM');
    lines.push('='.repeat(60));
    lines.push('');

    lines.push('IDENTIFICATION');
    lines.push('-'.repeat(40));
    const dbTotal =
      (s.databaseFlow.identification?.databases || 0) +
      (s.databaseFlow.identification?.registers || 0);
    const otherTotal =
      (s.otherMethodsFlow.identification?.websites || 0) +
      (s.otherMethodsFlow.identification?.organisations || 0) +
      (s.otherMethodsFlow.identification?.citationSearching || 0) +
      (s.otherMethodsFlow.identification?.other || 0);
    lines.push(`Records identified from databases & registers: n = ${dbTotal}`);
    lines.push(`Records identified from other methods: n = ${otherTotal}`);
    lines.push('');

    if (dbTotal > 0) {
      lines.push('DATABASE & REGISTERS FLOW');
      lines.push('-'.repeat(40));

      lines.push(
        `  Databases: n = ${s.databaseFlow.identification?.databases || 0}`,
      );
      lines.push(
        `  Registers: n = ${s.databaseFlow.identification?.registers || 0}`,
      );
      lines.push('');

      const removedTotal =
        (s.databaseFlow.recordsRemoved?.duplicates || 0) +
        (s.databaseFlow.recordsRemoved?.automationTools || 0) +
        (s.databaseFlow.recordsRemoved?.otherReasons || 0);
      if (removedTotal > 0) {
        lines.push(`Records removed before screening: n = ${removedTotal}`);
        lines.push(
          `  - Duplicate records: n = ${s.databaseFlow.recordsRemoved?.duplicates || 0}`,
        );
        lines.push(
          `  - Records marked ineligible by automation tools: n = ${s.databaseFlow.recordsRemoved?.automationTools || 0}`,
        );
        lines.push(
          `  - Records removed for other reasons: n = ${s.databaseFlow.recordsRemoved?.otherReasons || 0}`,
        );
        lines.push('');
      }

      const screened = s.databaseFlow.screening?.recordsScreened || 0;
      lines.push(`Records screened: n = ${screened}`);

      const excluded = s.databaseFlow.screening?.recordsExcluded || 0;
      if (excluded > 0) {
        lines.push(`Records excluded: n = ${excluded}`);
        const reasons = s.databaseFlow.screening?.exclusionReasons || [];
        if (reasons.length > 0) {
          reasons.forEach((r) => {
            lines.push(`  - ${r.reason}: n = ${r.count}`);
          });
        }
        lines.push('');
      }

      const sought = s.databaseFlow.retrieval?.reportsSought || 0;
      if (sought > 0) {
        lines.push(`Reports sought for retrieval: n = ${sought}`);

        const notRetrieved = s.databaseFlow.retrieval?.reportsNotRetrieved || 0;
        if (notRetrieved > 0) {
          lines.push(`Reports not retrieved: n = ${notRetrieved}`);
        }
        lines.push('');
      }

      const assessed = s.databaseFlow.assessment?.reportsAssessed || 0;
      if (assessed > 0) {
        lines.push(`Reports assessed for eligibility: n = ${assessed}`);

        const assessedExcluded =
          s.databaseFlow.assessment?.reportsExcluded || 0;
        if (assessedExcluded > 0) {
          lines.push(`Reports excluded: n = ${assessedExcluded}`);
          const reasons = s.databaseFlow.assessment?.exclusionReasons || [];
          if (reasons.length > 0) {
            reasons.forEach((r) => {
              lines.push(`  - ${r.reason}: n = ${r.count}`);
            });
          }
        }
        lines.push('');
      }
    }

    if (otherTotal > 0) {
      lines.push('OTHER METHODS FLOW');
      lines.push('-'.repeat(40));

      if (s.otherMethodsFlow.identification?.websites) {
        lines.push(
          `  Websites: n = ${s.otherMethodsFlow.identification.websites}`,
        );
      }
      if (s.otherMethodsFlow.identification?.organisations) {
        lines.push(
          `  Organisations: n = ${s.otherMethodsFlow.identification.organisations}`,
        );
      }
      if (s.otherMethodsFlow.identification?.citationSearching) {
        lines.push(
          `  Citation searching: n = ${s.otherMethodsFlow.identification.citationSearching}`,
        );
      }
      if (s.otherMethodsFlow.identification?.other) {
        lines.push(`  Other: n = ${s.otherMethodsFlow.identification.other}`);
      }
      lines.push('');

      const sought = s.otherMethodsFlow.retrieval?.reportsSought || 0;
      if (sought > 0) {
        lines.push(`Reports sought for retrieval: n = ${sought}`);

        const notRetrieved =
          s.otherMethodsFlow.retrieval?.reportsNotRetrieved || 0;
        if (notRetrieved > 0) {
          lines.push(`Reports not retrieved: n = ${notRetrieved}`);
        }
        lines.push('');
      }

      const assessed = s.otherMethodsFlow.assessment?.reportsAssessed || 0;
      if (assessed > 0) {
        lines.push(`Reports assessed for eligibility: n = ${assessed}`);

        const assessedExcluded =
          s.otherMethodsFlow.assessment?.reportsExcluded || 0;
        if (assessedExcluded > 0) {
          lines.push(`Reports excluded: n = ${assessedExcluded}`);
          const reasons = s.otherMethodsFlow.assessment?.exclusionReasons || [];
          if (reasons.length > 0) {
            reasons.forEach((r) => {
              lines.push(`  - ${r.reason}: n = ${r.count}`);
            });
          }
        }
        lines.push('');
      }
    }

    lines.push('INCLUDED');
    lines.push('-'.repeat(40));
    lines.push(
      `Studies included in review: n = ${s.included.studiesIncluded || 0}`,
    );
    lines.push(
      `Reports of included studies: n = ${s.included.reportsIncluded || 0}`,
    );
    lines.push('');
    lines.push('='.repeat(60));

    container.addChild(
      new tp({
        content: lines.join('\n'),
      }),
    );

    return container;
  }

  async onSet_identification(params: any): Promise<ToolCallResult<any>> {
    const {
      flow,
      databases,
      registers,
      websites,
      organisations,
      citationSearching,
      other,
    } = params;
    const s = this.snapshot;

    if (flow === 'database') {
      this.reactive.databaseFlow.identification = {
        ...(s.databaseFlow.identification || {}),
        ...(databases !== undefined && { databases }),
        ...(registers !== undefined && { registers }),
      };
    } else {
      this.reactive.otherMethodsFlow.identification = {
        ...(s.otherMethodsFlow.identification || {}),
        ...(websites !== undefined && { websites }),
        ...(organisations !== undefined && { organisations }),
        ...(citationSearching !== undefined && { citationSearching }),
        ...(other !== undefined && { other }),
      };
    }

    this.reactive.validationResult = null;
    this.reactive.exportResult = null;

    return {
      success: true,
      data: { flow },
      summary: `[PRISMA Flow] 设置识别阶段: ${flow}`,
    };
  }

  async onSet_records_removed(params: any): Promise<ToolCallResult<any>> {
    const { duplicates, automationTools, otherReasons } = params;
    const s = this.snapshot;

    this.reactive.databaseFlow.recordsRemoved = {
      ...(s.databaseFlow.recordsRemoved || {}),
      ...(duplicates !== undefined && { duplicates }),
      ...(automationTools !== undefined && { automationTools }),
      ...(otherReasons !== undefined && { otherReasons }),
    };

    this.reactive.validationResult = null;
    this.reactive.exportResult = null;

    return {
      success: true,
      data: { duplicates, automationTools, otherReasons },
      summary: `[PRISMA Flow] 设置移除记录`,
    };
  }

  async onSet_screening(params: any): Promise<ToolCallResult<any>> {
    const { recordsScreened, recordsExcluded, exclusionReasons } = params;
    const s = this.snapshot;

    this.reactive.databaseFlow.screening = {
      ...(s.databaseFlow.screening || {}),
      ...(recordsScreened !== undefined && { recordsScreened }),
      ...(recordsExcluded !== undefined && { recordsExcluded }),
      ...(exclusionReasons !== undefined && { exclusionReasons }),
    };

    this.reactive.validationResult = null;
    this.reactive.exportResult = null;

    return {
      success: true,
      data: { recordsScreened, recordsExcluded },
      summary: `[PRISMA Flow] 设置筛选: ${recordsScreened} 待筛选, ${recordsExcluded} 排除`,
    };
  }

  async onSet_retrieval(params: any): Promise<ToolCallResult<any>> {
    const { flow, reportsSought, reportsNotRetrieved } = params;
    const s = this.snapshot;

    const data = {
      ...(reportsSought !== undefined && { reportsSought }),
      ...(reportsNotRetrieved !== undefined && { reportsNotRetrieved }),
    };

    if (flow === 'database') {
      this.reactive.databaseFlow.retrieval = {
        ...(s.databaseFlow.retrieval || {}),
        ...data,
      };
    } else {
      this.reactive.otherMethodsFlow.retrieval = {
        ...(s.otherMethodsFlow.retrieval || {}),
        ...data,
      };
    }

    this.reactive.validationResult = null;
    this.reactive.exportResult = null;

    return {
      success: true,
      data: { flow, reportsSought, reportsNotRetrieved },
      summary: `[PRISMA Flow] 设置检索: ${flow}`,
    };
  }

  async onSet_assessment(params: any): Promise<ToolCallResult<any>> {
    const { flow, reportsAssessed, reportsExcluded, exclusionReasons } = params;
    const s = this.snapshot;

    const data = {
      ...(reportsAssessed !== undefined && { reportsAssessed }),
      ...(reportsExcluded !== undefined && { reportsExcluded }),
      ...(exclusionReasons !== undefined && { exclusionReasons }),
    };

    if (flow === 'database') {
      this.reactive.databaseFlow.assessment = {
        ...(s.databaseFlow.assessment || {}),
        ...data,
      };
    } else {
      this.reactive.otherMethodsFlow.assessment = {
        ...(s.otherMethodsFlow.assessment || {}),
        ...data,
      };
    }

    this.reactive.validationResult = null;
    this.reactive.exportResult = null;

    return {
      success: true,
      data: { flow, reportsAssessed, reportsExcluded },
      summary: `[PRISMA Flow] 设置评估: ${flow}`,
    };
  }

  async onSet_included(params: any): Promise<ToolCallResult<any>> {
    const { studiesIncluded, reportsIncluded } = params;
    const s = this.snapshot;

    this.reactive.included = {
      ...(s.included || {}),
      ...(studiesIncluded !== undefined && { studiesIncluded }),
      ...(reportsIncluded !== undefined && { reportsIncluded }),
    };

    this.reactive.validationResult = null;
    this.reactive.exportResult = null;

    return {
      success: true,
      data: { studiesIncluded, reportsIncluded },
      summary: `[PRISMA Flow] 设置纳入研究: ${studiesIncluded} 研究, ${reportsIncluded} 报告`,
    };
  }

  async onAdd_exclusion_reason(params: any): Promise<ToolCallResult<any>> {
    const { phase, flow, reason, count } = params;
    const s = this.snapshot;

    const newReason: ExclusionReason = { reason, count };

    if (phase === 'screening') {
      const current = s.databaseFlow.screening?.exclusionReasons || [];
      this.reactive.databaseFlow.screening = {
        ...s.databaseFlow.screening,
        exclusionReasons: [...current, newReason],
      };
    } else {
      if (flow === 'database') {
        const current = s.databaseFlow.assessment?.exclusionReasons || [];
        this.reactive.databaseFlow.assessment = {
          ...s.databaseFlow.assessment,
          exclusionReasons: [...current, newReason],
        };
      } else {
        const current = s.otherMethodsFlow.assessment?.exclusionReasons || [];
        this.reactive.otherMethodsFlow.assessment = {
          ...s.otherMethodsFlow.assessment,
          exclusionReasons: [...current, newReason],
        };
      }
    }

    this.reactive.validationResult = null;
    this.reactive.exportResult = null;

    return {
      success: true,
      data: { phase, flow, reason, count },
      summary: `[PRISMA Flow] 添加排除原因: ${reason}`,
    };
  }

  async onExport_flow_diagram(params: any): Promise<ToolCallResult<any>> {
    const { format } = params;

    switch (format) {
      case 'json':
        this.reactive.exportResult = this.generateJsonOutput();
        break;
      case 'markdown':
        this.reactive.exportResult = this.generateMarkdownOutput();
        break;
      case 'mermaid':
        this.reactive.exportResult = this.generateMermaidOutput();
        break;
      default:
        return {
          success: false,
          data: { error: `Invalid export format: ${format}` },
          summary: `[PRISMA Flow] 无效导出格式: ${format}`,
        };
    }

    return {
      success: true,
      data: { format },
      summary: `[PRISMA Flow] 导出流程图: ${format} 格式`,
    };
  }

  async onClear_flow_diagram(params: any): Promise<ToolCallResult<any>> {
    const { confirm } = params;

    if (!confirm) {
      return {
        success: false,
        data: {
          error:
            'Clearing the flow diagram requires confirmation. Set confirm=true to proceed.',
        },
        summary: `[PRISMA Flow] 清除流程图需要确认`,
      };
    }

    this.reactive.databaseFlow = {};
    this.reactive.otherMethodsFlow = {};
    this.reactive.included = { studiesIncluded: 0, reportsIncluded: 0 };
    this.reactive.validationResult = null;
    this.reactive.exportResult = null;

    return {
      success: true,
      data: { cleared: true },
      summary: `[PRISMA Flow] 已清除流程图`,
    };
  }

  async onValidate_flow_diagram(): Promise<ToolCallResult<any>> {
    const s = this.snapshot;
    const warnings: string[] = [];
    let isValid = true;

    const hasDbIdentification =
      (s.databaseFlow.identification?.databases || 0) > 0 ||
      (s.databaseFlow.identification?.registers || 0) > 0;
    const hasOtherIdentification =
      (s.otherMethodsFlow.identification?.websites || 0) > 0 ||
      (s.otherMethodsFlow.identification?.organisations || 0) > 0 ||
      (s.otherMethodsFlow.identification?.citationSearching || 0) > 0;

    if (!hasDbIdentification && !hasOtherIdentification) {
      warnings.push('No identification data provided');
      isValid = false;
    }

    if ((s.included.studiesIncluded || 0) === 0) {
      warnings.push('No included studies count provided');
    }

    if (hasDbIdentification) {
      const idTotal =
        (s.databaseFlow.identification?.databases || 0) +
        (s.databaseFlow.identification?.registers || 0);
      const removedTotal =
        (s.databaseFlow.recordsRemoved?.duplicates || 0) +
        (s.databaseFlow.recordsRemoved?.automationTools || 0) +
        (s.databaseFlow.recordsRemoved?.otherReasons || 0);
      const screened = s.databaseFlow.screening?.recordsScreened || 0;

      if (screened > 0 && idTotal - removedTotal !== screened) {
        warnings.push('Database flow: Identification - Removed ≠ Screened');
      }
    }

    let message = '';
    if (isValid && warnings.length === 0) {
      message = 'Flow diagram data is valid and complete.';
    } else if (isValid) {
      message = 'Flow diagram data is valid but has some warnings.';
    } else {
      message = 'Flow diagram data has issues that need to be addressed.';
    }

    this.reactive.validationResult = {
      isValid,
      message,
      warnings,
    };

    return {
      success: isValid,
      data: this.reactive.validationResult,
      summary: `[PRISMA Flow] 验证: ${isValid ? '有效' : '有问题'}`,
    };
  }

  async onAuto_calculate(params: any): Promise<ToolCallResult<any>> {
    const { flow } = params;
    const s = this.snapshot;

    if (flow === 'database' || flow === 'both') {
      const idTotal =
        (s.databaseFlow.identification?.databases || 0) +
        (s.databaseFlow.identification?.registers || 0);
      const removedTotal =
        (s.databaseFlow.recordsRemoved?.duplicates || 0) +
        (s.databaseFlow.recordsRemoved?.automationTools || 0) +
        (s.databaseFlow.recordsRemoved?.otherReasons || 0);

      if (idTotal > 0 && !s.databaseFlow.screening?.recordsScreened) {
        this.reactive.databaseFlow.screening = {
          ...s.databaseFlow.screening,
          recordsScreened: Math.max(0, idTotal - removedTotal),
        };
      }

      const sought = s.databaseFlow.retrieval?.reportsSought || 0;
      const notRetrieved = s.databaseFlow.retrieval?.reportsNotRetrieved || 0;

      if (sought > 0 && !s.databaseFlow.assessment?.reportsAssessed) {
        this.reactive.databaseFlow.assessment = {
          ...s.databaseFlow.assessment,
          reportsAssessed: Math.max(0, sought - notRetrieved),
        };
      }
    }

    if (flow === 'other' || flow === 'both') {
      const sought = s.otherMethodsFlow.retrieval?.reportsSought || 0;
      const notRetrieved =
        s.otherMethodsFlow.retrieval?.reportsNotRetrieved || 0;

      if (sought > 0 && !s.otherMethodsFlow.assessment?.reportsAssessed) {
        this.reactive.otherMethodsFlow.assessment = {
          ...s.otherMethodsFlow.assessment,
          reportsAssessed: Math.max(0, sought - notRetrieved),
        };
      }
    }

    this.reactive.validationResult = null;
    this.reactive.exportResult = null;

    return {
      success: true,
      data: { flow },
      summary: `[PRISMA Flow] 自动计算: ${flow}`,
    };
  }

  private generateJsonOutput(): string {
    const s = this.snapshot;
    const output: PrismaFlowDiagram = {
      databaseFlow: s.databaseFlow,
      otherMethodsFlow: s.otherMethodsFlow,
      included: s.included,
    };

    return JSON.stringify(output, null, 2);
  }

  private generateMarkdownOutput(): string {
    const s = this.snapshot;
    let output = '# PRISMA 2020 Flow Diagram\n\n';

    output += '## Identification\n\n';
    output += `- **Databases & Registers**: n = ${(s.databaseFlow.identification?.databases || 0) + (s.databaseFlow.identification?.registers || 0)}\n`;
    output += `- **Other Methods**: n = ${(s.otherMethodsFlow.identification?.websites || 0) + (s.otherMethodsFlow.identification?.organisations || 0) + (s.otherMethodsFlow.identification?.citationSearching || 0) + (s.otherMethodsFlow.identification?.other || 0)}\n\n`;

    output += '## Database & Registers Flow\n\n';

    output += '## Included\n\n';
    output += `- **Studies included in review**: n = ${s.included.studiesIncluded || 0}\n`;
    output += `- **Reports of included studies**: n = ${s.included.reportsIncluded || 0}\n`;

    return output;
  }

  private generateMermaidOutput(): string {
    const s = this.snapshot;
    let output = 'flowchart TD\n\n';
    output += '%% PRISMA 2020 Flow Diagram - LLM Friendly Format\n\n';

    const nodeId = (id: string) => id.replace(/\s+/g, '_');

    const dbTotal =
      (s.databaseFlow.identification?.databases || 0) +
      (s.databaseFlow.identification?.registers || 0);
    const otherTotal =
      (s.otherMethodsFlow.identification?.websites || 0) +
      (s.otherMethodsFlow.identification?.organisations || 0) +
      (s.otherMethodsFlow.identification?.citationSearching || 0) +
      (s.otherMethodsFlow.identification?.other || 0);

    output += `    ${nodeId('Identification_DB')}["Databases & Registers (n=${dbTotal})"]\n`;
    output += `    ${nodeId('Identification_Other')}["Other Methods (n=${otherTotal})"]\n\n`;

    if (dbTotal > 0) {
      const screened = s.databaseFlow.screening?.recordsScreened || 0;
      const sought = s.databaseFlow.retrieval?.reportsSought || 0;
      const assessed = s.databaseFlow.assessment?.reportsAssessed || 0;

      output += `    ${nodeId('Identification_DB')} --> ${nodeId('Screened_DB')}["Screened (n=${screened})"]\n`;
      if (sought > 0) {
        output += `    ${nodeId('Screened_DB')} --> ${nodeId('Sought_DB')}["Reports Sought (n=${sought})"]\n`;
      }
      if (assessed > 0) {
        output += `    ${nodeId('Sought_DB')} --> ${nodeId('Assessed_DB')}["Assessed (n=${assessed})"]\n`;
      }
    }

    if (otherTotal > 0) {
      const sought = s.otherMethodsFlow.retrieval?.reportsSought || 0;
      const assessed = s.otherMethodsFlow.assessment?.reportsAssessed || 0;

      output += `    ${nodeId('Identification_Other')} --> ${nodeId('Sought_Other')}["Reports Sought (n=${sought})"]\n`;
      if (assessed > 0) {
        output += `    ${nodeId('Sought_Other')} --> ${nodeId('Assessed_Other')}["Assessed (n=${assessed})"]\n`;
      }
    }

    const studiesIncluded = s.included.studiesIncluded || 0;
    output += `\n    ${nodeId('Assessed_DB')} --> ${nodeId('Included')}["Studies Included (n=${studiesIncluded})"]\n`;
    output += `    ${nodeId('Assessed_Other')} --> ${nodeId('Included')}\n`;

    return output;
  }

  getFlowDiagram(): PrismaFlowDiagram {
    const s = this.snapshot;
    return {
      databaseFlow: s.databaseFlow,
      otherMethodsFlow: s.otherMethodsFlow,
      included: s.included,
    };
  }

  async exportData(options?: ExportOptions) {
    return {
      data: this.getFlowDiagram(),
      format: options?.format ?? 'json',
      metadata: {
        componentId: this.componentId,
        exportedAt: new Date().toISOString(),
      },
    };
  }
}
