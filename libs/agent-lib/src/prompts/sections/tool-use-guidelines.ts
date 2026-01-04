import { ToolProtocol, TOOL_PROTOCOL, isNativeProtocol } from '../../types';

/**
 * Generates tool use guidelines for LLM prompts.
 *
 * This function creates a comprehensive set of guidelines specifically tailored for medical scientific research
 * and clinical investigation tasks. The guidelines help LLMs understand how to properly use tools when conducting
 * medical research, analyzing clinical data, or performing literature reviews.
 *
 * @param protocol - The tool protocol to use (XML or Native). Defaults to XML protocol.
 *                  - XML: Requires one tool per message with explicit confirmation
 *                  - Native: Allows multiple tools per message
 *
 * @returns A formatted markdown string containing medical research tool use guidelines
 *
 * @example
 * ```typescript
 * // Get XML protocol guidelines (default)
 * const xmlGuidelines = getToolUseGuidelinesSection();
 *
 * // Get Native protocol guidelines
 * const nativeGuidelines = getToolUseGuidelinesSection(TOOL_PROTOCOL.NATIVE);
 * ```
 *
 * @remarks
 * The guidelines include:
 * - Assessment of medical data and research information needs
 * - Tool selection strategies for medical investigations
 * - Protocol-specific execution patterns
 * - Error handling for clinical and statistical analysis
 * - Step-by-step research methodology
 */
export function getToolUseGuidelinesSection(
  protocol: ToolProtocol = TOOL_PROTOCOL.XML,
): string {
  // Build guidelines array with automatic numbering
  let itemNumber = 1;
  const guidelinesList: string[] = [];

  // First guideline adapted for medical research
  guidelinesList.push(
    `${itemNumber++}. Assess what medical data and research information you already have and what additional clinical evidence, literature, or data you need to proceed with the medical research task.`,
  );

  guidelinesList.push(
    `${itemNumber++}. Choose the most appropriate research tool based on the medical investigation and tool descriptions provided. Assess if you need additional medical literature, patient data, or statistical analysis to proceed, and which of the available tools would be most effective for gathering this information. For example using literature search tools is more effective than manually browsing through medical databases. It's critical that you think about each available tool and use the one that best fits the current phase of the medical research.`,
  );

  // Remaining guidelines - different for native vs XML protocol
  if (isNativeProtocol(protocol)) {
    guidelinesList.push(
      `${itemNumber++}. If multiple research actions are needed, you may use multiple tools in a single message when appropriate, or use tools iteratively across messages. Each tool use should be informed by the results of previous research steps. Do not assume the outcome of any medical analysis. Each step must be informed by the previous step's clinical findings.`,
    );
  } else {
    guidelinesList.push(
      `${itemNumber++}. If multiple research actions are needed, use one tool at a time per message to accomplish the medical investigation iteratively, with each tool use being informed by the result of the previous research step. Do not assume the outcome of any medical analysis. Each step must be informed by the previous step's clinical findings.`,
    );
  }

  // Protocol-specific guideline - only add for XML protocol
  if (!isNativeProtocol(protocol)) {
    guidelinesList.push(
      `${itemNumber++}. Formulate your research tool use using the XML format specified for each tool.`,
    );
  }
  guidelinesList.push(`${itemNumber++}. After each research tool use, the user will respond with the result of that medical investigation. This result will provide you with the necessary information to continue your research or make further clinical decisions. This response may include:
	 - Information about whether the medical analysis succeeded or failed, along with any reasons for failure.
	 - Statistical validation errors that may have arisen due to the research methods used, which you'll need to address.
	 - New clinical data or research findings in reaction to the analysis, which you may need to consider or act upon.
	 - Any other relevant medical feedback or research information related to the tool use.`);

  // Only add the "wait for confirmation" guideline for XML protocol
  // Native protocol allows multiple tools per message, so waiting after each tool doesn't apply
  if (!isNativeProtocol(protocol)) {
    guidelinesList.push(
      `${itemNumber++}. ALWAYS wait for user confirmation after each research tool use before proceeding. Never assume the success of a medical analysis without explicit confirmation of the result from the user.`,
    );
  }

  // Join guidelines and add the footer
  // For native protocol, the footer is less relevant since multiple tools can execute in one message
  const footer = isNativeProtocol(protocol)
    ? `\n\nBy carefully considering the user's response after medical research tool executions, you can react accordingly and make informed decisions about how to proceed with the clinical investigation. This iterative process helps ensure the overall success and scientific validity of your medical research.`
    : `\n\nIt is crucial to proceed step-by-step, waiting for the user's message after each research tool use before moving forward with the medical investigation. This approach allows you to:
1. Confirm the scientific validity of each research step before proceeding.
2. Address any clinical or statistical issues that arise immediately.
3. Adapt your research methodology based on new medical evidence or unexpected findings.
4. Ensure that each research action builds correctly on the previous clinical evidence.

By waiting for and carefully considering the user's response after each research tool use, you can react accordingly and make informed decisions about how to proceed with the medical investigation. This iterative process helps ensure the overall success and scientific validity of your medical research.`;

  return `# Tool Use Guidelines

${guidelinesList.join('\n')}${footer}`;
}
