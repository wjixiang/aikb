class RetrievedDocument {
  title string?
  page_num string?
  content string
  metadata string // Assuming metadata is a string, adjust if needed
}

function GenerateAnswer(history: string[]?, query: string, documents: RetrievedDocument[], language: string) -> string {
  client QWen3 // Using GLM4Flash as an example client /OpenrouterQWEN3/GLM4Flash
  prompt #"
  {{_.role('system')}}
  You are a helpful assistant that answers questions in "{{language}}" language based on the provided documents.

  {{_.role('user')}}
  ---instruction---
  Answer the following question based on the provided documents.
  If the documents do not contain enough information to answer the question, say "I don't have enough information to answer this question based on the provided documents."
  If the documents contain conflicting information, say "The documents contain conflicting information."
  If the documents contain information that is not relevant to the question, ignore that information.
  Summarize the relevant information from the documents to answer the question. Make full use of the information in the documents.
  Provide a clear and concise answer to the question. Prefer to use table/list format if applicable.
  Annotate the answer with the document index at the format given below to support your answer.
  When book title and page number are available in the document, you SHOULD include them.
  Meanwhile, use the standard [ref:<index>] format
  

  ---example---
    # query
    What is the capital of France?

    # documents
    [ref:1] 
    France is a country located in Western Europe. Its capital city is Paris, which is also the most populous city in the country.

    [ref:2]
    The Eiffel Tower, one of the most famous landmarks in the world, is located in Paris.

    [ref:3]
    Paris is known for its art, fashion, and culture. It is home to the Louvre Museum, which is the world's largest art museum.

    # answer
    Paris is the capital of France [ref:1]

  ---REAL CONTENT---
    # History
    {% for record in history %}
    - {{record}} 
    {% endfor %}

    # Current Query
    {{ query }}

    # Documents
    {% for document in documents %}
    ###################
    ### [ref:{{ loop.index }}] 【{{document.title}}|page {{document.page_num}}】###
    ###################
    {{ document.content }}


    ---


    {% endfor %}

    # answer
    {{ ctx.output_format }}
  "#
}



test TestBaselineRAGGeneration {
  functions [GenerateAnswer]
  args {
    query #"
      hello world
    "#
    language #"
      hello world
    "#
    documents []
  }
}
