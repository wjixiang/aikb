class PICO {
    population string @description(#"
        Describes the target population or patient group for the study
May include: age, gender, disease condition, risk factors, etc.
Example: Adult patients aged 65 and older with type 2 diabetes
    "#)
    intervention string @description(#"
        Refers to the treatment, prevention, diagnostic, or exposure factor being studied or evaluated
Can be: medication, surgery, education, lifestyle changes, etc.
Example: GLP-1 receptor agonist therapy
    "#)
    comparison string @description(#"
        The control condition compared to the intervention
Can be: placebo, standard treatment, different doses, other medications, etc.
Example: Conventional insulin therapy or placebo
    "#)
    outcome string @description(#"
        The outcome measures that the study aims to measure or evaluate
Can be: mortality rate, adverse event incidence, quality of life scores, etc.
Example: Reduction in hemoglobin A1c (HbA1c) levels, percentage of weight loss
    "#)
}
