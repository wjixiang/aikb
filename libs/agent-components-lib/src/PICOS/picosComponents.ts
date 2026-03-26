import { ToolComponent, ExportOptions } from 'agent-lib/core/toolComponent';
import { Tool } from 'agent-lib/core/types';
import { TUIElement, tdiv, th, tp } from 'agent-lib/components/ui/index';
import type { ToolCallResult } from 'agent-lib/core/types';
import { createPicosToolSet } from './picosTools.js';
import type {
  Patient,
  Intervention,
  Comparison,
  Outcome,
  StudyDesign,
  PICOS,
} from './picosSchemas.js';

export class PicosComponent extends ToolComponent {
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

  toolSet: Map<string, Tool>;
  handleToolCall: (
    toolName: string,
    params: any,
  ) => Promise<ToolCallResult<any>>;

  currentPicos: PICOS = {};
  generatedQuestion: string | null = null;
  validationResult: {
    isValid: boolean;
    message: string;
    missingElements: string[];
  } | null = null;
  exportResult: string | null = null;

  constructor() {
    super();
    this.toolSet = this.initializeToolSet();
    this.handleToolCall = this.handleToolCallImpl.bind(this);
  }

  private initializeToolSet(): Map<string, Tool> {
    return createPicosToolSet();
  }

