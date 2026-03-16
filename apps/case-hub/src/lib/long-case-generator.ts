/**
 * 病历生成器 - 长病历版本
 * 分段生成后合并，生成约3000字的长病历
 */

import type { ApiClient, ApiResponse } from "agent-lib";
import type { CaseGeneratorOptions, GeneratedCase } from "../types/generator.type.js";
import {
    randomName,
    randomAge,
    randomChoice,
    randomAddress,
    getRandomTemplate
} from "./case-templates.js";
import {
    generatePart1,
    generatePart2,
    generatePart3,
    generatePart4,
    generatePart5
} from "./prompt-long.js";

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
 * 长病历生成器类
 */
export class LongCaseGenerator {
    private apiClient: ApiClient;

    /**
     * 构造函数
     * @param apiClient LLM API客户端
     */
    constructor(apiClient: ApiClient) {
        this.apiClient = apiClient;
    }

    /**
     * 生成长病历
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
        const address = randomAddress();
        const caseType = options.caseType || randomCaseType();

        // 获取模板
        const template = getRandomTemplate(department, disease);
        const finalDepartment = template.department;
        const finalDisease = template.disease.name;

        console.log("正在生成第一部分（一般项目+主诉+现病史）...");
        const part1 = await this.generatePart(generatePart1({
            department: finalDepartment,
            disease: finalDisease,
            diseaseInfo: template.disease,
            age,
            gender,
            patientName,
            address
        }));

        console.log("正在生成第二部分（既往史+个人史+家族史）...");
        const part2 = await this.generatePart(generatePart2({
            diseaseInfo: template.disease
        }));

        console.log("正在生成第三部分（体格检查）...");
        const part3 = await this.generatePart(generatePart3());

        console.log("正在生成第四部分（专科情况+辅助检查）...");
        const part4 = await this.generatePart(generatePart4({
            diseaseInfo: template.disease
        }));

        console.log("正在生成第五部分（诊断+诊疗计划）...");
        const part5 = await this.generatePart(generatePart5({
            department: finalDepartment,
            disease: finalDisease,
            diseaseInfo: template.disease,
            age,
            gender,
            caseType
        }));

        // 合并所有部分
        const content = this.mergeParts(part1, part2, part3, part4, part5);

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
     * 生成单个部分
     */
    private async generatePart(prompt: string): Promise<string> {
        const response = await this.apiClient.makeRequest(
            prompt,
            "",
            [],
            undefined,
            undefined
        );
        return this.extractContent(response);
    }

    /**
     * 提取病历内容
     */
    private extractContent(response: ApiResponse): string {
        let content = "";

        if (response.textResponse) {
            content = response.textResponse;
        } else if (response.toolCalls && response.toolCalls.length > 0) {
            content = response.toolCalls.map(tc => tc.arguments).join("\n");
        } else {
            content = JSON.stringify(response, null, 2);
        }

        // 过滤掉 AI 思考内容
        content = this.removeThinkingContent(content);

        return content;
    }

    /**
     * 移除 AI 思考内容
     */
    private removeThinkingContent(content: string): string {
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
     * 合并各部分
     */
    private mergeParts(
        part1: string,
        part2: string,
        part3: string,
        part4: string,
        part5: string
    ): string {
        // 清理各部分，移除可能重复的标题
        const cleanPart = (part: string, title: string) => {
            // 移除可能出现在开头的标题
            let cleaned = part.replace(new RegExp(`^${title}\\s*`, "i"), "");
            return cleaned.trim();
        };

        // 构建完整病历
        return `${part1}

${part2}

${part3}

${part4}

${part5}`;
    }

    /**
     * 批量生成长病历
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
 * 创建长病历生成器
 */
export function createLongCaseGenerator(apiClient: ApiClient): LongCaseGenerator {
    return new LongCaseGenerator(apiClient);
}

/**
 * 快速生成长病历（简化API）
 */
export async function generateLongCase(options: CaseGeneratorOptions = {}): Promise<GeneratedCase> {
    const { getApiClient } = await import("./llm-api.js");
    const client = getApiClient();
    const generator = new LongCaseGenerator(client);
    return generator.generate(options);
}

export default {
    LongCaseGenerator,
    createLongCaseGenerator,
    generateLongCase
};
