import { Tool, ToolComponent, TUIElement, tdiv, th, tp } from '../../statefulContext/index.js'
import { createPrismaFlowToolSet } from './prismaFlowTools.js'
import type {
    DatabaseFlow,
    OtherMethodsFlow,
    IncludedStudies,
    ExclusionReason,
    PrismaFlowDiagram
} from './prismaFlowSchemas.js'

export interface ValidationResult {
    isValid: boolean;
    message: string;
    warnings: string[];
}

export class PrismaFlowComponent extends ToolComponent {
    override toolSet: Map<string, Tool>;
    override handleToolCall: (toolName: string, params: any) => Promise<void>;

    // Internal state
    private databaseFlow: DatabaseFlow = {};
    private otherMethodsFlow: OtherMethodsFlow = {};
    private included: IncludedStudies = { studiesIncluded: 0, reportsIncluded: 0 };
    private validationResult: ValidationResult | null = null;
    private exportResult: string | null = null;

    constructor() {
        super();
        this.toolSet = this.initializeToolSet();
        this.handleToolCall = this.handleToolCallImpl.bind(this);
    }

    private initializeToolSet(): Map<string, Tool> {
        return createPrismaFlowToolSet();
    }

    renderImply = async () => {
        const elements: TUIElement[] = [];

        // Render header
        elements.push(new th({
            content: 'PRISMA 2020 Flow Diagram'
        }));

        // Render validation result if available
        if (this.validationResult) {
            elements.push(this.renderValidationResult());
        }

        // Render export result if available
        if (this.exportResult) {
            elements.push(this.renderExportResult());
        }

        // Render the flow diagram as structured text
        elements.push(this.renderFlowDiagramAsText());

        return elements;
    }

    private renderValidationResult(): TUIElement {
        const container = new tdiv();

        const status = this.validationResult!.isValid ? 'VALID' : 'ISSUES FOUND';

        container.addChild(new th({
            content: `Validation: ${status}`,
            level: 2
        }));

        container.addChild(new tp({
            content: this.validationResult!.message
        }));

        if (this.validationResult!.warnings.length > 0) {
            container.addChild(new tp({
                content: 'Warnings:'
            }));
            this.validationResult!.warnings.forEach(warning => {
                container.addChild(new tp({
                    content: `- ${warning}`
                }));
            });
        }

        return container;
    }

    private renderExportResult(): TUIElement {
        const container = new tdiv();

        container.addChild(new th({
            content: 'Export Result',
            level: 2
        }));

        container.addChild(new tp({
            content: this.exportResult!
        }));

        return container;
    }

