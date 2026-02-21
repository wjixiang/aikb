import { Tool } from "../types.js";
import { renderToolSection as renderToolSectionUtil, renderZodSchema } from "../../utils/toolRendering.js";

/**
 * Render tool definitions as TUIElement
 * @param tools - Array of tool definitions
 * @returns TUIElement describing available tools
 *
 * @deprecated Use renderToolSection from ../../utils/toolRendering.js instead.
 * This export is kept for backward compatibility.
 */
export function renderToolSection(tools: Tool[]) {
    return renderToolSectionUtil(tools);
}

/**
 * Render a Zod schema as a human/LLM-readable string
 *
 * @deprecated Use renderZodSchema from ../../utils/toolRendering.js instead.
 * This export is kept for backward compatibility.
 */
export { renderZodSchema };