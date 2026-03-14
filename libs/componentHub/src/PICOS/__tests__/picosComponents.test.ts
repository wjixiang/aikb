import { describe, it, expect, beforeEach } from 'vitest';
import { PicosComponent } from "../picosComponents.js";

describe('PICOS Component', () => {
    let component: PicosComponent;

    beforeEach(() => {
        component = new PicosComponent();
    });

    describe('Tool Availability', () => {
        it('should have all 5 tools available', async () => {
            expect(component.toolSet.size).toBe(5);
            expect(component.toolSet.has('set_picos_element')).toBe(true);
            expect(component.toolSet.has('generate_clinical_question')).toBe(true);
            expect(component.toolSet.has('validate_picos')).toBe(true);
            expect(component.toolSet.has('clear_picos')).toBe(true);
            expect(component.toolSet.has('export_picos')).toBe(true);
        });
    });

    describe('set_picos_element Tool', () => {
        it('should set patient element and update state', async () => {
            const params = {
                element: 'patient',
                data: { description: 'Adults with hypertension', ageGroup: '18-65', condition: 'Hypertension' }
            };

            await component.handleToolCall('set_picos_element', params);

            expect(component.currentPicos.patient).toBeDefined();
            expect(component.currentPicos.patient?.description).toBe('Adults with hypertension');
            expect(component.currentPicos.patient?.ageGroup).toBe('18-65');
            expect(component.currentPicos.patient?.condition).toBe('Hypertension');
        });

        it('should set intervention element and update state', async () => {
            const params = {
                element: 'intervention',
                data: { description: 'ACE inhibitors', type: 'Medication' }
            };

            await component.handleToolCall('set_picos_element', params);

            expect(component.currentPicos.intervention).toBeDefined();
            expect(component.currentPicos.intervention?.description).toBe('ACE inhibitors');
            expect(component.currentPicos.intervention?.type).toBe('Medication');
        });

        it('should set comparison element and update state', async () => {
            const params = {
                element: 'comparison',
                data: { description: 'Placebo', type: 'Control' }
            };

            await component.handleToolCall('set_picos_element', params);

            expect(component.currentPicos.comparison).toBeDefined();
            expect(component.currentPicos.comparison?.description).toBe('Placebo');
        });

        it('should set outcome element and update state', async () => {
            const params = {
                element: 'outcome',
                data: { description: 'Blood pressure reduction', type: 'Primary', timeFrame: '12 weeks' }
            };

            await component.handleToolCall('set_picos_element', params);

            expect(component.currentPicos.outcome).toBeDefined();
            expect(component.currentPicos.outcome?.description).toBe('Blood pressure reduction');
            expect(component.currentPicos.outcome?.timeFrame).toBe('12 weeks');
        });

        it('should set studyDesign element and update state', async () => {
            const params = {
                element: 'studyDesign',
                data: { description: 'Randomized controlled trial', type: 'RCT' }
            };

            await component.handleToolCall('set_picos_element', params);

            expect(component.currentPicos.studyDesign).toBeDefined();
            expect(component.currentPicos.studyDesign?.description).toBe('Randomized controlled trial');
        });

        it('should handle string data as description', async () => {
            const params = {
                element: 'patient',
                data: 'Elderly patients with diabetes'
            };

            await component.handleToolCall('set_picos_element', params);

            expect(component.currentPicos.patient?.description).toBe('Elderly patients with diabetes');
        });

        it('should render correctly after setting patient element', async () => {
            await component.handleToolCall('set_picos_element', {
                element: 'patient',
                data: { description: 'Test patients' }
            });

            const renderResult = await component.render();
            const output = renderResult.render();
            expect(output).toContain('Test patients');
            expect(output).toContain('Current PICOS Elements');
            expect(output).toContain('P - Patient/Problem');
        });

        it('should clear generated question when setting new element', async () => {
            // First generate a question
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Patients' });
            await component.handleToolCall('set_picos_element', { element: 'intervention', data: 'Drug' });
            await component.handleToolCall('generate_clinical_question', {});
            expect(component.generatedQuestion).toBe('In Patients does Drug?');

            // Set a new element - should clear generated question
            await component.handleToolCall('set_picos_element', { element: 'outcome', data: 'Outcome' });
            expect(component.generatedQuestion).toBeNull();
        });
    });

    describe('generate_clinical_question Tool', () => {
        it('should generate question from patient and intervention', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Patients with diabetes' });
            await component.handleToolCall('set_picos_element', { element: 'intervention', data: 'Metformin' });

            await component.handleToolCall('generate_clinical_question', {});

            expect(component.generatedQuestion).toBe('In Patients with diabetes does Metformin?');
        });

        it('should generate question with comparison', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Hypertensive patients' });
            await component.handleToolCall('set_picos_element', { element: 'intervention', data: 'Lisinopril' });
            await component.handleToolCall('set_picos_element', { element: 'comparison', data: 'Placebo' });

            await component.handleToolCall('generate_clinical_question', {});

            expect(component.generatedQuestion).toBe('In Hypertensive patients does Lisinopril compared to Placebo?');
        });

        it('should generate question with outcome', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Patients' });
            await component.handleToolCall('set_picos_element', { element: 'intervention', data: 'Treatment' });
            await component.handleToolCall('set_picos_element', { element: 'outcome', data: 'Blood pressure' });

            await component.handleToolCall('generate_clinical_question', {});

            expect(component.generatedQuestion).toContain('affect Blood pressure');
        });

        it('should generate question with study design', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Patients' });
            await component.handleToolCall('set_picos_element', { element: 'intervention', data: 'Treatment' });
            await component.handleToolCall('set_picos_element', { element: 'studyDesign', data: 'RCT' });

            await component.handleToolCall('generate_clinical_question', {});

            expect(component.generatedQuestion).toContain('(RCT)');
        });

        it('should render correctly after generating question', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Test patients' });
            await component.handleToolCall('set_picos_element', { element: 'intervention', data: 'Test drug' });
            await component.handleToolCall('generate_clinical_question', {});

            const renderResult = await component.render();
            const output = renderResult.render();
            expect(output).toContain('Generated Clinical Question');
            expect(output).toContain('In Test patients does Test drug?');
        });

        it('should return error when no elements set', async () => {
            const result = await component.handleToolCall('generate_clinical_question', {})
            expect(result.data.error).toContain('At least one PICOS element must be set');
        });
    });

    describe('validate_picos Tool', () => {
        it('should validate complete PICOS as valid', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Patients' });
            await component.handleToolCall('set_picos_element', { element: 'intervention', data: 'Treatment' });
            await component.handleToolCall('set_picos_element', { element: 'outcome', data: 'Outcome' });

            await component.handleToolCall('validate_picos', {});

            expect(component.validationResult).toBeDefined();
            expect(component.validationResult?.isValid).toBe(true);
            expect(component.validationResult?.missingElements).toEqual([]);
        });

        it('should validate incomplete PICOS as invalid', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Patients' });

            await component.handleToolCall('validate_picos', {});

            expect(component.validationResult).toBeDefined();
            expect(component.validationResult?.isValid).toBe(false);
            expect(component.validationResult?.missingElements).toContain('Intervention');
            expect(component.validationResult?.missingElements).toContain('Outcome');
        });

        it('should render validation result', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Patients' });
            await component.handleToolCall('validate_picos', {});

            const renderResult = await component.render();
            const output = renderResult.render();
            expect(output).toContain('Validation Result');
            expect(output).toContain('Incomplete');
            expect(output).toContain('Missing Elements');
            expect(output).toContain('Intervention');
            expect(output).toContain('Outcome');
        });

        it('should include optional elements in message when complete', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Patients' });
            await component.handleToolCall('set_picos_element', { element: 'intervention', data: 'Treatment' });
            await component.handleToolCall('set_picos_element', { element: 'outcome', data: 'Outcome' });

            await component.handleToolCall('validate_picos', {});

            expect(component.validationResult?.message).toContain('complete');
        });
    });

    describe('clear_picos Tool', () => {
        it('should clear all PICOS elements', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Patients' });
            await component.handleToolCall('set_picos_element', { element: 'intervention', data: 'Treatment' });
            await component.handleToolCall('set_picos_element', { element: 'outcome', data: 'Outcome' });

            await component.handleToolCall('clear_picos', {});

            expect(component.currentPicos.patient).toBeUndefined();
            expect(component.currentPicos.intervention).toBeUndefined();
            expect(component.currentPicos.comparison).toBeUndefined();
            expect(component.currentPicos.outcome).toBeUndefined();
            expect(component.currentPicos.studyDesign).toBeUndefined();
        });

        it('should clear generated question and validation result', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Patients' });
            await component.handleToolCall('set_picos_element', { element: 'intervention', data: 'Treatment' });
            await component.handleToolCall('generate_clinical_question', {});
            await component.handleToolCall('validate_picos', {});

            expect(component.generatedQuestion).toBeTruthy();
            expect(component.validationResult).toBeTruthy();

            await component.handleToolCall('clear_picos', {});

            expect(component.generatedQuestion).toBeNull();
            expect(component.validationResult).toBeNull();
            expect(component.exportResult).toBeNull();
        });

        it('should render welcome message after clearing', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Patients' });
            await component.handleToolCall('clear_picos', {});

            const renderResult = await component.render();
            const output = renderResult.render();
            expect(output).toContain('Welcome to PICOS Clinical Question Builder');
        });
    });

    describe('export_picos Tool', () => {
        it('should export as JSON', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Test patients' });
            await component.handleToolCall('set_picos_element', { element: 'intervention', data: 'Test treatment' });

            await component.handleToolCall('export_picos', { format: 'json' });

            expect(component.exportResult).toBeTruthy();
            const parsed = JSON.parse(component.exportResult!);
            expect(parsed.patient.description).toBe('Test patients');
            expect(parsed.intervention.description).toBe('Test treatment');
        });

        it('should export as Markdown', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Test patients' });
            await component.handleToolCall('set_picos_element', { element: 'intervention', data: 'Test treatment' });

            await component.handleToolCall('export_picos', { format: 'markdown' });

            expect(component.exportResult).toContain('# PICOS Clinical Question');
            expect(component.exportResult).toContain('**Patient/Problem**: Test patients');
            expect(component.exportResult).toContain('**Intervention**: Test treatment');
        });

        it('should export as search string', async () => {
            await component.handleToolCall('set_picos_element', {
                element: 'patient',
                data: { description: 'Hypertension patients', condition: 'High blood pressure' }
            });
            await component.handleToolCall('set_picos_element', {
                element: 'intervention',
                data: { description: 'ACE inhibitors' }
            });

            await component.handleToolCall('export_picos', { format: 'search' });

            expect(component.exportResult).toBe('High blood pressure AND ACE inhibitors');
        });

        it('should render export result', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Patients' });
            await component.handleToolCall('export_picos', { format: 'markdown' });

            const renderResult = await component.render();
            const output = renderResult.render();
            expect(output).toContain('Export Result');
            expect(output).toContain('# PICOS Clinical Question');
        });

        it('should default to markdown format', async () => {
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Patients' });
            await component.handleToolCall('export_picos', {});

            expect(component.exportResult).toContain('# PICOS Clinical Question');
        });
    });

    describe('State Refresh and Render Integration', () => {
        it('should refresh state and render after full PICOS workflow', async () => {
            // Set elements
            await component.handleToolCall('set_picos_element', { element: 'patient', data: 'Adults with type 2 diabetes' });
            await component.handleToolCall('set_picos_element', { element: 'intervention', data: 'Metformin 500mg twice daily' });
            await component.handleToolCall('set_picos_element', { element: 'comparison', data: 'Placebo' });
            await component.handleToolCall('set_picos_element', { element: 'outcome', data: 'HbA1c reduction after 6 months' });
            await component.handleToolCall('set_picos_element', { element: 'studyDesign', data: 'Randomized double-blind controlled trial' });

            // Validate
            await component.handleToolCall('validate_picos', {});

            // Generate question
            await component.handleToolCall('generate_clinical_question', {});

            // Export
            await component.handleToolCall('export_picos', { format: 'markdown' });

            // Render and verify all state
            const renderResult = await component.render();
            const output = renderResult.render();

            // Verify all components are rendered
            expect(output).toContain('Adults with type 2 diabetes');
            expect(output).toContain('Metformin 500mg twice daily');
            expect(output).toContain('Placebo');
            expect(output).toContain('HbA1c reduction');
            expect(output).toContain('Randomized double-blind controlled trial');
            expect(output).toContain('Generated Clinical Question');
            expect(output).toContain('Validation Result');
            expect(output).toContain('Valid');
            expect(output).toContain('Export Result');

            // Verify state
            expect(component.currentPicos.patient?.description).toBe('Adults with type 2 diabetes');
            expect(component.validationResult?.isValid).toBe(true);
            expect(component.generatedQuestion).toContain('Adults with type 2 diabetes');
            expect(component.exportResult).toContain('PICOS Clinical Question');
        });

        it('should handle tool call errors gracefully', async () => {
            const result1 = await component.handleToolCall('set_picos_element', { element: 'invalid', data: {} })
            expect(result1.data.error).toContain('Invalid PICOS element');

            const result2 = await component.handleToolCall('export_picos', { format: 'invalid' })
            expect(result2.data.error).toContain('Invalid export format');
        });

        it('should render tool section with all tools', async () => {
            const toolSection = component.renderToolSection();
            const output = toolSection.render();

            expect(output).toContain('set_picos_element');
            expect(output).toContain('generate_clinical_question');
            expect(output).toContain('validate_picos');
            expect(output).toContain('clear_picos');
            expect(output).toContain('export_picos');
        });
    });
});