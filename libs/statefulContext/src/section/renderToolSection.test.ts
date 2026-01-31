import { describe, it, expect } from "vitest";
import { renderToolSection, renderZodSchema } from "./renderToolSection";
import * as z from "zod";

describe("renderToolSection", () => {
    it("should render empty tools array", () => {
        const result = renderToolSection([]);
        expect(result.render()).toBe("No tools available.");
    });

    it("should render a simple tool with string parameter", () => {
        const tools = [
            {
                toolName: "echo",
                desc: "Echo a message",
                paramsSchema: z.object({
                    message: z.string().describe("The message to echo"),
                }),
            },
        ];
        const result = renderToolSection(tools).render();
        expect(result).toContain("Tool Name: echo");
        expect(result).toContain("Description: Echo a message");
        expect(result).toContain("Parameters:");
        expect(result).toContain("message: string // The message to echo");
    });

    it("should render a tool with multiple parameters", () => {
        const tools = [
            {
                toolName: "search",
                desc: "Search for items",
                paramsSchema: z.object({
                    query: z.string().min(1).describe("Search query"),
                    limit: z.number().int().min(1).max(100).default(10).describe("Result limit"),
                    exact: z.boolean().optional().describe("Exact match"),
                }),
            },
        ];
        const result = renderToolSection(tools).render();
        expect(result).toContain("Tool Name: search");
        expect(result).toContain("query: string (min: 1) // Search query");
        expect(result).toContain("limit: number (integer) (min: 1) (max: 100) = 10 // Result limit");
        expect(result).toContain("exact: boolean? // Exact match");
    });

    it("should render a tool with nested objects", () => {
        const tools = [
            {
                toolName: "createUser",
                desc: "Create a new user",
                paramsSchema: z.object({
                    name: z.string(),
                    profile: z.object({
                        age: z.number().int(),
                        email: z.string().email(),
                    }),
                }),
            },
        ];
        const result = renderToolSection(tools).render();
        expect(result).toContain("Tool Name: createUser");
        expect(result).toContain("name: string");
        expect(result).toContain("profile: {");
        expect(result).toContain("age: number (integer)");
        expect(result).toContain("email: string (email)");
    });

    it("should render a tool with arrays", () => {
        const tools = [
            {
                toolName: "processItems",
                desc: "Process multiple items",
                paramsSchema: z.object({
                    items: z.array(z.string()).describe("List of items"),
                    counts: z.array(z.number()).optional(),
                }),
            },
        ];
        const result = renderToolSection(tools).render();
        expect(result).toContain("Tool Name: processItems");
        expect(result).toContain("items: string[] // List of items");
        expect(result).toContain("counts: number[]?");
    });

    it("should render a tool with union types", () => {
        const tools = [
            {
                toolName: "setValue",
                desc: "Set a value",
                paramsSchema: z.object({
                    value: z.union([z.string(), z.number(), z.boolean()]),
                }),
            },
        ];
        const result = renderToolSection(tools).render();
        expect(result).toContain("Tool Name: setValue");
        expect(result).toContain("value: (string | number | boolean)");
    });

    it("should render a tool with enum", () => {
        const tools = [
            {
                toolName: "setStatus",
                desc: "Set status",
                paramsSchema: z.object({
                    status: z.enum(["active", "inactive", "pending"]),
                }),
            },
        ];
        const result = renderToolSection(tools).render();
        expect(result).toContain("Tool Name: setStatus");
        expect(result).toContain('status: ("active" | "inactive" | "pending")');
    });

    it("should render a tool with literal", () => {
        const tools = [
            {
                toolName: "setMode",
                desc: "Set mode",
                paramsSchema: z.object({
                    mode: z.literal("production"),
                }),
            },
        ];
        const result = renderToolSection(tools).render();
        expect(result).toContain("Tool Name: setMode");
        expect(result).toContain('mode: "production"');
    });

    it("should render a tool with nullable", () => {
        const tools = [
            {
                toolName: "update",
                desc: "Update record",
                paramsSchema: z.object({
                    id: z.string(),
                    value: z.string().nullable(),
                }),
            },
        ];
        const result = renderToolSection(tools).render();
        expect(result).toContain("Tool Name: update");
        expect(result).toContain("value: string | null");
    });

    it("should render Zod schema directly", () => {
        const schema = z.object({
            name: z.string().describe("User name"),
            age: z.number().int().min(0),
            email: z.string().email().optional(),
        });
        const result = renderZodSchema(schema);
        expect(result).toContain("name: string // User name");
        expect(result).toContain("age: number (integer) (min: 0)");
        expect(result).toContain("email: string (email)?");
    });

    it("should render multiple tools", () => {
        const tools = [
            {
                toolName: "tool1",
                desc: "First tool",
                paramsSchema: z.object({
                    param1: z.string(),
                }),
            },
            {
                toolName: "tool2",
                desc: "Second tool",
                paramsSchema: z.object({
                    param2: z.number(),
                }),
            },
        ];
        const result = renderToolSection(tools).render();
        expect(result).toContain("Tool Name: tool1");
        expect(result).toContain("Tool Name: tool2");
        expect(result).toContain("First tool");
        expect(result).toContain("Second tool");
    });
});
