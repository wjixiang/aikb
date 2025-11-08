// Define a class for the input documents to the reranker
class DocumentToRerank {
    content string
    metadata string // Assuming metadata is relevant for reranking
}

// Define the function for reranking
// Returns a list of document indices (as strings) in order of relevance
function RerankDocuments(query: string, documents: DocumentToRerank[]) -> int[] {
    client "GLM4Flash" // Using GLM4Flash as an example client
    prompt #"
    {{_.role('system')}}
    You are a helpful assistant that filters and reranks medical documents based on their relevance to a given medical query.

    {{_.role('user')}}
    ---instruction---
    Given a medical query and a list of medical documents, evaluate the relevance of each document to the query.
    **Identify the documents that are relevant to the query.**
    **Output only the indices of the relevant documents, ordered from most relevant to least relevant.**
    Exclude the indices of any documents that are not relevant.
    The indices correspond to the numbering in the "---documents---" section (e.g., 1, 2, etc.).

    ---query---
    {{ query }}

    ---documents---
    {% for document in documents %}
    ## Document {{ loop.index }}
    {{ document.content }}
    {% endfor %}

    ---relevant document indices (ordered by relevance)---
    {{ ctx.output_format }}
    "#
}

// Add a test case (placeholder)
test TestRerankDocuments {
  functions [RerankDocuments]
  args {
    query #"Sample query for reranking."#
    documents [
      {
        content #"Document content 1 relevant to query"#
        metadata #"Metadata 1"#
      },
      {
        content #"Document content 2 not relevant"#
        metadata #"Metadata 2"#
      },
      {
        content #"Document content 3 also relevant, but less than doc 1"#
        metadata #"Metadata 3"#
      }
    ]
  }
}