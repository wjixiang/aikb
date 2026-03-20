/**
 * 骨科批量病历生成脚本
 * 生成骨科各种常见病种的病历
 */
import { generateLongCase, saveCaseWithMetadata } from "../src/index.js";
import { departmentTemplates } from "../src/lib/case-templates.js";

/**
 * 骨科所有病种
 */
const orthopedicDiseases = [
  "骨折",
  "腰椎间盘突出",
  "膝关节骨关节炎",
  "颈椎病",
  "肩周炎",
  "骨质疏松症",
  "股骨头坏死",
  "腱鞘炎",
  "半月板损伤",
  "前交叉韧带损伤",
  "骨髓炎",
  "骨软骨瘤",
  "腰椎管狭窄症",
  "踝关节扭伤",
  "桡骨远端骨折"
];

/**
 * 随机年龄范围（根据疾病类型调整）
 */
function getAgeRange(disease: string): { min: number; max: number } {
  // 骨质疏松、股骨头坏死多见于中老年
  if (["骨质疏松症", "股骨头坏死", "膝关节骨关节炎", "腰椎管狭窄症"].includes(disease)) {
    return { min: 45, max: 75 };
  }
  // 半月板损伤、韧带损伤多见于青壮年
  if (["半月板损伤", "前交叉韧带损伤", "踝关节扭伤"].includes(disease)) {
    return { min: 20, max: 45 };
  }
  // 骨折、腱鞘炎等常见于各年龄段
  return { min: 25, max: 60 };
}

/**
 * 随机性别
 */
function getRandomGender(): "男" | "女" {
  return Math.random() > 0.5 ? "男" : "女";
}

/**
 * 生成单个病历
 */
async function generateOne(disease: string, index: number): Promise<void> {
  const ageRange = getAgeRange(disease);
  const gender = getRandomGender();

  console.log(`\n[${index + 1}/${orthopedicDiseases.length}] 生成: ${disease} (${gender}, ${ageRange.min}-${ageRange.max}岁)`);

  try {
    const result = await generateLongCase({
      department: "骨科",
      disease: disease,
      ageRange,
      gender
    });

    // 生成安全的文件名
    const safeName = disease.replace(/[/\s]/g, "-");
    const timestamp = new Date().toISOString().slice(0, 10);

    // 保存病历
    const filepath = saveCaseWithMetadata(result.content, result.metadata, {
      outputDir: "./output/orthopedics",
      prefix: `${safeName}`
    });

    console.log(`  ✓ 字数: ${result.content.length}`);
    console.log(`  ✓ 已保存: ${filepath}`);
  } catch (error) {
    console.error(`  ✗ 生成失败: ${error}`);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log("=== 骨科批量病历生成 ===");
  console.log(`病种数量: ${orthopedicDiseases.length}`);
  console.log("开始时间:", new Date().toLocaleString("zh-CN"));
  console.log("=".repeat(50));

  // 确保输出目录存在
  const fs = await import("fs");
  const outputDir = "./output/orthopedics";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 逐个生成病历（避免并发请求过多）
  for (let i = 0; i < orthopedicDiseases.length; i++) {
    await generateOne(orthopedicDiseases[i], i);

    // 每个病历之间稍作延迟，避免API限流
    if (i < orthopedicDiseases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("生成完成!");
  console.log("结束时间:", new Date().toLocaleString("zh-CN"));
  console.log(`输出目录: ${outputDir}`);
}

main().catch(console.error);
