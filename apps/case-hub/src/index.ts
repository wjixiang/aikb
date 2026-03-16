/**
 * Case Hub - 病历管理系统
 * 提供病历生成、病历类型定义等功能
 */

// 类型导出
export * from "./types/case.type.js";
export * from "./types/generator.type.js";

// 模板导出
export {
    surnames,
    givenNames,
    randomName,
    randomAge,
    randomDate,
    randomAddress,
    randomChoice,
    occupations,
    departmentTemplates,
    getRandomTemplate
} from "./lib/case-templates.js";

// 生成器导出
export {
    CaseGenerator,
    createCaseGenerator,
    generateCase
} from "./lib/case-generator.js";

// 长病历生成器导出
export {
    LongCaseGenerator,
    createLongCaseGenerator,
    generateLongCase
} from "./lib/long-case-generator.js";

// API 导出
export { getApiClient } from "./lib/llm-api.js";

// 保存功能导出
export {
    saveCase,
    saveCases,
    saveCaseWithMetadata
} from "./lib/case-saver.js";
