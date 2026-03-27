import {
  ReactiveToolComponent,
  type ExportOptions,
} from 'agent-lib/components';
import type { ToolCallResult } from 'agent-lib/components';
import { TUIElement, tdiv, th, tp } from 'agent-lib/components/ui';
import { createPicosToolSet } from './picosTools.js';
import type {
  Patient,
  Intervention,
  Comparison,
  Outcome,
  StudyDesign,
  PICOS,
} from './picosSchemas.js';

interface PicosState {
  currentPicos: PICOS;
  generatedQuestion: string | null;
  validationResult: {
    isValid: boolean;
    message: string;
    missingElements: string[];
  } | null;
  exportResult: string | null;
}

export class PicosComponent extends ReactiveToolComponent<PicosState> {
  override componentId = 'picos';
  override displayName = 'PICOS Builder';
  override description =
    'Build PICOS clinical questions for evidence-based medicine';
  override componentPrompt = `## PICOS Clinical Question Builder

This component helps construct PICOS clinical questions for systematic reviews and evidence-based medicine.

**PICOS Elements:**
- **P**opulation: Specific patient population or disease
- **I**ntervention: Treatment or exposure being studied
- **C**omparison: Control or comparison group
- **O**utcome: Primary and secondary outcomes
- **S**tudy Design: Preferred study designs for the question

**Workflow:**
1. Define the population with specific characteristics
2. Specify the intervention of interest
3. Identify appropriate comparison group
4. Define measurable outcomes
5. Select preferred study designs
6. Generate structured clinical question

**Best Practices:**
- Be specific in population definition for focused searches
- Choose clinically relevant outcomes
- Match study designs to answer type (RCTs for interventions, cohort for prognosis)`;

  constructor() {
    super();
  }

  protected override initialState(): PicosState {
    return {
      currentPicos: {},
      generatedQuestion: null,
      validationResult: null,
      exportResult: null,
    };
  }

  protected override toolDefs() {
    const tools = createPicosToolSet();
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

    // Render header
    elements.push(
      new th({
        content: 'PICOS Clinical Question Builder',
        styles: {
          align: 'center',
        },
      }),
    );

    // Render generated question if available
    if (s.generatedQuestion) {
      elements.push(this.renderGeneratedQuestion());
    }

    // Render validation result if available
    if (s.validationResult) {
      elements.push(this.renderValidationResult());
    }

    // Render export result if available
    if (s.exportResult) {
      elements.push(this.renderExportResult());
    }

    // Render current PICOS elements
    elements.push(this.renderCurrentPicos());

    // Render welcome message if no elements set
    if (
      !s.currentPicos.patient &&
      !s.currentPicos.intervention &&
      !s.currentPicos.comparison &&
      !s.currentPicos.outcome &&
      !s.currentPicos.studyDesign
    ) {
      elements.push(
        new tdiv({
          content:
            'Welcome to PICOS Clinical Question Builder. Use the set_picos_element tool to build your clinical question.',
          styles: {
            showBorder: true,
            align: 'center',
          },
        }),
      );
    }

    return elements;
  };

  private renderGeneratedQuestion(): TUIElement {
    const container = new tdiv({
      styles: { showBorder: true, padding: { vertical: 1 } },
    });

    container.addChild(
      new th({
        content: 'Generated Clinical Question',
        level: 2,
        styles: { align: 'center' },
      }),
    );

    container.addChild(
      new tp({
        content: this.snapshot.generatedQuestion!,
        indent: 1,
      }),
    );

    return container;
  }

