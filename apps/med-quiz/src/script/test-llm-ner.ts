import { ReferenceChunk } from "@/lib/GraphRAG/KnowledgeGraphWeaver";
import { JanusGraphConfig } from "@/lib/GraphRAG/janusGraphClient";
import LLMNer from "@/lib/GraphRAG/LLMNer";
import { entity_types } from "@/lib/GraphRAG/prompt/prompt";

// 配置JanusGraph连接
const janusConfig: JanusGraphConfig = {
  host: "localhost",
  port: 8182,
  traversalSource: "g",
  username: "",
  password: "",
};

// 配置LLMNer选项
const nerOptions = {
  JanusGraphConfig: janusConfig,
  extract_llm_modal_name: "glm-4-flash",
  language: "Chinese",
  tuple_delimiter: "|",
  record_delimiter: "---",
  completion_delimiter: "DONE",
  debug: true,
};

// 创建LLMNer实例
const ner = new LLMNer(nerOptions);

// 测试文本
const testText = `发免疫性血小板减少症（primary immune thrombocytopenia，ITP）既往也叫特发性血小板减少性紫癜，是一种以血小板过度破坏和血小板生成减少为特点的自身免疫病，也是临床上最为常见的出血性疾病。年发病率约为（5～10）/10 万，男女发病率相近，育龄期女性发病率高于男性，60 岁以上人群的发病率为 60 岁以下人群的 2 倍，且出血风险随年龄增高而增加。本节主要讲述成人 ITP。`;

const testChunk: ReferenceChunk = {
  id: "test-chunk-1",
  referenceId: "ref-123", // Added referenceId property
  content: testText,
  add_date: new Date(),
};

// 实体类型

// 执行实体提取
(async () => {
  try {
    console.log("开始实体提取测试...");
    console.log("测试文本:", testText);
    console.log("实体类型:", entity_types);

    const result = await ner.extract_entities(testChunk, entity_types);

    console.log("\n实体提取结果:");
    console.log(result);
    console.log("\n测试完成");
  } catch (error) {
    console.error("实体提取测试失败:", error);
  }
})();
