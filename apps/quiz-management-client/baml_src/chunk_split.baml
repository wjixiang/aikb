class Chunks {
    question ContentSlice
    answer string[] @description(#"
        the correspondent answer array, e.g. [A, B, C, ABD]
    "#)
}

function SplitPage(parsedQuestionText: string, parsedAnswerText: string,  chunkNum:int) -> Chunks[] {
    client GLM46
    prompt #"
        {{_.role("user")}}
        You need to split a test paper into {{chunkNum}} chunks while maintaining the correspondence between questions and answers.

        **CRITICAL REQUIREMENTS:**
        1. NEVER split an individual question across chunks - each complete question with all its options must stay together
        2. The corresponding answer for each question must be in the SAME chunk as the question
        3. Maintain the original order of questions
        4. Distribute questions as evenly as possible across chunks while respecting the above rules
        5. Each chunk should contain a reasonable number of complete questions (not just 1-2 questions unless the paper is very small)

        ===Questions with line numbers===
        {{parsedQuestionText}}

        ===Answers with line numbers===
        {{parsedAnswerText}}

        ===Instructions===
        Analyze both the questions and answers together to determine optimal split points.
        Return an array of objects with 'start' and 'end' indices for each chunk.
        The indices should be based on the line numbers shown in the questions text.

        Example format:
        If questions 1-4 should be in chunk 1, questions 5-7 in chunk 2, and questions 8-10 in chunk 3:
        [
          {"start": 1, "end": 15},
          {"start": 16, "end": 28},
          {"start": 29, "end": 42}
        ]

        {{ ctx.output_format }}
    "#
}
