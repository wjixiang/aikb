function FilterRelatedChunks(quiz_content: string, documents: RetrievedDocument[]) -> int[] {
    client "GLM4Flash"
    prompt #"
        {{_.role('system')}}
        You are a helpful medical study assistant that filters relevant documents based on a given quiz.

        {{_.role('user')}}
        ---instruction---
        1. Given a medical quiz and a list of documents, analyze the quiz content carefully.
        2. For each document, determine if it is directly relevant to answering or explaining the quiz.
        3. Return a list of the 0-based indices of the documents that are relevant. If no documents are relevant, return an empty list.

        ---quiz---
        {{ quiz_content }}

        ---documents---
        {% for doc in documents %}
        ## Document {{ loop.index }}
        {{ doc.content }}

        {% endfor %}

        ---relevant document indices---
        {{ ctx.output_format }}
    "#
}