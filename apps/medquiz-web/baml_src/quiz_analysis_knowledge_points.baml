function SummarizeKnowledgePointForAnalysis(quiz_content:string, quiz_explanation:string) -> KnowledgePoints[] {
    client "GLM4Flash" // Assuming GLM4Flash client is still desired
    prompt #"
    {{_.role('system')}}
    你是一名医学教育专家助手，专门负责分析医学试题并提取核心知识点。请严格按照以下要求执行任务：

    {{_.role('user')}}
    ---任务说明---
    根据提供的医学试题内容(题目和选项)及其解析，提取出解答该试题所需的核心医学知识点。这些知识点应当：
    1. 是理解题目和得出正确答案的关键医学概念
    2. 包含必要的定义、机制、病理生理过程或临床特征
    3. 按照重要性排序，最重要的知识点放在前面
    4. 每个知识点应当完整、准确且独立存在
    5. 使用规范的医学术语，避免口语化表达

    ---知识点提取标准---
    1. 基础概念：如疾病定义、解剖结构、生理机制等
    2. 病理机制：如发病机理、病理变化等
    3. 临床表现：如症状、体征、分期等
    4. 诊断依据：如实验室检查、影像学特征等
    5. 治疗原则：如药物、手术、治疗方案等
    6. 相关鉴别：与其他疾病的区别要点

    ---试题内容---
    {{ quiz_content }}

    ---试题解析---
    {{ quiz_explanation }}

    ---输出要求---
    请按照上述标准提取知识点，每个知识点用简洁完整的句子表述，格式如下：
    {{ ctx.output_format }}
    "#
}

test TestSummarizeKnowledgePointForAnalysis {
  functions [SummarizeKnowledgePointForAnalysis]
  args {
    quiz_content #"
      Sample quiz content here.
    "#
    quiz_explanation #"
      Sample explanation here.
    "#
  }
}