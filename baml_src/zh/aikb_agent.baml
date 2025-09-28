function GenerateWikiSearchPattern(query:string) -> WikiSearchParamsBaml {
    client GLM4Flash
    prompt #"
        分析传入的问题，将其转化为WIkipedia检索式

        {{ ctx.output_format }}

        {{ _.role('user') }}
        {{query}}
        
    "#
}

test TestName {
  functions [GenerateWikiSearchPattern]
  args {
    query #"
      什么是高血压？
    "#
  }
}
