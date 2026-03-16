/**
 * 长病历生成示例
 */
import { generateLongCase, saveCaseWithMetadata } from "../src/index.js";

async function main() {
    console.log("=== 测试：生成长病历（约3000字） ===\n");

    try {
        // 生成长病历
        const result = await generateLongCase({
            department: "呼吸内科",
            disease: "肺炎",
            ageRange: { min: 45, max: 60 },
            gender: "男",
            caseType: "C型"
        });

        console.log("\n=== 生成的病历 ===");
        console.log(result.content);
        console.log("\n=== 病历字数统计 ===");
        console.log(`总字符数: ${result.content.length}`);
        console.log(`估计中文字数: ${result.content.replace(/[^\\u4e00-\\u9fa5]/g, "").length}`);

        console.log("\n=== 元数据 ===");
        console.log(result.metadata);

        // 保存病历
        const filepath = saveCaseWithMetadata(result.content, result.metadata, {
            outputDir: "./output",
            prefix: "long-case"
        });
        console.log(`\n文件已保存至: ${filepath}`);

    } catch (error) {
        console.error("生成失败:", error);
    }
}

main();
