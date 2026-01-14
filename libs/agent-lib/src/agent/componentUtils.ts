/**
 * Utility functions for Workspace Components
 * Helper functions for rendering and formatting component output
 */

import { EditableProps, renderEditablePropsDescAsPrompt } from './workspaceTypes';
import { WorkspaceComponent } from './componentTypes';

/**
 * Constants for render output formatting
 */
export const SECTION_SEPARATOR = '\n\n';
export const SUBSECTION_SEPARATOR = '\n\n';

/**
 * Builds the editable state section for a component
 *
 * @param component - The component instance
 * @returns The formatted editable state section, or empty string if no editable props
 */
export function buildEditableStateSection(component: WorkspaceComponent): string {
    const hasEditableProps = component.editableProps && Object.keys(component.editableProps).length > 0;

    if (!hasEditableProps) {
        return '';
    }

    // Use the new two-section markdown format for editable props
    const editableFields = renderEditablePropsDescAsPrompt(component.editableProps);

    return `# Editable State:\n${editableFields}\n`;
}

/**
 * Internal helper to wrap render output with component description and editable state
 * This is automatically called by the abstract render() method in WorkspaceComponent
 *
 * @param component - The component instance
 * @param result - The original render result from the subclass
 * @returns The wrapped render output
 */
export function wrapRenderOutput(component: WorkspaceComponent, result: string): string {
    // Build the editable state section if editable props exist
    const editableStateSection = buildEditableStateSection(component);

    // Build the final output with description and editable state
    return [
        SECTION_SEPARATOR,
        component.description,
        SECTION_SEPARATOR,
        editableStateSection,
        renderComponentInterfaceAreaBanner(),
        result,
        renderComponentInterfaceEndAreaBanner(),
    ].filter(Boolean).join('\n');
}


export function renderComponentInterfaceAreaBanner() {
    return `
#####################################
/////////INTERFACE AREA BEGIN////////
-------------------------------------
`
}

export function renderComponentInterfaceEndAreaBanner() {
    return `
-------------------------------------
/////////INTERFACE AREA END//////////
#####################################
`
}