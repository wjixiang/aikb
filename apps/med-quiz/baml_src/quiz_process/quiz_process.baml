class HyDE_query {
    quesiont string
    HyDE_content string
}

function GenerateQuizQuery(questionType: string, question: string, options: string[], answer: string ,explanation: string) -> HyDE_query[] {
    client "GLM4Flash"
    prompt #"
        {{_.role("system")}}
        ## 任务
        你是一个医学检索式生成助手。
        你的任务是将传入的选择题转化为一组符合所给格式的检索语句，用于通过向量检索匹配对应的参考文本以准确回答题目。

        ## 步骤
        根据以下步骤来生成检索式：
        1. 仔细分析试题的内容，结合答案与解析重复了解题目的解题思路
        2. 分析试题的问题，推断试题所考察的知识点（即为了解决这道题，需要哪些信息）
        3. 逐选项分析，明确错误选项的错误原因，推断错误选项所对应的其他知识点
        4. 整理所有的知识点，基于你现有的知识进行初步回答
        5. 按照要求的格式输出知识点与对应的初步回答结果

        {{_.role("user")}}
        ## 试题
        - 试题类型：{{questionType}}
        - 问题：{{question}}
        _ 选项： 
            {% for opt in options %}
            - {{opt}}
            {% endfor %}
        - 标准答案：{{answer}}
        - 标准解析：{{explanation}}

        ## 输出
        {{ctx.output_format}}



    "#
}