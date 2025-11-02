class Explanation {
  explanation string
}

class RelationshipSummary {
  summary string
}

function SummarizeRelationships(quiz: string, knowledgePoints: string[], chunks: string[]) -> RelationshipSummary {
  client "GLM4Flash"
  prompt #"
  {{_.role('system')}}
  You are a helpful medical assistant that summarizes relationships between a medical quiz, extracted knowledge points, and relevant text chunks.

  {{_.role('user')}}
  ---instruction---
  Given a medical quiz, a list of knowledge points extracted from the quiz, and a list of relevant text chunks, summarize the relationships between these elements. Explain how the knowledge points are related to the quiz and how the chunks support or elaborate on these knowledge points in the context of the quiz.

  ---quiz---
  {{ quiz }}

  ---knowledge points---
  {% for kp in knowledgePoints %}
    - {{ kp }}
  {% endfor %}

  ---relevant chunks---
  {% for chunk in chunks %}
  - {{ chunk }}
  {% endfor %}

  ---summary---
  {{ ctx.output_format }}
  "#
}

function GenerateExplanation(question: string, answer: string, options: string[]) -> Explanation {
  client "GLM4Flash"
  prompt #"
  {{_.role('system')}}
  You are a helpful medical assistant that provides explanations for medical quiz questions.

  {{_.role('user')}}
  ---instruction---
  Given the following medical quiz question, its options, and the correct answer, provide a concise explanation in Chinese for why the answer is correct.

  ---question---
  {{ question }}

  ---options---
  {% for option in options %}
  {{ option }}
  {% endfor %}

  ---answer---
  {{ answer }}

  ---explanation---
  {{ ctx.output_format }}
  "#
}

test TestGenerateExplanation {
  functions [GenerateExplanation]
  args {
    question #"
      A 45-year-old male presents with fatigue, weight gain, and cold intolerance. Lab tests show elevated TSH and low free T4. What is the most likely diagnosis?
    "#
    answer #"
      Hypothyroidism
    "#
    options [
      #"
        Hyperthyroidism
      "#,
      #"
        Hypothyroidism
      "#,
      #"
        Addison's disease
      "#,
      #"
        Cushing's syndrome
      "#
    ]
  }
}