  renderImply = async () => {
    const elements: TUIElement[] = [];

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
    if (this.generatedQuestion) {
      elements.push(this.renderGeneratedQuestion());
    }

    // Render validation result if available
    if (this.validationResult) {
      elements.push(this.renderValidationResult());
    }

    // Render export result if available
    if (this.exportResult) {
      elements.push(this.renderExportResult());
    }

    // Render current PICOS elements
    elements.push(this.renderCurrentPicos());

    // Render welcome message if no elements set
    if (
      !this.currentPicos.patient &&
      !this.currentPicos.intervention &&
      !this.currentPicos.comparison &&
      !this.currentPicos.outcome &&
      !this.currentPicos.studyDesign
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
        content: this.generatedQuestion!,
        indent: 1,
      }),
    );

    return container;
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

    if (this.validationResult!.missingElements.length > 0) {
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
      this.validationResult!.missingElements.forEach((element) => {
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
        content: this.exportResult!,
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

    // Patient
    if (this.currentPicos.patient) {
      container.addChild(
        this.renderPicosElement(
          'P - Patient/Problem',
          this.currentPicos.patient,
        ),
      );
    }

    // Intervention
    if (this.currentPicos.intervention) {
      container.addChild(
        this.renderPicosElement(
          'I - Intervention',
          this.currentPicos.intervention,
        ),
      );
    }

    // Comparison
    if (this.currentPicos.comparison) {
      container.addChild(
        this.renderPicosElement('C - Comparison', this.currentPicos.comparison),
      );
    }

    // Outcome
    if (this.currentPicos.outcome) {
      container.addChild(
        this.renderPicosElement('O - Outcome', this.currentPicos.outcome),
      );
    }

    // Study Design
    if (this.currentPicos.studyDesign) {
      container.addChild(
        this.renderPicosElement(
          'S - Study Design',
          this.currentPicos.studyDesign,
        ),
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

  private async handleToolCallImpl(
    toolName: string,
    params: any,
  ): Promise<ToolCallResult<any>> {
    switch (toolName) {
      case 'set_picos_element':
        return this.handleSetPicosElement(params);
      case 'generate_clinical_question':
        return this.handleGenerateClinicalQuestion(params);
      case 'validate_picos':
        return this.handleValidatePicos();
      case 'clear_picos':
        return this.handleClearPicos();
      case 'export_picos':
        return this.handleExportPicos(params);
      default:
        return {
          success: false,
          data: { error: `Unknown tool: ${toolName}` },
          summary: `[PICOS] 未知工具: ${toolName}`,
        };
    }
  }

  private handleSetPicosElement(params: any): ToolCallResult<any> {
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

    (this.currentPicos as any)[element] = processedData;

    // Clear previous results since PICOS changed
    this.generatedQuestion = null;
    this.validationResult = null;
    this.exportResult = null;

    return {
      success: true,
      data: { element },
      summary: `[PICOS] 设置 ${element}`,
    };
  }

  private handleGenerateClinicalQuestion(params: any): ToolCallResult<any> {
    const format = params.format || 'both';

    if (
      !this.currentPicos.patient &&
      !this.currentPicos.intervention &&
      !this.currentPicos.comparison &&
      !this.currentPicos.outcome
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

    if (this.currentPicos.patient) {
      parts.push(`In ${this.currentPicos.patient.description}`);
    }

    if (this.currentPicos.intervention) {
      parts.push(`does ${this.currentPicos.intervention.description}`);
    }

    if (this.currentPicos.comparison) {
      parts.push(`compared to ${this.currentPicos.comparison.description}`);
    }

    if (this.currentPicos.outcome) {
      parts.push(`affect ${this.currentPicos.outcome.description}`);
    }

    if (this.currentPicos.studyDesign) {
      parts.push(`(${this.currentPicos.studyDesign.description})`);
    }

    const question = parts.join(' ') + '?';

    if (format === 'question' || format === 'both') {
      this.generatedQuestion = question;
    } else {
      this.generatedQuestion = null;
    }

    // If structured format is requested, include it in export result
    if (format === 'structured' || format === 'both') {
      this.exportResult = this.generateStructuredOutput();
    }

    return {
      success: true,
      data: { question: this.generatedQuestion, format },
      summary: `[PICOS] 生成临床问题`,
    };
  }

  private handleValidatePicos(): ToolCallResult<any> {
    const missingElements: string[] = [];

    if (!this.currentPicos.patient) missingElements.push('Patient/Problem');
    if (!this.currentPicos.intervention) missingElements.push('Intervention');
    if (!this.currentPicos.outcome) missingElements.push('Outcome');

    const isValid = missingElements.length === 0;

    let message = '';
    if (isValid) {
      message =
        'Your PICOS formulation is complete! You have all the essential elements for a well-structured clinical question.';
      if (!this.currentPicos.comparison) {
        message +=
          ' Note: Comparison element is optional but recommended for comprehensive questions.';
      }
      if (!this.currentPicos.studyDesign) {
        message +=
          ' Note: Study Design element can help guide your literature search strategy.';
      }
    } else {
      message = `Your PICOS formulation is incomplete. Please add the missing elements to create a complete clinical question.`;
    }

    this.validationResult = {
      isValid,
      message,
      missingElements,
    };

    return {
      success: isValid,
      data: this.validationResult,
      summary: `[PICOS] 验证: ${isValid ? '完整' : '不完整'}`,
    };
  }

  private handleClearPicos(): ToolCallResult<any> {
    this.currentPicos = {};
    this.generatedQuestion = null;
    this.validationResult = null;
    this.exportResult = null;

    return {
      success: true,
      data: { cleared: true },
      summary: `[PICOS] 已清除`,
    };
  }

  private handleExportPicos(params: any): ToolCallResult<any> {
    const format = params.format || 'markdown';

    switch (format) {
      case 'json':
        this.exportResult = JSON.stringify(this.currentPicos, null, 2);
        break;
      case 'markdown':
        this.exportResult = this.generateMarkdownOutput();
        break;
      case 'search':
        this.exportResult = this.generateSearchString();
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
    let output = '# PICOS Clinical Question\n\n';

    if (this.currentPicos.patient) {
      output += `**Patient/Problem**: ${this.currentPicos.patient.description}\n`;
      if (this.currentPicos.patient.ageGroup)
        output += `  - Age Group: ${this.currentPicos.patient.ageGroup}\n`;
      if (this.currentPicos.patient.condition)
        output += `  - Condition: ${this.currentPicos.patient.condition}\n`;
      output += '\n';
    }

    if (this.currentPicos.intervention) {
      output += `**Intervention**: ${this.currentPicos.intervention.description}\n`;
      if (this.currentPicos.intervention.type)
        output += `  - Type: ${this.currentPicos.intervention.type}\n`;
      output += '\n';
    }

    if (this.currentPicos.comparison) {
      output += `**Comparison**: ${this.currentPicos.comparison.description}\n`;
      if (this.currentPicos.comparison.type)
        output += `  - Type: ${this.currentPicos.comparison.type}\n`;
      output += '\n';
    }

    if (this.currentPicos.outcome) {
      output += `**Outcome**: ${this.currentPicos.outcome.description}\n`;
      if (this.currentPicos.outcome.type)
        output += `  - Type: ${this.currentPicos.outcome.type}\n`;
      if (this.currentPicos.outcome.timeFrame)
        output += `  - Time Frame: ${this.currentPicos.outcome.timeFrame}\n`;
      output += '\n';
    }

    if (this.currentPicos.studyDesign) {
      output += `**Study Design**: ${this.currentPicos.studyDesign.description}\n`;
      if (this.currentPicos.studyDesign.type)
        output += `  - Type: ${this.currentPicos.studyDesign.type}\n`;
    }

    return output;
  }

  private generateStructuredOutput(): string {
    let output = '## Structured PICOS Format\n\n';

    output += `| Element | Description |\n`;
    output += `|---------|-------------|\n`;

    if (this.currentPicos.patient) {
      output += `| **P** - Patient/Problem | ${this.currentPicos.patient.description} |\n`;
    }
    if (this.currentPicos.intervention) {
      output += `| **I** - Intervention | ${this.currentPicos.intervention.description} |\n`;
    }
    if (this.currentPicos.comparison) {
      output += `| **C** - Comparison | ${this.currentPicos.comparison.description} |\n`;
    }
    if (this.currentPicos.outcome) {
      output += `| **O** - Outcome | ${this.currentPicos.outcome.description} |\n`;
    }
    if (this.currentPicos.studyDesign) {
      output += `| **S** - Study Design | ${this.currentPicos.studyDesign.description} |\n`;
    }

    return output;
  }

  private generateSearchString(): string {
    const searchParts: string[] = [];

    if (this.currentPicos.patient?.condition) {
      searchParts.push(this.currentPicos.patient.condition);
    }

    if (this.currentPicos.intervention?.description) {
      searchParts.push(this.currentPicos.intervention.description);
    }

    if (this.currentPicos.comparison?.description) {
      searchParts.push(this.currentPicos.comparison.description);
    }

    if (this.currentPicos.outcome?.description) {
      searchParts.push(this.currentPicos.outcome.description);
    }

    // Join with AND for PubMed-style search
    return searchParts.join(' AND ');
  }

  async exportData(options?: ExportOptions) {
    return {
      data: {
        currentPicos: this.currentPicos,
        generatedQuestion: this.generatedQuestion,
        validationResult: this.validationResult,
        exportResult: this.exportResult,
      },
      format: options?.format ?? 'json',
      metadata: {
        componentId: this.componentId,
        exportedAt: new Date().toISOString(),
      },
    };
  }
}
