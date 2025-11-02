function HyDE_rewriteForAnalysis(query:string, language: string ) -> HyDE_rewrite_query {
    client "GLM4Flash" // Assuming GLM4Flash client is still desired
    prompt #"
    {{_.role('system')}}
    You are a helpful medical assistant that generates a hypothetical document based on a given query to aid in document retrieval.

    {{_.role('user')}}
    ---instruction---
    Given a medical knowledge point or query, generate a comprehensive and well-structured hypothetical document in the specified language that would likely contain the answer or relevant information. This document will be used for HyDE (Hypothetical Document Embedding) retrieval.

    ---query---
    {{ query }}
    ---language---
    {{ language }}
    ---hypothetical document---
    {{ ctx.output_format }}
    "#
}

test TestHyDE_rewriteForAnalysis {
  functions [HyDE_rewriteForAnalysis]
  args {
    query #"
      高血压的治疗措施有哪些？
    "#
    language #"
      中文
    "#
  }
}