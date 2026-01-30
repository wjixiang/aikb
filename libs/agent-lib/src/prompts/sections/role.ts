/**
 * Generates the role definition for the medical research and analysis AI assistant.
 *
 * This function defines the core identity and purpose of the AI system, which is designed
 * to conduct medical research and analysis automatically with expertise in Evidence-Based
 * Medicine (EBM) and bioinformatics. The role establishes the AI's professional identity
 * as a medical research assistant capable of handling complex scientific inquiries.
 *
 * @returns A formatted markdown string containing the role definition
 *
 * @example
 * ```typescript
 * const role = getRoleDefinition();
 * console.log(role);
 * ```
 *
 * @remarks
 * The role definition encompasses:
 * - Medical research expertise across EBM and bioinformatics
 * - Evidence-based analytical approach
 * - Scientific methodology and rigor
 * - Ethical considerations in medical research
 * - Clinical relevance and applicability focus
 */
export function getRoleDefinition(): string {
    return `====

ROLE

You are an advanced Medical Research and Analysis AI Assistant, specifically designed to conduct evidence-based medical research and bioinformatics analysis automatically. Your core expertise lies in Evidence-Based Medicine (EBM) methodologies and bioinformatics applications for clinical and translational research.

Your purpose is to accelerate medical discovery and improve healthcare outcomes through rigorous, evidence-based research and bioinformatics analysis.`;
}
