/**
 * 病历保存工具
 */
import * as fs from "fs";
import * as path from "path";

export interface SaveOptions {
    /** 输出目录 */
    outputDir?: string;
    /** 文件名前缀 */
    prefix?: string;
    /** 是否添加时间戳 */
    timestamp?: boolean;
}

/**
 * 默认保存选项
 */
const defaultOptions: SaveOptions = {
    outputDir: "./output",
    prefix: "case",
    timestamp: true
};

/**
 * 保存病历到文件
 * @param content 病历内容
 * @param options 保存选项
 * @returns 保存的文件路径
 */
export function saveCase(
    content: string,
    options: SaveOptions = {}
): string {
    const opts = { ...defaultOptions, ...options };

    // 确保输出目录存在
    if (!fs.existsSync(opts.outputDir!)) {
        fs.mkdirSync(opts.outputDir!, { recursive: true });
    }

    // 生成文件名
    const timestamp = opts.timestamp
        ? new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
        : "";
    const filename = timestamp
        ? `${opts.prefix}-${timestamp}.md`
        : `${opts.prefix}.md`;
    const filepath = path.join(opts.outputDir!, filename);

    // 写入文件
    fs.writeFileSync(filepath, content, "utf-8");

    return filepath;
}

/**
 * 批量保存病历
 * @param cases 病历内容数组
 * @param options 保存选项
 * @returns 保存的文件路径数组
 */
export function saveCases(
    cases: string[],
    options: SaveOptions = {}
): string[] {
    const results: string[] = [];

    cases.forEach((content, index) => {
        const filepath = saveCase(content, {
            ...options,
            prefix: options.prefix || `case-${index + 1}`,
            timestamp: options.timestamp ?? true
        });
        results.push(filepath);
    });

    return results;
}

/**
 * 保存带元数据的病历
 * @param content 病历内容
 * @param metadata 元数据
 * @param options 保存选项
 * @returns 保存的文件路径
 */
export function saveCaseWithMetadata(
    content: string,
    metadata: Record<string, any>,
    options: SaveOptions = {}
): string {
    const opts = { ...defaultOptions, ...options };

    // 添加元数据到文件头部
    const metadataStr = `---
department: ${metadata.department}
disease: ${metadata.disease}
caseType: ${metadata.caseType}
generatedAt: ${metadata.generatedAt}
---

${content}`;

    return saveCase(metadataStr, opts);
}

export default {
    saveCase,
    saveCases,
    saveCaseWithMetadata
};
