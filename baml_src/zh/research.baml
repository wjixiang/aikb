function Research(arg:string) -> string {
    client GLM4Flash
    prompt #"
        Make a knowledge note about {{arg}}
    "#
}

class Entity_Plain_Definition {
    definition string
}

function Generate_plain_definition(entity_name:string, desc_information: string) -> Entity_Plain_Definition{
    client GLM4Flash
    prompt #"
        {{_.role('user')}}

        请你根据你所具有的知识，为 **{{entity_name}}** 编写定义
        1. 要求描述精准，鼓励通过增加描述文本篇幅来提高精确度，但仍需考量简洁度
        2. 使用专业用语，减少主观偏差

        当前关于 **{{entity_name}}** 的描述信息：
        {{desc_information}}

        {{ctx.output_format}}
    "#
}

test TestName {
  functions [Generate_plain_definition]
  args {
    entity_name #"
      高血压
    "#
    desc_information #"
      类型: 疾病
    "#
  }
}
