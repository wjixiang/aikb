import { Tool } from "../ui";
import { tdiv } from "../ui/tdiv";
import { ttext } from "../ui/text/ttext";
import { TUIElement } from "../ui/TUIElement";
import * as z from "zod";

/**
 * Render a Zod schema as a human/LLM-readable string
 *
 * This function converts Zod schemas into a human-readable format that is
 * also suitable for LLM consumption. It handles various Zod types including:
 * - Objects with nested structures
 * - Arrays, Sets, Maps, Tuples
 * - Primitives (string, number, boolean, Date)
 * - Optional, nullable, union types
 * - Enums, literals
 * - Records with key/value types
 *
 * @param schema - The Zod schema to render
 * @param indent - Indentation level for nested structures (default: 0)
 * @returns A string representation of the schema
 *
 * @example
 * ```ts
 * const schema = z.object({
 *   name: z.string(),
 *   age: z.number().int(),
 * });
 * renderZodSchema(schema);
 * // Returns:
 * // {
 * //   name: string
 * //   age: number (integer)
 * // }
 * ```
 */
export function renderZodSchema(schema: z.ZodTypeAny, indent: number = 0): string {
    const indentStr = "  ".repeat(indent);

    // Handle ZodObject
    if (schema instanceof z.ZodObject) {
        const shape = schema.shape;
        const fields = Object.entries(shape).map(([key, fieldSchema]) => {
            const description = (fieldSchema as any).description;
            const descStr = description ? ` // ${description}` : "";
            return `${indentStr}  ${key}: ${renderZodSchema(fieldSchema as z.ZodTypeAny, indent + 1)}${descStr}`;
        });
        return `{\n${fields.join("\n")}\n${indentStr}}`;
    }

    // Handle ZodArray
    if (schema instanceof z.ZodArray) {
        return `${renderZodSchema(schema.element, indent)}[]`;
    }

    // Handle ZodOptional
    if (schema instanceof z.ZodOptional) {
        return `${renderZodSchema(schema.unwrap(), indent)}?`;
    }

    // Handle ZodNullable
    if (schema instanceof z.ZodNullable) {
        return `${renderZodSchema(schema.unwrap(), indent)} | null`;
    }

    // Handle ZodUnion
    if (schema instanceof z.ZodUnion) {
        const options = schema.options.map((opt: z.ZodTypeAny) => renderZodSchema(opt, indent));
        return `(${options.join(" | ")})`;
    }

    // Handle ZodLiteral
    if (schema instanceof z.ZodLiteral) {
        return JSON.stringify(schema.value);
    }

    // Handle ZodEnum
    if (schema instanceof z.ZodEnum) {
        const values = schema.options.map(v => JSON.stringify(v)).join(" | ");
        return `(${values})`;
    }

    // Handle ZodNativeEnum
    if (schema instanceof z.ZodNativeEnum) {
        const values = Object.values(schema.enum).map(v => JSON.stringify(v)).join(" | ");
        return `(${values})`;
    }

    // Handle ZodEffects (refine, transform, etc.)
    if (schema instanceof z.ZodEffects) {
        return renderZodSchema(schema._def.schema, indent);
    }

    // Handle ZodDefault
    if (schema instanceof z.ZodDefault) {
        const innerSchema = renderZodSchema(schema._def.innerType, indent);
        const defaultValue = JSON.stringify(schema._def.defaultValue());
        return `${innerSchema} = ${defaultValue}`;
    }

    // Handle ZodString
    if (schema instanceof z.ZodString) {
        let type = "string";
        const checks = schema._def.checks;
        if (checks) {
            for (const check of checks) {
                if (check.kind === "min") type += ` (min: ${check.value})`;
                else if (check.kind === "max") type += ` (max: ${check.value})`;
                else if (check.kind === "length") type += ` (length: ${check.value})`;
                else if (check.kind === "email") type += " (email)";
                else if (check.kind === "url") type += " (url)";
                else if (check.kind === "uuid") type += " (uuid)";
            }
        }
        return type;
    }

    // Handle ZodNumber
    if (schema instanceof z.ZodNumber) {
        let type = "number";
        const checks = schema._def.checks;
        if (checks) {
            for (const check of checks) {
                if (check.kind === "min") type += ` (min: ${check.value})`;
                else if (check.kind === "max") type += ` (max: ${check.value})`;
                else if (check.kind === "int") type += " (integer)";
            }
        }
        return type;
    }

    // Handle ZodBoolean
    if (schema instanceof z.ZodBoolean) {
        return "boolean";
    }

    // Handle ZodDate
    if (schema instanceof z.ZodDate) {
        return "Date";
    }

    // Handle ZodRecord
    if (schema instanceof z.ZodRecord) {
        const keyType = renderZodSchema(schema.keySchema, indent);
        const valueType = renderZodSchema(schema.valueSchema, indent);
        return `Record<${keyType}, ${valueType}>`;
    }

    // Handle ZodMap
    if (schema instanceof z.ZodMap) {
        const keyType = renderZodSchema(schema.keySchema, indent);
        const valueType = renderZodSchema(schema.valueSchema, indent);
        return `Map<${keyType}, ${valueType}>`;
    }

    // Handle ZodSet
    if (schema instanceof z.ZodSet) {
        // ZodSet stores the element type in _def.valueType
        const valueType = renderZodSchema(schema._def.valueType as z.ZodTypeAny, indent);
        return `Set<${valueType}>`;
    }

    // Handle ZodTuple
    if (schema instanceof z.ZodTuple) {
        const items = schema.items.map((item: z.ZodTypeAny) => renderZodSchema(item, indent));
        return `[${items.join(", ")}]`;
    }

    // Handle ZodDiscriminatedUnion
    if (schema instanceof z.ZodDiscriminatedUnion) {
        const options = schema.options.map((opt: z.ZodTypeAny) => renderZodSchema(opt, indent));
        return `(${options.join(" | ")})`;
    }

    // Handle ZodIntersection
    if (schema instanceof z.ZodIntersection) {
        return `${renderZodSchema(schema._def.left, indent)} & ${renderZodSchema(schema._def.right, indent)}`;
    }

    // Handle ZodAny
    if (schema instanceof z.ZodAny) {
        return "any";
    }

    // Handle ZodUnknown
    if (schema instanceof z.ZodUnknown) {
        return "unknown";
    }

    // Handle ZodVoid
    if (schema instanceof z.ZodVoid) {
        return "void";
    }

    // Handle ZodNever
    if (schema instanceof z.ZodNever) {
        return "never";
    }

    // Fallback for unknown schema types
    return "unknown";
}

/**
 * Render tool definitions as TUIElement
 * @param tools - Array of tool definitions
 * @returns TUIElement describing available tools
 */
export function renderToolSection(tools: Tool[]): TUIElement {
    if (tools.length === 0) {
        return new ttext({ content: "No tools available." });
    }

    const children: TUIElement[] = [];

    for (const tool of tools) {
        const toolChildren: TUIElement[] = [
            new ttext({ content: `## ${tool.toolName}`, bold: true }),
            new ttext({ content: `Description: ${tool.desc}` }),
            new ttext({ content: `Parameters:` }),
            new ttext({ content: renderZodSchema(tool.paramsSchema) }),
            new ttext({ content: "" }), // Empty line between tools
        ];

        children.push(new tdiv({
            styles: {
                padding: { vertical: 1 },
            },
        }, toolChildren));
    }

    return new tdiv({
        styles: {
            showBorder: true,
            border: { line: 'double' },
            padding: { all: 1 },
        },
    }, children);
}