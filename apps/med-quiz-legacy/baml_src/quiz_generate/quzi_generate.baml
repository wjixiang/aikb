class Rawquiz_A {
    question string
    options Option[]
    answer string @description(#"
        答案必须唯一，必须为option的对应序号(如A/B/C/D)
    "#)
}

function GenerateQuizzes_single(content:string, quiz_num:int) -> Rawquiz_A[] {
    client GLM4Flash
    prompt #"
        {{_.role('user')}}
        根据传入的知识笔记生成{{quiz_num}}道单选题
        
        ---参考笔记---
        {{content}}

        ---output---
        {{ctx.output_format}}
    "#
}

test TestName {
  functions [GenerateQuizzes_single]
  args {
    content #"
      title: R-S细胞的类型
- 典型R-S细胞/[[镜影细胞]]/多核瘤巨细胞`三大一红无分裂`
	- **双**核
	- 核**大**呈**空泡**状
	- 核仁**明显**呈**红**色，伴**周围空晕**
	- 嗜**双**性
	- **无**核分裂象
- 不典型RS细胞
	- [[霍奇金细胞]]（**单**核）
- 变异的RS细胞
	- [[陷窝细胞]]
	- [[爆米花细胞]]
	- [[木乃伊细胞]]

    "#
    quiz_num 3
  }
}
