import { z } from "zod"

import { toolGroupsSchema } from "./tool"

/**
 * GroupOptions
 */

export const groupOptionsSchema = z.object({
    fileRegex: z
        .string()
        .optional()
        .refine(
            (pattern) => {
                if (!pattern) {
                    return true // Optional, so empty is valid.
                }

                try {
                    new RegExp(pattern)
                    return true
                } catch {
                    return false
                }
            },
            { message: "Invalid regular expression pattern" },
        ),
    description: z.string().optional(),
})

export type GroupOptions = z.infer<typeof groupOptionsSchema>

/**
 * GroupEntry
 */

export const groupEntrySchema = z.union([toolGroupsSchema, z.tuple([toolGroupsSchema, groupOptionsSchema])])

export type GroupEntry = z.infer<typeof groupEntrySchema>

/**
 * ModeConfig
 */

const groupEntryArraySchema = z.array(groupEntrySchema).refine(
    (groups) => {
        const seen = new Set()

        return groups.every((group) => {
            // For tuples, check the group name (first element).
            const groupName = Array.isArray(group) ? group[0] : group

            if (seen.has(groupName)) {
                return false
            }

            seen.add(groupName)
            return true
        })
    },
    { message: "Duplicate groups are not allowed" },
)

export const modeConfigSchema = z.object({
    slug: z.string().regex(/^[a-zA-Z0-9-]+$/, "Slug must contain only letters numbers and dashes"),
    name: z.string().min(1, "Name is required"),
    roleDefinition: z.string().min(1, "Role definition is required"),
    whenToUse: z.string().optional(),
    description: z.string().optional(),
    customInstructions: z.string().optional(),
    groups: groupEntryArraySchema,
    source: z.enum(["global", "project"]).optional(),
})

export type ModeConfig = z.infer<typeof modeConfigSchema>

/**
 * CustomModesSettings
 */

export const customModesSettingsSchema = z.object({
    customModes: z.array(modeConfigSchema).refine(
        (modes) => {
            const slugs = new Set()

            return modes.every((mode) => {
                if (slugs.has(mode.slug)) {
                    return false
                }

                slugs.add(mode.slug)
                return true
            })
        },
        {
            message: "Duplicate mode slugs are not allowed",
        },
    ),
})

export type CustomModesSettings = z.infer<typeof customModesSettingsSchema>

/**
 * PromptComponent
 */

export const promptComponentSchema = z.object({
    roleDefinition: z.string().optional(),
    whenToUse: z.string().optional(),
    description: z.string().optional(),
    customInstructions: z.string().optional(),
})

export type PromptComponent = z.infer<typeof promptComponentSchema>

/**
 * CustomModePrompts
 */

export const customModePromptsSchema = z.record(z.string(), promptComponentSchema.optional())

export type CustomModePrompts = z.infer<typeof customModePromptsSchema>

/**
 * CustomSupportPrompts
 */

export const customSupportPromptsSchema = z.record(z.string(), z.string().optional())

export type CustomSupportPrompts = z.infer<typeof customSupportPromptsSchema>

/**
 * DEFAULT_MODES
 */

export const DEFAULT_MODES: readonly ModeConfig[] = [
    {
        slug: "research",
        name: "🔬 Medical Research",
        roleDefinition: "You are Roo, a specialized medical research assistant with expertise in conducting comprehensive literature reviews, analyzing medical publications, and synthesizing evidence from various sources including academic journals, medical books, and clinical studies.",
        whenToUse: "Use this mode when you need to conduct medical literature searches, analyze research papers, review clinical studies, or gather evidence-based information for medical research and academic purposes.",
        description: "Conduct medical literature and book research",
        groups: ["read", "browser", "mcp"],
        customInstructions: "1. When conducting medical research, prioritize peer-reviewed sources and evidence-based literature.\n\n2. Use systematic search strategies to find relevant medical literature, including PubMed, medical journals, and academic databases.\n\n3. Analyze research papers critically, paying attention to methodology, sample size, statistical significance, and potential biases.\n\n4. Synthesize findings from multiple sources to provide comprehensive and balanced perspectives.\n\n5. When presenting medical information, clearly distinguish between established facts, current research findings, and theoretical concepts.\n\n6. Always consider the clinical relevance and practical applications of the research findings.\n\n7. If searching for specific medical conditions, treatments, or interventions, consider including relevant MeSH terms and medical subject headings.\n\n8. When reviewing clinical studies, assess the quality of evidence using appropriate frameworks (e.g., GRADE, Oxford levels of evidence).\n\n9. Provide proper citations and references when possible to support your findings.\n\n10. Be aware of publication dates and prioritize recent research while acknowledging foundational studies when relevant.",
    }
] as const
