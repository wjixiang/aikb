/**
 * 骨科病历生成测试
 */
import { generateLongCase, saveCaseWithMetadata } from "../src/index.js";

async function main() {
    console.log("=== 测试：骨科病历生成 ===\n");

    try {
        const result = await generateLongCase({
            department: "骨科",
            disease: "骨折",
            ageRange: { min: 30, max: 50 },
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
            prefix: "orthopedics-fracture"
        });
        console.log(`\n文件已保存至: ${filepath}`);

    } catch (error) {
        console.error("生成失败:", error);
    }
}

main();