    private renderFlowDiagramAsText(): TUIElement {
        const container = new tdiv();

        // Build structured text representation
        const lines: string[] = [];

        lines.push('='.repeat(60));
        lines.push('PRISMA 2020 FLOW DIAGRAM');
        lines.push('='.repeat(60));
        lines.push('');

        // IDENTIFICATION PHASE
        lines.push('IDENTIFICATION');
        lines.push('-'.repeat(40));
        const dbTotal = (this.databaseFlow.identification?.databases || 0) +
            (this.databaseFlow.identification?.registers || 0);
        const otherTotal = (this.otherMethodsFlow.identification?.websites || 0) +
            (this.otherMethodsFlow.identification?.organisations || 0) +
            (this.otherMethodsFlow.identification?.citationSearching || 0) +
            (this.otherMethodsFlow.identification?.other || 0);
        lines.push(`Records identified from databases & registers: n = ${dbTotal}`);
        lines.push(`Records identified from other methods: n = ${otherTotal}`);
        lines.push('');

        // DATABASE FLOW
        if (dbTotal > 0) {
            lines.push('DATABASE & REGISTERS FLOW');
            lines.push('-'.repeat(40));

            // Identification details
            lines.push(`  Databases: n = ${this.databaseFlow.identification?.databases || 0}`);
            lines.push(`  Registers: n = ${this.databaseFlow.identification?.registers || 0}`);
            lines.push('');

            // Records removed
            const removedTotal = (this.databaseFlow.recordsRemoved?.duplicates || 0) +
                (this.databaseFlow.recordsRemoved?.automationTools || 0) +
                (this.databaseFlow.recordsRemoved?.otherReasons || 0);
            if (removedTotal > 0) {
                lines.push(`Records removed before screening: n = ${removedTotal}`);
                lines.push(`  - Duplicate records: n = ${this.databaseFlow.recordsRemoved?.duplicates || 0}`);
                lines.push(`  - Records marked ineligible by automation tools: n = ${this.databaseFlow.recordsRemoved?.automationTools || 0}`);
                lines.push(`  - Records removed for other reasons: n = ${this.databaseFlow.recordsRemoved?.otherReasons || 0}`);
                lines.push('');
            }

            // Screening
            const screened = this.databaseFlow.screening?.recordsScreened || 0;
            lines.push(`Records screened: n = ${screened}`);

            const excluded = this.databaseFlow.screening?.recordsExcluded || 0;
            if (excluded > 0) {
                lines.push(`Records excluded: n = ${excluded}`);
                const reasons = this.databaseFlow.screening?.exclusionReasons || [];
                if (reasons.length > 0) {
                    reasons.forEach(r => {
                        lines.push(`  - ${r.reason}: n = ${r.count}`);
                    });
                }
                lines.push('');
            }

            // Reports sought
            const sought = this.databaseFlow.retrieval?.reportsSought || 0;
            if (sought > 0) {
                lines.push(`Reports sought for retrieval: n = ${sought}`);

                const notRetrieved = this.databaseFlow.retrieval?.reportsNotRetrieved || 0;
                if (notRetrieved > 0) {
                    lines.push(`Reports not retrieved: n = ${notRetrieved}`);
                }
                lines.push('');
            }

            // Assessment
            const assessed = this.databaseFlow.assessment?.reportsAssessed || 0;
            if (assessed > 0) {
                lines.push(`Reports assessed for eligibility: n = ${assessed}`);

                const assessedExcluded = this.databaseFlow.assessment?.reportsExcluded || 0;
                if (assessedExcluded > 0) {
                    lines.push(`Reports excluded: n = ${assessedExcluded}`);
                    const reasons = this.databaseFlow.assessment?.exclusionReasons || [];
                    if (reasons.length > 0) {
                        reasons.forEach(r => {
                            lines.push(`  - ${r.reason}: n = ${r.count}`);
                        });
                    }
                }
                lines.push('');
            }
        }

        // OTHER METHODS FLOW
        if (otherTotal > 0) {
            lines.push('OTHER METHODS FLOW');
            lines.push('-'.repeat(40));

            // Identification details
            if (this.otherMethodsFlow.identification?.websites) {
                lines.push(`  Websites: n = ${this.otherMethodsFlow.identification.websites}`);
            }
            if (this.otherMethodsFlow.identification?.organisations) {
                lines.push(`  Organisations: n = ${this.otherMethodsFlow.identification.organisations}`);
            }
            if (this.otherMethodsFlow.identification?.citationSearching) {
                lines.push(`  Citation searching: n = ${this.otherMethodsFlow.identification.citationSearching}`);
            }
            if (this.otherMethodsFlow.identification?.other) {
                lines.push(`  Other: n = ${this.otherMethodsFlow.identification.other}`);
            }
            lines.push('');

            // Reports sought
            const sought = this.otherMethodsFlow.retrieval?.reportsSought || 0;
            if (sought > 0) {
                lines.push(`Reports sought for retrieval: n = ${sought}`);

                const notRetrieved = this.otherMethodsFlow.retrieval?.reportsNotRetrieved || 0;
                if (notRetrieved > 0) {
                    lines.push(`Reports not retrieved: n = ${notRetrieved}`);
                }
                lines.push('');
            }

            // Assessment
            const assessed = this.otherMethodsFlow.assessment?.reportsAssessed || 0;
            if (assessed > 0) {
                lines.push(`Reports assessed for eligibility: n = ${assessed}`);

                const assessedExcluded = this.otherMethodsFlow.assessment?.reportsExcluded || 0;
                if (assessedExcluded > 0) {
                    lines.push(`Reports excluded: n = ${assessedExcluded}`);
                    const reasons = this.otherMethodsFlow.assessment?.exclusionReasons || [];
                    if (reasons.length > 0) {
                        reasons.forEach(r => {
                            lines.push(`  - ${r.reason}: n = ${r.count}`);
                        });
                    }
                }
                lines.push('');
            }
        }

        // INCLUDED STUDIES
        lines.push('INCLUDED');
        lines.push('-'.repeat(40));
        lines.push(`Studies included in review: n = ${this.included.studiesIncluded || 0}`);
        lines.push(`Reports of included studies: n = ${this.included.reportsIncluded || 0}`);
        lines.push('');
        lines.push('='.repeat(60));

        // Add all lines as a single text block
        container.addChild(new tp({
            content: lines.join('\n')
        }));

        return container;
    }

