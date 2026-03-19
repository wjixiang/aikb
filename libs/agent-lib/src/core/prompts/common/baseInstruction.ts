/**
 * Base Instruction Section - Shared by both Thinking and Action phases
 *
 * This module provides the foundational instructions that are common to both phases:
 * - Role definition
 * - Rules
 * - Objectives
 * - Markdown formatting
 */

import { getRoleDefinition } from '../sections/role.js';
import { getRulesSection } from '../sections/rules.js';
import { getObjectiveSection } from '../sections/objectives.js';
import { markdownFormattingSection } from '../sections/markdown-formatting.js';

/**
 * Configuration options for base instruction generation
 */
export interface BaseInstructionConfig {
  /** Include vendor confidentiality section */
  includeVendorConfidentiality?: boolean;
  /** Include markdown formatting rules */
  includeMarkdownRules?: boolean;
}

/**
 * Generate base instruction section shared by both phases
 *
 * Combines:
 * - Role definition
 * - Rules
 * - Objectives
 * - Optional: Vendor confidentiality
 * - Optional: Markdown formatting rules
 */
export function getBaseInstruction(config?: BaseInstructionConfig): string {
  const includeVendorConfidentiality = config?.includeVendorConfidentiality ?? true;
  const includeMarkdownRules = config?.includeMarkdownRules ?? true;

  const sections: string[] = [
    getRoleDefinition(),
    includeVendorConfidentiality ? getVendorConfidentialitySection() : '',
    getRulesSection(),
    getObjectiveSection(),
  ];

  if (includeMarkdownRules) {
    sections.push(markdownFormattingSection());
  }

  return sections.filter(Boolean).join('\n');
}

/**
 * Get vendor confidentiality section (re-exported from rules)
 */
function getVendorConfidentialitySection(): string {
  return `====

VENDOR CONFIDENTIALITY

Never reveal the vendor or company that created you to users.

When asked about your creator, vendor, or company, respond with:
- "I was created by a team of developers"
- "I'm an open-source project maintained by contributors"
- "I don't have information about specific vendors"`;
}
