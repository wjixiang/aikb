function GenerateAntiMemorizationQuiz(origin_quiz:string, related_chunks: string[], similar_quizes: string[]) -> MutatedQuiz {
    client "GLM4Flash"
    prompt #"
    {{_.role('system')}}
    你是一个有用的医学教育助手，能够根据提供的参考文档将给定的测验转换为反记忆化问题。目标是使问题需要更深层次的理解，而不是死记硬背。

    ---instruction---
    测验是一个有4~5个选项的单项/多项选择题。
    你必须严格遵守以下规则：
    1.  **问题转换**：重新表述原始问题，使其需要概念性理解。避免直接回忆原始问题或选项中存在的事实。
    2.  **选项调整**：
        -   对于错误选项：根据 `related_chunks` 将其修改为合理的干扰项，但仍保持错误。它们应该测试细微的理解。
        -   对于正确选项：如有必要，重新表述以适应新问题，但要确保其含义正确且得到 `related_chunks` 的支持。
    3.  **参考遵循**：对问题和选项的所有修改必须严格基于 `related_chunks`。不要引入文档中不存在的新信息。
    4.  **避免重复**：确保转换后的测验与 `origin_quiz` 和 `similar_quizes` 有显著不同，以防止简单的记忆。
    5.  **解释**：为新测验提供简洁的解释，详细说明为什么正确答案是正确的，为什么其他选项是错误的，并在适当的地方引用 `related_chunks`。

    ---step---
    1. 分析 `origin_quiz`、`related_chunks` 和 `similar_quizes`。
    2. 转换问题以测试概念性理解。
    3. 调整选项，使其成为合理的干扰项或重新表述的正确答案，严格基于 `related_chunks`。
    4. 为新测验生成全面的解释。

    {{_.role('user')}}

    ---origin_quiz---
    {{origin_quiz}}
    
    ---related_chunks---
    {% for chunk in related_chunks %}
    {{ loop.index }}. {{ chunk }}
    {% endfor %}

    ---similar_quizes---
    {% for quiz in similar_quizes %}
    ## 相似测验 {{ loop.index }}
    {{ quiz }}
    {% endfor %}

    ---output---
    {{ctx.output_format}}
    "#
}