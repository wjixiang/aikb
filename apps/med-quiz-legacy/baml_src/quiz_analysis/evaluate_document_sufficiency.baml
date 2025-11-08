class DocumentEvaluation {
    sufficient bool @description(#"
        Whether the retrieved documents provide sufficient information
        to explain all key knowledge points in the quiz
    "#)
    explanation string @description(#"
        Explanation of why the documents are sufficient or not,
        including any gaps in coverage
    "#)

    missed_knowledge_point KnowledgePoints[]
}

function EvaluateDocumentSufficiency(
    quiz_content: string,
    documents: RetrievedDocument[]
) -> DocumentEvaluation {
    client "GLM4Flash"
    prompt #"
    {{_.role('system')}}
    你是一名医学教育专家助手，负责评估检索到的文档是否足以解释给定的医学试题并给出缺少的知识点。请严格按照以下标准进行评估：

    {{_.role('user')}}
    ---评估标准---
    1. 文档必须覆盖试题解析所需的所有核心知识点
    2. 每个知识点应有至少一个文档提供详细解释
    3. 文档内容应准确、权威且与知识点直接相关
    4. 如果存在以下情况则认为文档不足：
       - 关键知识点无对应文档解释
       - 文档内容过于简略或模糊
       - 文档之间存在矛盾信息

    ---试题内容---
    {{ quiz_content }}


    ---检索文档---
    {% for doc in documents %}
    ### 文档 {{ loop.index }} ###
    {{ doc.content }}
    {% endfor %}

    ---评估结果---
    请根据上述标准评估文档是否足够，提供简要解释，并给出缺失的知识点：
    {{ ctx.output_format }}
    "#
}

test TestEvaluateDocumentSufficiency {
    functions [EvaluateDocumentSufficiency]
    args {
        quiz_content #"
            2009N41A 下列选项中，不符合萎缩特点的是
            A: A.自噬小体增多
            B: B.器官均匀性缩小
            C: C.器官功能低下
            D: D.细胞核固缩
            Answer: D
        "#
        documents [
            #"
                萎缩是指已发育正常的细胞、组织或器官的体积缩小。
                萎缩时细胞合成代谢降低，能量需求减少，原有功能下降。
            "#,
            #"
                自噬小体是细胞在营养缺乏时形成的结构，用于降解自身成分
                为细胞提供能量，在萎缩过程中自噬小体数量会增加。
            "#
        ]
    }
}