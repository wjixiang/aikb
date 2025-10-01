function GenerateWikiSearchPattern(query:string) -> WikiSearchParamsBaml {
    client GLM4Flash
    prompt #"
        分析传入的问题，将其转化为Wikipedia检索式。
        
        请根据用户的问题，确定最合适的语言代码、搜索查询词和需要返回的结果数量。
        
        语言代码应该是ISO 639-1语言代码，如'en'表示英语，'zh'表示中文等。
        搜索查询词应该是适合在Wikipedia中搜索的关键词或短语。
        结果数量应该是一个合理的数字，通常在3-10之间，取决于问题的复杂性。

        {{ ctx.output_format }}

        {{ _.role('user') }}
        {{query}}
        
    "#
}

test TestGenerateWikiSearchPattern {
  functions [GenerateWikiSearchPattern]
  args {
    query #"
      什么是高血压？
    "#
  }
}

function SummarizeWikiResults(query: string, search_results: string) -> string {
    client GLM4Flash
    prompt #"
        {{_.role('user')}}
        
        请根据以下维基百科搜索结果，针对查询"{{query}}"提供一个全面、准确的总结。
        
        ---搜索结果---
        {{search_results}}
        
        ---要求---
        1. 综合所有搜索结果的信息，提供一个连贯的总结
        2. 确保总结覆盖查询的主要方面
        3. 使用专业、客观的语言
        4. 如果搜索结果之间存在矛盾，请指出并尝试解释
        5. 总结应该简洁明了，大约300-500字
        
        
    "#
}