  private renderValidationResult(): TUIElement {
    const container = new tdiv({
      styles: { showBorder: true, padding: { vertical: 1 } },
    });

    const result = this.snapshot.validationResult!;
    const status = result.isValid ? '✓ Valid' : '✗ Incomplete';
    const statusColor = result.isValid ? 'green' : 'yellow';

    container.addChild(
      new th({
        content: `Validation Result: ${status}`,
        level: 2,
        styles: { align: 'center' },
      }),
    );

    container.addChild(
      new tp({
        content: result.message,
        indent: 1,
      }),
    );

    if (result.missingElements.length > 0) {
      container.addChild(
        new tp({
          content: '',
          indent: 1,
        }),
      );
      container.addChild(
        new tp({
          content: 'Missing Elements:',
          indent: 1,
        }),
      );
      result.missingElements.forEach((element) => {
        container.addChild(
          new tp({
            content: `  - ${element}`,
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
        content: 'Export Result',
        level: 2,
        styles: { align: 'center' },
      }),
    );

    container.addChild(
      new tp({
        content: this.snapshot.exportResult!,
        indent: 1,
      }),
    );

    return container;
  }

  private renderCurrentPicos(): TUIElement {
    const container = new tdiv({
      styles: { showBorder: true },
    });

    container.addChild(
      new th({
        content: 'Current PICOS Elements',
        level: 2,
        styles: { align: 'center' },
      }),
    );

    const s = this.snapshot.currentPicos;

    // Patient
    if (s.patient) {
      container.addChild(
        this.renderPicosElement('P - Patient/Problem', s.patient),
      );
    }

    // Intervention
    if (s.intervention) {
      container.addChild(
        this.renderPicosElement('I - Intervention', s.intervention),
      );
    }

    // Comparison
    if (s.comparison) {
      container.addChild(
        this.renderPicosElement('C - Comparison', s.comparison),
      );
    }

    // Outcome
    if (s.outcome) {
      container.addChild(this.renderPicosElement('O - Outcome', s.outcome));
    }

    // Study Design
    if (s.studyDesign) {
      container.addChild(
        this.renderPicosElement('S - Study Design', s.studyDesign),
      );
    }

    return container;
  }

  private renderPicosElement(
    label: string,
    element: Patient | Intervention | Comparison | Outcome | StudyDesign,
  ): TUIElement {
    const elementDiv = new tdiv({
      styles: { showBorder: true, padding: { vertical: 1 } },
    });

    elementDiv.addChild(
      new th({
        content: label,
        level: 3,
      }),
    );

    // Only show description if it exists and is not empty
    if (element.description && element.description.trim() !== '') {
      elementDiv.addChild(
        new tp({
          content: `Description: ${element.description}`,
          indent: 1,
        }),
      );
    }

    // Add additional fields based on element type
    for (const [key, value] of Object.entries(element)) {
      if (key !== 'description' && value !== undefined && value !== null) {
        let displayValue: string;

        if (Array.isArray(value)) {
          if (value.length === 0) {
            continue; // Skip empty arrays
          }
          // Join array elements, ensuring each element is a string
          displayValue = value
            .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
            .join(', ');
        } else if (typeof value === 'object') {
          // For objects, stringify to JSON
          displayValue = JSON.stringify(value);
        } else if (typeof value === 'string') {
          displayValue = value;
        } else {
          // For primitives (number, boolean, etc.)
          displayValue = String(value);
        }

        // Skip if the resulting value is empty
        if (displayValue.trim() === '') {
          continue;
        }

        elementDiv.addChild(
          new tp({
            content: `${this.formatKey(key)}: ${displayValue}`,
            indent: 1,
          }),
        );
      }
    }

    return elementDiv;
  }

  private formatKey(key: string): string {
    // Convert camelCase to Title Case
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase());
  }

  async onSet_picos_element(params: any): Promise<ToolCallResult<any>> {
    const { element, data } = params;

    if (
      ![
        'patient',
        'intervention',
        'comparison',
        'outcome',
        'studyDesign',
      ].includes(element)
    ) {
      return {
        success: false,
        data: { error: `Invalid PICOS element: ${element}` },
        summary: `[PICOS] 无效元素: ${element}`,
      };
    }

    // Ensure data is a plain object, not a string or array
    let processedData = data;

    // If data is a string that looks like JSON, try to parse it
    if (
      typeof data === 'string' &&
      (data.startsWith('{') || data.startsWith('['))
    ) {
      try {
        processedData = JSON.parse(data);
      } catch {
        // If parsing fails, treat it as a plain description
        processedData = { description: data };
      }
    }

    // If data is a string but not JSON, wrap it in an object
    if (typeof processedData === 'string') {
      processedData = { description: processedData };
    }

    (this.reactive.currentPicos as any)[element] = processedData;

    // Clear previous results since PICOS changed
    this.reactive.generatedQuestion = null;
    this.reactive.validationResult = null;
    this.reactive.exportResult = null;

    return {
      success: true,
      data: { element },
      summary: `[PICOS] 设置 ${element}`,
    };
  }

  async onGenerate_clinical_question(
    params: any,
  ): Promise<ToolCallResult<any>> {
    const format = params.format || 'both';
    const s = this.snapshot;

    if (
      !s.currentPicos.patient &&
      !s.currentPicos.intervention &&
      !s.currentPicos.comparison &&
      !s.currentPicos.outcome
    ) {
      return {
        success: false,
        data: {
          error:
            'At least one PICOS element must be set to generate a question',
        },
        summary: `[PICOS] 错误: 至少需要设置一个PICOS元素`,
      };
    }

    const parts: string[] = [];

    if (s.currentPicos.patient) {
      parts.push(`In ${s.currentPicos.patient.description}`);
    }

    if (s.currentPicos.intervention) {
      parts.push(`does ${s.currentPicos.intervention.description}`);
    }

    if (s.currentPicos.comparison) {
      parts.push(`compared to ${s.currentPicos.comparison.description}`);
    }

    if (s.currentPicos.outcome) {
      parts.push(`affect ${s.currentPicos.outcome.description}`);
    }

    if (s.currentPicos.studyDesign) {
      parts.push(`(${s.currentPicos.studyDesign.description})`);
    }

    const question = parts.join(' ') + '?';

    if (format === 'question' || format === 'both') {
      this.reactive.generatedQuestion = question;
    } else {
      this.reactive.generatedQuestion = null;
    }

    // If structured format is requested, include it in export result
    if (format === 'structured' || format === 'both') {
      this.reactive.exportResult = this.generateStructuredOutput();
    }

    return {
      success: true,
      data: { question: this.snapshot.generatedQuestion, format },
      summary: `[PICOS] 生成临床问题`,
    };
  }

  async onValidate_picos(_params: any): Promise<ToolCallResult<any>> {
    const s = this.snapshot;
    const missingElements: string[] = [];

    if (!s.currentPicos.patient) missingElements.push('Patient/Problem');
    if (!s.currentPicos.intervention) missingElements.push('Intervention');
    if (!s.currentPicos.outcome) missingElements.push('Outcome');

    const isValid = missingElements.length === 0;

    let message = '';
    if (isValid) {
      message =
        'Your PICOS formulation is complete! You have all the essential elements for a well-structured clinical question.';
      if (!s.currentPicos.comparison) {
        message +=
          ' Note: Comparison element is optional but recommended for comprehensive questions.';
      }
      if (!s.currentPicos.studyDesign) {
        message +=
          ' Note: Study Design element can help guide your literature search strategy.';
      }
    } else {
      message = `Your PICOS formulation is incomplete. Please add the missing elements to create a complete clinical question.`;
    }

    this.reactive.validationResult = {
      isValid,
      message,
      missingElements,
    };

    return {
      success: isValid,
      data: this.snapshot.validationResult,
      summary: `[PICOS] 验证: ${isValid ? '完整' : '不完整'}`,
    };
  }

  async onClear_picos(_params: any): Promise<ToolCallResult<any>> {
    this.reactive.currentPicos = {};
    this.reactive.generatedQuestion = null;
    this.reactive.validationResult = null;
    this.reactive.exportResult = null;

    return {
      success: true,
      data: { cleared: true },
      summary: `[PICOS] 已清除`,
    };
  }

  async onExport_picos(params: any): Promise<ToolCallResult<any>> {
    const format = params.format || 'markdown';

    switch (format) {
      case 'json':
        this.reactive.exportResult = JSON.stringify(
          this.snapshot.currentPicos,
          null,
          2,
        );
        break;
      case 'markdown':
        this.reactive.exportResult = this.generateMarkdownOutput();
        break;
      case 'search':
        this.reactive.exportResult = this.generateSearchString();
        break;
      default:
        return {
          success: false,
          data: { error: `Invalid export format: ${format}` },
          summary: `[PICOS] 无效导出格式: ${format}`,
        };
    }

    return {
      success: true,
      data: { format },
      summary: `[PICOS] 导出: ${format} 格式`,
    };
  }

  private generateMarkdownOutput(): string {
    const s = this.snapshot.currentPicos;
    let output = '# PICOS Clinical Question\n\n';

    if (s.patient) {
      output += `**Patient/Problem**: ${s.patient.description}\n`;
      if (s.patient.ageGroup)
        output += `  - Age Group: ${s.patient.ageGroup}\n`;
      if (s.patient.condition)
        output += `  - Condition: ${s.patient.condition}\n`;
      output += '\n';
    }

    if (s.intervention) {
      output += `**Intervention**: ${s.intervention.description}\n`;
      if (s.intervention.type) output += `  - Type: ${s.intervention.type}\n`;
      output += '\n';
    }

    if (s.comparison) {
      output += `**Comparison**: ${s.comparison.description}\n`;
      if (s.comparison.type) output += `  - Type: ${s.comparison.type}\n`;
      output += '\n';
    }

    if (s.outcome) {
      output += `**Outcome**: ${s.outcome.description}\n`;
      if (s.outcome.type) output += `  - Type: ${s.outcome.type}\n`;
      if (s.outcome.timeFrame)
        output += `  - Time Frame: ${s.outcome.timeFrame}\n`;
      output += '\n';
    }

    if (s.studyDesign) {
      output += `**Study Design**: ${s.studyDesign.description}\n`;
      if (s.studyDesign.type) output += `  - Type: ${s.studyDesign.type}\n`;
    }

    return output;
  }

  private generateStructuredOutput(): string {
    const s = this.snapshot.currentPicos;
    let output = '## Structured PICOS Format\n\n';

    output += `| Element | Description |\n`;
    output += `|---------|-------------|\n`;

    if (s.patient) {
      output += `| **P** - Patient/Problem | ${s.patient.description} |\n`;
    }
    if (s.intervention) {
      output += `| **I** - Intervention | ${s.intervention.description} |\n`;
    }
    if (s.comparison) {
      output += `| **C** - Comparison | ${s.comparison.description} |\n`;
    }
    if (s.outcome) {
      output += `| **O** - Outcome | ${s.outcome.description} |\n`;
    }
    if (s.studyDesign) {
      output += `| **S** - Study Design | ${s.studyDesign.description} |\n`;
    }

    return output;
  }

  private generateSearchString(): string {
    const s = this.snapshot.currentPicos;
    const searchParts: string[] = [];

    if (s.patient?.condition) {
      searchParts.push(s.patient.condition);
    }

    if (s.intervention?.description) {
      searchParts.push(s.intervention.description);
    }

    if (s.comparison?.description) {
      searchParts.push(s.comparison.description);
    }

    if (s.outcome?.description) {
      searchParts.push(s.outcome.description);
    }

    // Join with AND for PubMed-style search
    return searchParts.join(' AND ');
  }

  override async exportData(options?: ExportOptions) {
    const s = this.snapshot;
    return {
      data: {
        currentPicos: s.currentPicos,
        generatedQuestion: s.generatedQuestion,
        validationResult: s.validationResult,
        exportResult: s.exportResult,
      },
      format: options?.format ?? 'json',
      metadata: {
        componentId: this.componentId,
        exportedAt: new Date().toISOString(),
      },
    };
  }
}
