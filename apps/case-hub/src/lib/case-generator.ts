/**
 * 病历生成器
 * 使用LLM生成完整的住院病历
 */

import type { ApiClient, ApiResponse } from "agent-lib";
import type { CaseGeneratorOptions, GeneratedCase } from "../types/generator.type.js";
import {
    randomName,
    randomAge,
    randomChoice,
    getRandomTemplate
} from "./case-templates.js";
import { generateCasePrompt, generateAnonymizedCasePrompt } from "./prompt.js";

/**
 * 病例分型数组
 */
const caseTypes = ["A型", "B型", "C型", "D型"] as const;

/**
 * 随机生成病例分型
 */
function randomCaseType(): "A型" | "B型" | "C型" | "D型" {
    return randomChoice([...caseTypes]) as "A型" | "B型" | "C型" | "D型";
}

/**
 * 病历生成器类
 */
export class CaseGenerator {
    private apiClient: ApiClient;

    /**
     * 构造函数
     * @param apiClient LLM API客户端
     */
    constructor(apiClient: ApiClient) {
        this.apiClient = apiClient;
    }

    /**
     * 生成病历
     * @param options 生成选项
     * @returns 生成的病历
     */
    async generate(options: CaseGeneratorOptions = {}): Promise<GeneratedCase> {
        // 确定参数
        const department = options.department;
        const disease = options.disease;
        const patientName = options.patientName || randomName();
        const age = options.ageRange
            ? randomAge(options.ageRange.min, options.ageRange.max)
            : randomAge(18, 75);
        const gender = options.gender || randomChoice(["男", "女"] as const);
        const caseType = options.caseType || randomCaseType();

        // 获取模板
        const template = getRandomTemplate(department, disease);
        const finalDepartment = template.department;
        const finalDisease = template.disease.name;

        // 生成提示词
        const prompt = options.anonymize
            ? generateAnonymizedCasePrompt({
                department: finalDepartment,
                disease: finalDisease,
                diseaseInfo: template.disease,
                age,
                gender,
                caseType
            })
            : generateCasePrompt({
                department: finalDepartment,
                disease: finalDisease,
                diseaseInfo: template.disease,
                patientName,
                age,
                gender,
                caseType
            });

        // 调用LLM生成病历
        const response = await this.apiClient.makeRequest(
            prompt,
            "",
            [],
            undefined,
            undefined
        );

        // 提取生成的病历内容
        const content = this.extractContent(response);

        return {
            content,
            metadata: {
                department: finalDepartment,
                disease: finalDisease,
                caseType,
                generatedAt: new Date().toISOString()
            }
        };
    }

    /**
     * 提取病历内容
     */
    private extractContent(response: ApiResponse): string {
        let content = "";

        // 直接返回 textResponse，这是 ApiResponse 的主要字段
        if (response.textResponse) {
            content = response.textResponse;
        } else if (response.toolCalls && response.toolCalls.length > 0) {
            // 备用：如果有 toolCalls，尝试从中提取内容
            content = response.toolCalls.map(tc => tc.arguments).join("\n");
        } else {
            content = JSON.stringify(response, null, 2);
        }

        // 过滤掉 AI 思考内容（<think>和</think>标签）
        content = this.removeThinkingContent(content);

        return content;
    }

    /**
     * 移除 AI 思考内容
     */
    private removeThinkingContent(content: string): string {
        // 移除 AI 思考标签内容
        const startTag = "<think>";
        const endTag = "</think>";
        let result = "";
        let currentIndex = 0;
        let startIndex = content.indexOf(startTag);

        while (startIndex !== -1) {
            result += content.slice(currentIndex, startIndex);
            const endIndex = content.indexOf(endTag, startIndex + startTag.length);
            if (endIndex === -1) break;
            currentIndex = endIndex + endTag.length;
            startIndex = content.indexOf(startTag, currentIndex);
        }

        result += content.slice(currentIndex);
        return result.trim();
    }

    /**
     * 批量生成病历
     * @param count 生成数量
     * @param options 生成选项
     * @returns 生成的病历数组
     */
    async batchGenerate(
        count: number,
        options: CaseGeneratorOptions = {}
    ): Promise<GeneratedCase[]> {
        const results: GeneratedCase[] = [];

        for (let i = 0; i < count; i++) {
            const result = await this.generate(options);
            results.push(result);
        }

        return results;
    }
}

/**
 * 创建默认的病历生成器
 */
export function createCaseGenerator(apiClient: ApiClient): CaseGenerator {
    return new CaseGenerator(apiClient);
}

/**
 * 快速生成病历（简化API）
 */
export async function generateCase(options: CaseGeneratorOptions = {}): Promise<GeneratedCase> {
    const { getApiClient } = await import("./llm-api.js");
    const client = getApiClient();
    const generator = new CaseGenerator(client);
    return generator.generate(options);
}

export default {
    CaseGenerator,
    createCaseGenerator,
    generateCase
};