    private async handleToolCallImpl(toolName: string, params: any): Promise<void> {
        switch (toolName) {
            case 'set_identification':
                this.handleSetIdentification(params);
                break;
            case 'set_records_removed':
                this.handleSetRecordsRemoved(params);
                break;
            case 'set_screening':
                this.handleSetScreening(params);
                break;
            case 'set_retrieval':
                this.handleSetRetrieval(params);
                break;
            case 'set_assessment':
                this.handleSetAssessment(params);
                break;
            case 'set_included':
                this.handleSetIncluded(params);
                break;
            case 'add_exclusion_reason':
                this.handleAddExclusionReason(params);
                break;
            case 'export_flow_diagram':
                this.handleExportFlowDiagram(params);
                break;
            case 'clear_flow_diagram':
                this.handleClearFlowDiagram(params);
                break;
            case 'validate_flow_diagram':
                this.handleValidateFlowDiagram();
                break;
            case 'auto_calculate':
                this.handleAutoCalculate(params);
                break;
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }

    private handleSetIdentification(params: any): void {
        const { flow, databases, registers, websites, organisations, citationSearching, other } = params;

        if (flow === 'database') {
            this.databaseFlow.identification = {
                ...(this.databaseFlow.identification || {}),
                ...(databases !== undefined && { databases }),
                ...(registers !== undefined && { registers })
            };
        } else {
            this.otherMethodsFlow.identification = {
                ...(this.otherMethodsFlow.identification || {}),
                ...(websites !== undefined && { websites }),
                ...(organisations !== undefined && { organisations }),
                ...(citationSearching !== undefined && { citationSearching }),
                ...(other !== undefined && { other })
            };
        }

        this.validationResult = null;
        this.exportResult = null;
    }

    private handleSetRecordsRemoved(params: any): void {
        const { duplicates, automationTools, otherReasons } = params;

        this.databaseFlow.recordsRemoved = {
            ...(this.databaseFlow.recordsRemoved || {}),
            ...(duplicates !== undefined && { duplicates }),
            ...(automationTools !== undefined && { automationTools }),
            ...(otherReasons !== undefined && { otherReasons })
        };

        this.validationResult = null;
        this.exportResult = null;
    }

    private handleSetScreening(params: any): void {
        const { recordsScreened, recordsExcluded, exclusionReasons } = params;

        this.databaseFlow.screening = {
            ...(this.databaseFlow.screening || {}),
            ...(recordsScreened !== undefined && { recordsScreened }),
            ...(recordsExcluded !== undefined && { recordsExcluded }),
            ...(exclusionReasons !== undefined && { exclusionReasons })
        };

        this.validationResult = null;
        this.exportResult = null;
    }

    private handleSetRetrieval(params: any): void {
        const { flow, reportsSought, reportsNotRetrieved } = params;

        const data = {
            ...(reportsSought !== undefined && { reportsSought }),
            ...(reportsNotRetrieved !== undefined && { reportsNotRetrieved })
        };

        if (flow === 'database') {
            this.databaseFlow.retrieval = {
                ...(this.databaseFlow.retrieval || {}),
                ...data
            };
        } else {
            this.otherMethodsFlow.retrieval = {
                ...(this.otherMethodsFlow.retrieval || {}),
                ...data
            };
        }

        this.validationResult = null;
        this.exportResult = null;
    }

    private handleSetAssessment(params: any): void {
        const { flow, reportsAssessed, reportsExcluded, exclusionReasons } = params;

        const data = {
            ...(reportsAssessed !== undefined && { reportsAssessed }),
            ...(reportsExcluded !== undefined && { reportsExcluded }),
            ...(exclusionReasons !== undefined && { exclusionReasons })
        };

        if (flow === 'database') {
            this.databaseFlow.assessment = {
                ...(this.databaseFlow.assessment || {}),
                ...data
            };
        } else {
            this.otherMethodsFlow.assessment = {
                ...(this.otherMethodsFlow.assessment || {}),
                ...data
            };
        }

        this.validationResult = null;
        this.exportResult = null;
    }

    private handleSetIncluded(params: any): void {
        const { studiesIncluded, reportsIncluded } = params;

        this.included = {
            ...(this.included || {}),
            ...(studiesIncluded !== undefined && { studiesIncluded }),
            ...(reportsIncluded !== undefined && { reportsIncluded })
        };

        this.validationResult = null;
        this.exportResult = null;
    }

    private handleAddExclusionReason(params: any): void {
        const { phase, flow, reason, count } = params;

        const newReason: ExclusionReason = { reason, count };

        if (phase === 'screening') {
            const current = this.databaseFlow.screening?.exclusionReasons || [];
            this.databaseFlow.screening = {
                ...this.databaseFlow.screening,
                exclusionReasons: [...current, newReason]
            };
        } else {
            if (flow === 'database') {
                const current = this.databaseFlow.assessment?.exclusionReasons || [];
                this.databaseFlow.assessment = {
                    ...this.databaseFlow.assessment,
                    exclusionReasons: [...current, newReason]
                };
            } else {
                const current = this.otherMethodsFlow.assessment?.exclusionReasons || [];
                this.otherMethodsFlow.assessment = {
                    ...this.otherMethodsFlow.assessment,
                    exclusionReasons: [...current, newReason]
                };
            }
        }

        this.validationResult = null;
        this.exportResult = null;
    }

    private handleExportFlowDiagram(params: any): void {
        const { format } = params;

        switch (format) {
            case 'json':
                this.exportResult = this.generateJsonOutput();
                break;
            case 'markdown':
                this.exportResult = this.generateMarkdownOutput();
                break;
            case 'mermaid':
                this.exportResult = this.generateMermaidOutput();
                break;
            default:
                throw new Error(`Invalid export format: ${format}`);
        }
    }

    private handleClearFlowDiagram(params: any): void {
        const { confirm } = params;

        if (!confirm) {
            throw new Error('Clearing the flow diagram requires confirmation. Set confirm=true to proceed.');
        }

        this.databaseFlow = {};
        this.otherMethodsFlow = {};
        this.included = { studiesIncluded: 0, reportsIncluded: 0 };
        this.validationResult = null;
        this.exportResult = null;
    }

    private handleValidateFlowDiagram(): void {
        const warnings: string[] = [];
        let isValid = true;

        // Check if identification has data
        const hasDbIdentification = (this.databaseFlow.identification?.databases || 0) > 0 ||
            (this.databaseFlow.identification?.registers || 0) > 0;
        const hasOtherIdentification = (this.otherMethodsFlow.identification?.websites || 0) > 0 ||
            (this.otherMethodsFlow.identification?.organisations || 0) > 0 ||
            (this.otherMethodsFlow.identification?.citationSearching || 0) > 0;

        if (!hasDbIdentification && !hasOtherIdentification) {
            warnings.push('No identification data provided');
            isValid = false;
        }

        // Check if included studies is set
        if ((this.included.studiesIncluded || 0) === 0) {
            warnings.push('No included studies count provided');
        }

        // Validate flow consistency
        if (hasDbIdentification) {
            const idTotal = (this.databaseFlow.identification?.databases || 0) +
                (this.databaseFlow.identification?.registers || 0);
            const removedTotal = (this.databaseFlow.recordsRemoved?.duplicates || 0) +
                (this.databaseFlow.recordsRemoved?.automationTools || 0) +
                (this.databaseFlow.recordsRemoved?.otherReasons || 0);
            const screened = this.databaseFlow.screening?.recordsScreened || 0;

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

        this.validationResult = {
            isValid,
            message,
            warnings
        };
    }

    private handleAutoCalculate(params: any): void {
        const { flow } = params;

        if (flow === 'database' || flow === 'both') {
            // Calculate screened = identification - removed
            const idTotal = (this.databaseFlow.identification?.databases || 0) +
                (this.databaseFlow.identification?.registers || 0);
            const removedTotal = (this.databaseFlow.recordsRemoved?.duplicates || 0) +
                (this.databaseFlow.recordsRemoved?.automationTools || 0) +
                (this.databaseFlow.recordsRemoved?.otherReasons || 0);

            if (idTotal > 0 && !this.databaseFlow.screening?.recordsScreened) {
                this.databaseFlow.screening = {
                    ...this.databaseFlow.screening,
                    recordsScreened: Math.max(0, idTotal - removedTotal)
                };
            }

            // Calculate assessed = sought - not retrieved
            const sought = this.databaseFlow.retrieval?.reportsSought || 0;
            const notRetrieved = this.databaseFlow.retrieval?.reportsNotRetrieved || 0;

            if (sought > 0 && !this.databaseFlow.assessment?.reportsAssessed) {
                this.databaseFlow.assessment = {
                    ...this.databaseFlow.assessment,
                    reportsAssessed: Math.max(0, sought - notRetrieved)
                };
            }
        }

        if (flow === 'other' || flow === 'both') {
            // Calculate assessed = sought - not retrieved for other methods
            const sought = this.otherMethodsFlow.retrieval?.reportsSought || 0;
            const notRetrieved = this.otherMethodsFlow.retrieval?.reportsNotRetrieved || 0;

            if (sought > 0 && !this.otherMethodsFlow.assessment?.reportsAssessed) {
                this.otherMethodsFlow.assessment = {
                    ...this.otherMethodsFlow.assessment,
                    reportsAssessed: Math.max(0, sought - notRetrieved)
                };
            }
        }

        this.validationResult = null;
        this.exportResult = null;
    }

    private generateJsonOutput(): string {
        const output: PrismaFlowDiagram = {
            databaseFlow: this.databaseFlow,
            otherMethodsFlow: this.otherMethodsFlow,
            included: this.included
        };

        return JSON.stringify(output, null, 2);
    }

    private generateMarkdownOutput(): string {
        let output = '# PRISMA 2020 Flow Diagram\n\n';

        output += '## Identification\n\n';
        output += `- **Databases & Registers**: n = ${(this.databaseFlow.identification?.databases || 0) + (this.databaseFlow.identification?.registers || 0)}\n`;
        output += `- **Other Methods**: n = ${(this.otherMethodsFlow.identification?.websites || 0) + (this.otherMethodsFlow.identification?.organisations || 0) + (this.otherMethodsFlow.identification?.citationSearching || 0) + (this.otherMethodsFlow.identification?.other || 0)}\n\n`;

        output += '## Database & Registers Flow\n\n';
        // Add more detailed output...

        output += '## Included\n\n';
        output += `- **Studies included in review**: n = ${this.included.studiesIncluded || 0}\n`;
        output += `- **Reports of included studies**: n = ${this.included.reportsIncluded || 0}\n`;

        return output;
    }

    private generateMermaidOutput(): string {
        // Generate simplified mermaid flowchart for LLM consumption
        let output = 'flowchart TD\n\n';
        output += '%% PRISMA 2020 Flow Diagram - LLM Friendly Format\n\n';

        const nodeId = (id: string) => id.replace(/\s+/g, '_');

        // Identification phase
        const dbTotal = (this.databaseFlow.identification?.databases || 0) +
            (this.databaseFlow.identification?.registers || 0);
        const otherTotal = (this.otherMethodsFlow.identification?.websites || 0) +
            (this.otherMethodsFlow.identification?.organisations || 0) +
            (this.otherMethodsFlow.identification?.citationSearching || 0) +
            (this.otherMethodsFlow.identification?.other || 0);

        output += `    ${nodeId('Identification_DB')}["Databases & Registers (n=${dbTotal})"]\n`;
        output += `    ${nodeId('Identification_Other')}["Other Methods (n=${otherTotal})"]\n\n`;

        // Database flow
        if (dbTotal > 0) {
            const screened = this.databaseFlow.screening?.recordsScreened || 0;
            const sought = this.databaseFlow.retrieval?.reportsSought || 0;
            const assessed = this.databaseFlow.assessment?.reportsAssessed || 0;

            output += `    ${nodeId('Identification_DB')} --> ${nodeId('Screened_DB')}["Screened (n=${screened})"]\n`;
            if (sought > 0) {
                output += `    ${nodeId('Screened_DB')} --> ${nodeId('Sought_DB')}["Reports Sought (n=${sought})"]\n`;
            }
            if (assessed > 0) {
                output += `    ${nodeId('Sought_DB')} --> ${nodeId('Assessed_DB')}["Assessed (n=${assessed})"]\n`;
            }
        }

        // Other methods flow
        if (otherTotal > 0) {
            const sought = this.otherMethodsFlow.retrieval?.reportsSought || 0;
            const assessed = this.otherMethodsFlow.assessment?.reportsAssessed || 0;

            output += `    ${nodeId('Identification_Other')} --> ${nodeId('Sought_Other')}["Reports Sought (n=${sought})"]\n`;
            if (assessed > 0) {
                output += `    ${nodeId('Sought_Other')} --> ${nodeId('Assessed_Other')}["Assessed (n=${assessed})"]\n`;
            }
        }

        // Converge to included
        const studiesIncluded = this.included.studiesIncluded || 0;
        output += `\n    ${nodeId('Assessed_DB')} --> ${nodeId('Included')}["Studies Included (n=${studiesIncluded})"]\n`;
        output += `    ${nodeId('Assessed_Other')} --> ${nodeId('Included')}\n`;

        return output;
    }

    /**
     * Get the current flow diagram state
     */
    getFlowDiagram(): PrismaFlowDiagram {
        return {
            databaseFlow: this.databaseFlow,
            otherMethodsFlow: this.otherMethodsFlow,
            included: this.included
        };
    }
}
