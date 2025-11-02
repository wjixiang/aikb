import { connectToDatabase } from "@/lib/db/mongodb";
import { TagPreset } from "@/types/quizSelector.types";

const defaultPresets: Omit<TagPreset, "_id" | "userId">[] = [
  {
    name: "高频错题",
    description: "包含常见易错标签的预设",
    includeTags: ["易错", "重点", "难点"],
    excludeTags: [],
    includeTagFilterMode: "OR",
    excludeTagFilterMode: "AND",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "基础知识",
    description: "基础概念和定义类题目",
    includeTags: ["基础", "概念", "定义"],
    excludeTags: ["难题", "综合"],
    includeTagFilterMode: "OR",
    excludeTagFilterMode: "OR",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "临床病例",
    description: "临床病例分析相关题目",
    includeTags: ["病例", "临床", "诊断"],
    excludeTags: ["理论", "基础"],
    includeTagFilterMode: "OR",
    excludeTagFilterMode: "OR",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "排除已掌握",
    description: "排除已掌握的知识点",
    includeTags: [],
    excludeTags: ["已掌握", "熟悉"],
    includeTagFilterMode: "AND",
    excludeTagFilterMode: "OR",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

async function initDefaultTagPresets() {
  try {
    const { db } = await connectToDatabase();
    
    // 清空现有的默认预设
    await db.collection("tagpresets").deleteMany({ isDefault: true });
    
    // 插入新的默认预设
    const result = await db.collection("tagpresets").insertMany(defaultPresets);
    
    console.log(`成功创建 ${result.insertedCount} 个默认标签预设`);
    console.log("默认预设列表:");
    defaultPresets.forEach(preset => {
      console.log(`- ${preset.name}: ${preset.description}`);
    });
    
  } catch (error) {
    console.error("初始化默认标签预设失败:", error);
    process.exit(1);
  }
}

// 如果是直接运行此脚本
if (require.main === module) {
  initDefaultTagPresets()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { initDefaultTagPresets };