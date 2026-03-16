/**
 * 病历生成示例 - 包含保存功能
 */
import { generateCase, saveCase, saveCaseWithMetadata } from "../src/index.js";

async function main() {
    console.log("=== 测试：生成并保存病历 ===\n");

    try {
        // 生成病历
        const result = await generateCase({
            department: "呼吸内科",
            disease: "肺炎",
            anonymize: true
        });

        console.log("=== 生成的病历 ===");
        console.log(result.content);
        console.log("\n=== 元数据 ===");
        console.log(result.metadata);

        // 保存病历（简单保存）
        const filepath = saveCase(result.content, {
            outputDir: "./output",
            prefix: "case"
        });
        console.log("\n=== 保存成功 ===");
        console.log(`文件已保存至: ${filepath}`);

        // 保存病历（带元数据）
        const filepath2 = saveCaseWithMetadata(result.content, result.metadata, {
            outputDir: "./output",
            prefix: "case-with-meta"
        });
        console.log(`文件已保存至: ${filepath2}`);

    } catch (error) {
        console.error("生成失败:", error);
    }
}

main();
