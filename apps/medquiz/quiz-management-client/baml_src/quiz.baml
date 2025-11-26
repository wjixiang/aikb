// Quiz conversion using LLM
class QuestionAnswerPair {
  type "single" | "multiple" | "share_question" | "share_option"
  question string
  answer string
}

class QuestionAnswerWithExplanationPair {
  type "single" | "multiple" | "share_question" | "share_option"
  question string
  answer string
  explanation string
}

class QuestionAnswerSlice {
  type "single" | "multiple" | "share_question" | "share_option"
  question_range int[]
  /// 正确答案的选项字母：
  /// - 单选题："A", "B", 等
  /// - 多选题："AB", "ACD", 等 (A-E的任意组合)
  answer string
}

class QuestionAnswerWithExplanationSlice {
  type "single" | "multiple" | "share_question" | "share_option"
  question_range int[]
  answer_range int[]
  answer string @description(#"
    正确答案的选项字母：
    - 单选题："A", "B", 等
    - 多选题："AB", "ACD", 等 (A-E的任意组合)
  "#)
}

class ContentSlice {
  start int
  end int
}


class QuizOptions {
  oid "A"|"B"|"C"|"D"|"E"
  text string
}

class QuizAnalysis {
  point string?
  discuss string?
  ai_analysis string?
  link string[]
}

class BasicQuiz {
  type "single" | "multiple" | "share_question" | "share_option"
  clas string @alias("class")
  question string
  options string[]
  answer string
  explanation string? @description(#"
    可选：如果输入内容没有这部分内容，请跳过此字段
  "#)
}

class QAunit {
  question string
  options QuizOptions[]
  answer string @description(#"
    必须是 "A" | "B" | "C" | "D" | "E" 中的一个
  "#)
}

class QAunitForB {
  question string
  answer string @description(#"
    必须是 "A" | "B" | "C" | "D" | "E" 中的一个
  "#)
}

class A3PreQuiz {
  clas string @alias("class")
  mainQuestion string
  subQuestion QAunit[]
  explanation string? @description(#"
    可选：如果输入内容没有这部分内容，请跳过此字段
  "#)
}

class BPreQuiz {
  clas string @alias("class")
  shared_options QuizOptions[]
  questions QAunitForB[]
  explanation string? @description(#"
    可选：如果输入内容没有这部分内容，请跳过此字段
  "#)
}

// class A1Quiz {
//   type "A1"
//   class string
//   unit string
//   tags string[]
//   question string
//   options QuizOptions[]
//   answer "A"|"B"|"C"|"D"|"E"
//   analysis QuizAnalysis
//   source string
// }

// class A2Quiz {
//   type "A2"
//   class string
//   unit string
//   tags string[]
//   question string
//   options QuizOptions[]
//   answer "A"|"B"|"C"|"D"|"E"
//   analysis QuizAnalysis
//   source string
// }

function SplitQuestions(questions_text: string) -> string[] {
  client GLM45Air
  prompt #"
    {{_.role("user")}}
    将以下文本分割成单独的问题。文本可能包含：
    - 编号问题（1., 2., 等）
    - 项目符号
    - 问题之间的空行
    - 其他分隔符
    
    要分割的文本：
    {{ questions_text }}
    
    返回一个JSON数组，其中每个元素是一个完整的问题文本。
    只返回数组，不要返回其他内容。
  "#
}



function ConvertToBasicQuiz(question: string, answer: string, explanation: string?) -> BasicQuiz {
  client GLM45Air
  prompt #"
    {{_.role("user")}}
    将以下问题和答案转换为简单的选择题（BasicQuiz类型）：
    
    要求：
    - 根据答案格式将类型指定为"single"或"multiple"
    - 只返回JSON对象，不要返回其他内容
    - 答案必须是选项对应的大写字母标号
    - 修正OCR识别的文字错误，移除与题目无关的信息（如目录、页码、机构信息）
    - 根据试题内容，自行推断试题所属科目。试题所属科目必须是如下科目列表中的一个：
      - 内科学
      - 外科学
      - 生理学
      - 病理学
      - 生物化学与分子生物学
      - 人文精神
    - 将解释内容抄写到explanation字段中，请你完整的抄写所有的内容，包括只是点、解析、等，若有表格、图片链接等信息，请你务必完整转写。注意修正格式错误与文字错误
    
    
    ###问题###：
    {{ question }}
    
    ###答案###：
    {{ answer }}

    ###解释###
    {{ explanation }}
    
    {{ ctx.output_format }}
  "#
}

function ConvertToA3Quiz(question: string, answer: string, explanation: string?) -> A3PreQuiz {
  client GLM45Air
  prompt #"
    {{_.role("user")}}
    将以下问题和答案转换为包含多个问题的题组：

    要求：
    - 根据答案格式将类型指定为"single"或"multiple"
    - 只返回JSON对象，不要返回其他内容
    - 答案必须是选项对应的大写字母标号
    - 修正OCR识别的文字错误，移除与题目无关的信息（如目录、页码、机构信息）
    - 根据试题内容，自行推断试题所属科目。试题所属科目必须是如下科目列表中的一个：
      - 内科学
      - 外科学
      - 生理学
      - 病理学
      - 生物化学与分子生物学
      - 人文精神
    - 将解释内容抄写到explanation字段中，请你完整的抄写所有的内容，包括只是点、解析、等，若有表格、图片链接等信息，请你务必完整转写。注意修正格式错误与文字错误
    
    ###问题###
    {{ question }}
    
    ###答案###
    {{ answer }}

    ###解释###
    {{ explanation }}

    {{ ctx.output_format }}
  "#
}

function ConvertToBQuiz(question: string, answer: string, explanation: string?) -> BPreQuiz {
  client GLM45Air
  prompt #"
    {{_.role("user")}}
    将以下问题和答案转换为共享相同选项的题组：

    要求：
    - 根据答案格式将类型指定为"single"或"multiple"
    - 只返回JSON对象，不要返回其他内容
    - 答案必须是选项对应的大写字母标号
    - 修正OCR识别的文字错误，移除与题目无关的信息（如目录、页码、机构信息）
    - 根据试题内容，自行推断试题所属科目。试题所属科目必须是如下科目列表中的一个：
      - 内科学
      - 外科学
      - 生理学
      - 病理学
      - 生物化学与分子生物学
      - 人文精神
    - 将解释内容抄写到explanation字段中，请你完整的抄写所有的内容，包括只是点、解析、等，若有表格、图片链接等信息，请你务必完整转写。注意修正格式错误与文字错误
    
    ###问题###
    {{ question }}
    
    ###答案###
    {{ answer }}

    ###解释###
    {{ explanation }}
    
    {{ ctx.output_format }}
  "#
}

class SplitText {
  questions string
  answers string
}

function MatchQuestionsAnswers(input: SplitText) -> QuestionAnswerSlice[] {
  client KimiK2Turbo
  prompt #"
    {{_.role("user")}}
    使用分割点标记匹配以下问题和答案。

    ---指令---
    返回一个JSON数组，其中每个元素是一个包含以下内容的对象：
    - type: 题目类型，必须是 "single" | "multiple" | "share_question" | "share_option" 中的一个
    - question_range: 问题的 [起始索引, 结束索引]
      - 为双侧闭合区间，即包含两端的索引，包含区间两端所指向行数的文本
    - answer: 该题的正确选项字母 (A/B/C/D/E)
      - 单选题："A", "B", 等 (一个字母)
      - 多选题："AB", "ACD", 等 (字母的任意组合)
      - 共用题干题 (share_question)：
        - question_range 必须覆盖整个问题组。这类题目通常有 "A3", "A3型题", "共用题干" 等标识。
        - 用正确的索引显示每个子问题的答案："1.A 2.B 3.C 等"
      - 共用选项题 (share_option)：
        - question_range 必须覆盖整个问题组。这类题目通常有 "B", "B型题", "共用选项" 等标识。
        - 用正确的索引显示每个子问题的答案："1.A 2.B 3.C 等"
      - 确保所有字母都是大写并按字母顺序排列 (例如 "ABD" 而不是 "BAD")
    
    ---示例：共用题干题---
    (78~80题共用题干)男性，62岁。近3个月消瘦、乏力，有上腹胀痛，近1个月出现巩膜及周身黄染，进行性加重，1周前出现大便灰白，尿色深，周身瘙痒，轻度贫血。
    78.病史中哪项对考虑梗阻性黄疸最有意义
    A.贫血 B.尿色深 C.瘙痒
    D.灰白便 E.腹胀痛
    79.以下查体所见哪项对梗阻性黄疸更有意义
    A.体温37.5℃ B.肝肋下2cm C.胆囊大无触痛
    D.有上腹部深压痛 E.肝区有叩痛
    80.B超示：肝内胆管轻度扩张，胆囊8cm×10cm×6cm,胆总管上段直径为1.5cm,胆总管
    中下段因肠积气看不清，胰头3cm×4cm,胰管0.2cm,为了解胆总管中下段情况选哪项检查
    最合适
    A. CT B. PTC C. PTCD
    D. ERCP E.十二指肠低张造影

    ---示例：共用选项题---
    A.良性肿瘤 B.恶性肿瘤 C.潜在恶性肿瘤
    D.瘤样病损 E.转移性骨肿瘤
    72.骨样骨瘤属于
    73.骨巨细胞瘤属于
    74.脊索瘤属于

    ---规则---
    根据问题在分割点数组中的位置匹配问题和答案。
    将答案文本转换为相应的选项字母。
    只返回数组，不要返回其他内容。
    只返回问题和答案都存在的完整题目。
    必须确保问题/选项/答案的内容与输入文本相同。

    ---任务---
    问题（带分割标记）：
    {{ input.questions }}
    
    答案（带分割标记）：
    {{ input.answers }}

    ---输出---
    {{ ctx.output_format }}
  "#
}

function MatchQuestionsAnswersWithExplanation(input: SplitText) -> QuestionAnswerWithExplanationSlice[] {
  client KimiK2Turbo
  prompt #"
    {{_.role("user")}}
    使用分割点标记匹配以下问题和答案。

    ---指令---
    返回一个JSON数组，其中每个元素是一个包含以下内容的对象：
    - type: 题目类型，必须是 "single" | "multiple" | "share_question" | "share_option" 中的一个
    - question_range: 问题的 [起始索引, 结束索引]
      - 为双侧闭合区间，即包含两端的索引，包含区间两端所指向行数的文本
    - answer_range: 解释的 [起始索引, 结束索引]
      - 应当尽可能包括所有内容，包括试题的解析、知识点、讨论等
      - 解析内容包括除题目以外所有的知识相关描述
    - answer: 该题的正确选项字母 (A/B/C/D/E)
      - 单选题："A", "B", 等 (一个字母)
      - 多选题："AB", "ACD", 等 (字母的任意组合)
      - 共用题干题 (share_question)：
        - question_range 必须覆盖整个问题组。这类题目通常有 "A3", "A3型题", "共用题干" 等标识。
        - 用正确的索引显示每个子问题的答案："1.A 2.B 3.C 等"
      - 共用选项题 (share_option)：
        - question_range 必须覆盖整个问题组。这类题目通常有 "B", "B型题", "共用选项" 等标识。
        - 用正确的索引显示每个子问题的答案："1.A 2.B 3.C 等"
      - 确保所有字母都是大写并按字母顺序排列 (例如 "ABD" 而不是 "BAD")

    
    ---示例：共用题干题---
    (78~80题共用题干)男性，62岁。近3个月消瘦、乏力，有上腹胀痛，近1个月出现巩膜及周身黄染，进行性加重，1周前出现大便灰白，尿色深，周身瘙痒，轻度贫血。
    78.病史中哪项对考虑梗阻性黄疸最有意义
    A.贫血 B.尿色深 C.瘙痒
    D.灰白便 E.腹胀痛
    79.以下查体所见哪项对梗阻性黄疸更有意义
    A.体温37.5℃ B.肝肋下2cm C.胆囊大无触痛
    D.有上腹部深压痛 E.肝区有叩痛
    80.B超示：肝内胆管轻度扩张，胆囊8cm×10cm×6cm,胆总管上段直径为1.5cm,胆总管
    中下段因肠积气看不清，胰头3cm×4cm,胰管0.2cm,为了解胆总管中下段情况选哪项检查
    最合适
    A. CT B. PTC C. PTCD
    D. ERCP E.十二指肠低张造影

    ---示例：共用选项题---
    A.良性肿瘤 B.恶性肿瘤 C.潜在恶性肿瘤
    D.瘤样病损 E.转移性骨肿瘤
    72.骨样骨瘤属于
    73.骨巨细胞瘤属于
    74.脊索瘤属于

    ---规则---
    根据问题在分割点数组中的位置匹配问题和答案。
    将答案文本转换为相应的选项字母。
    只返回数组，不要返回其他内容。
    只返回问题和答案都存在的完整题目。
    必须确保问题/选项/答案的内容与输入文本相同。

    ---任务---
    问题（带分割标记）：
    {{ input.questions }}
    
    答案（带分割标记）：
    {{ input.answers }}

    ---输出---
    {{ ctx.output_format }}
  "#
}

