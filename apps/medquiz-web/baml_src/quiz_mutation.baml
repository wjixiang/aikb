class MutatedQuiz {
    question string
    options Option[]
    answer string[] @description(#"
        The correct answer to the quiz.
        This is the index of the correct option in the list of options.
        It must be a aplphabetic character (A, B, C, D, etc.).
        exmaple: 
        - multiple seletion quiz: ["A", "B", "C"]
        - single selection quiz: ["B"]
    "#)
    explanation string @description(#"
        The explanation of the answer.
        This is the text that will be displayed to the user after they answer the quiz.
    "#)
}

class Option {
    index string @description(#"
        The index of the option in the list of options.
        It must be a aplphabetic character (A, B, C, D, etc.).
        This is used to identify the option in the quiz.
    "#)
    content string @description(#"
        The text of the option.
        This is the text that will be displayed to the user.
    "#)
}

function GenerateQuizVarient(origin_quiz:string, related_chunks: string[], similar_quizes: string[]) -> MutatedQuiz {
    client "GLM4Flash"
    prompt #"
    {{_.role('system')}}
    You are a helpful medical education assistant make a variant of a given quiz based on the given information.

    ---instruction---
    The quiz is a single/multiple choice question with 4~5 options.
    You can fuse multiple similar quizes together to create a new quiz.
    You must adjust the question and options strictly based on the given documents, and avoid duplicated with similar quizes.
    You must try best to avoid similarity with the original quiz.

    ---step---
    1. Read the original quiz and the related documents, and the similar quizes.
    2. 通过融合多个相似试题生成新的问题，严谨的替换原有问题
    3. 对原有的干扰选项，重新生成新的选项：结合相关文档与试题，调整原有的干扰选项，使其更具有迷惑性
    4. 对原有的正确选项，保持选项内容不变，仅调整语言表述

    {{_.role('user')}}

    ---origin_quiz---
    {{origin_quiz}}
    
    ---related_chunks---
    {% for chunk in related_chunks %}
    {{ loop.index }}. {{ chunk }}
    {% endfor %}

    ---similar_quizes---
    {% for quiz in similar_quizes %}
    ## similr quiz{{ loop.index }}
    {{ quiz }}
    {% endfor %}

    ---output---
    {{ctx.output_format}}
    "#

}


test TestName {
  functions [GenerateQuizVarient]
  args {
    origin_quiz #"
      hello world
    "#
    related_chunks [
      #"
        hello world
      "#,
      #"
        hello world
      "#
    ]
    similar_quizes [
      #"
        hello world
      "#,
      #"
        hello world
      "#
    ]
  }
}
