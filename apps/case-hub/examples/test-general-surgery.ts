/**
 * 普外科病历生成测试
 */
import { generateLongCase, saveCaseWithMetadata } from "../src/index.js";

async function main() {
    console.log("=== 测试：普外科病历生成 ===\n");

    try {
        const result = await generateLongCase({
            department: "普外科",
            disease: "急性阑尾炎",
            ageRange: { min: 25, max: 45 },
            gender: "男"
        });

        console.log("\n=== 生成的病历 ===");
        console.log(result.content);
        console.log("\n=== 病历字数统计 ===");
        console.log(`总字符数: ${result.content.length}`);

        console.log("\n=== 元数据 ===");
        console.log(result.metadata);

        // 保存病历
        const filepath = saveCaseWithMetadata(result.content, result.metadata, {
            outputDir: "./output",
            prefix: "general-surgery-appendicitis"
        });
        console.log(`\n文件已保存至: ${filepath}`);

    } catch (error) {
        console.error("生成失败:", error);
    }
}

main();
