/// Extract PICO elements from a research question
function ExtractPICOFromQuestion(research_question: string) -> PICO {
  client DefaultClient
  prompt #"
    {{_.role("system")}}
    You are an expert in evidence-based medicine and systematic reviews.
    Your task is to extract PICO (Population, Intervention, Comparison, Outcome) elements from a research question.
    
    {{_.role("user")}}
    Research Question: {{ research_question }}
    
    Extract and define the PICO elements:
    - Population: The target patient group or population
    - Intervention: The treatment, exposure, or intervention being studied
    - Comparison: The control or comparator
    - Outcome: The outcomes of interest
    
    Provide clear, specific definitions for each element.
    
    {{ ctx.output_format }}
  "#
}
