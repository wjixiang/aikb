// Narrative Review Generation for Medical Literature
// Designed for SCI medical review article generation

// ============ Data Models ============

// Single literature reference with complete citation info
class LiteratureRef {
  doi string  // DOI is REQUIRED - no citation without DOI
  title string
  year int?
  authors string?  // First author et al.
  journal string?
}

// Review section structure
class ReviewSection {
  section_title string
  content string  // Main content - MUST use [DOI] format for citations
  key_findings string[]
  cited_references LiteratureRef[]  // All DOIs used in this section
}

// Complete narrative review
class NarrativeReview {
  title string
  abstract string
  keywords string[]
  sections ReviewSection[]
  conclusions string
  all_references LiteratureRef[]  // Complete reference list for the entire review
  future_directions string?
}

// Section plan for organizing review structure
class ReviewSectionPlan {
  section_title string
  section_focus string
  search_keywords string[]
  expected_content string
}

// Search query generation for semantic literature search
class SearchQuery {
  primary_query string  // Main search query optimized for semantic search
  alternative_queries string[]  // Alternative queries to broaden/refine search
  search_aspects string[]  // Key aspects to focus on in literature
}

function GenerateSearchQuery(
  topic: string,
  section_title: string,
  section_focus: string
) -> SearchQuery {
  client MiniMax
  prompt #"
    You are an expert in medical literature search strategy.
    Generate optimized search queries for semantic literature search.

    Main Topic: {{ topic }}
    Section Title: {{ section_title }}
    Section Focus: {{ section_focus }}

    Requirements:
    1. Create a primary_query that is:
       - Concise (under 50 characters)
       - Focused on key medical concepts
       - Optimized for semantic/vector similarity search
       - Contains essential MeSH-like terms

    2. Create 2-3 alternative_queries that:
       - Use different terminology/synonyms
       - Cover broader or narrower aspects
       - Help capture related literature

    3. List key search_aspects (3-5) that:
       - Represent sub-topics to explore
       - Help evaluate retrieved literature relevance

    Example:
    Topic: "Lumbar Disc Herniation"
    Section: "Treatment"
    Section Focus: "Surgical and conservative treatment approaches"

    Output:
    - primary_query: "lumbar disc herniation surgical discectomy conservative treatment"
    - alternative_queries: [
        "minimally invasive spine surgery disc herniation",
        "lumbar disc herniation outcomes prognosis",
        "disc herniation conservative vs surgical management"
      ]
    - search_aspects: [
        "discectomy techniques and outcomes",
        "conservative treatment efficacy",
        "minimally invasive approaches",
        "recurrence rates and risk factors"
      ]

    {{ ctx.output_format }}
  "#
}

// ============ Functions ============

// Generate a review section based on topic and literature
function GenerateReviewSection(
  topic: string,
  section_title: string,
  section_focus: string,
  relevant_literature: string
) -> ReviewSection {
  client MiniMax
  prompt #"
    You are an expert medical writer specializing in narrative review articles.
    Write a comprehensive review section for a medical journal article.

    Main Topic: {{ topic }}
    Section Title: {{ section_title }}
    Section Focus: {{ section_focus }}

    Relevant Literature - each entry starts with [DOI] in brackets:
    {{ relevant_literature }}

    CRITICAL INSTRUCTIONS - FOLLOW EXACTLY:
    1. COPY the DOI EXACTLY as shown in brackets [10.xxxx/xxxxx]
       - DO NOT make up, modify, or hallucinate any DOI
       - Only use DOIs that appear EXACTLY as provided in the input
    2. When citing in content, use the EXACT same DOI string in brackets
       - Example: if input has [10.3760/cma.j.cn112139-20211122-00548], you MUST cite as [10.3760/cma.j.cn112139-20211122-00548]
    3. In cited_references, copy the DOI field EXACTLY from the relevant_literature input
    4. Synthesize information from multiple sources - DO NOT list papers individually
    5. Integrate findings coherently, comparing and contrasting where appropriate
    6. Highlight research progress, consensus points, and controversies
    7. Use academic language suitable for SCI journal publication
    8. Organize content with subheadings if appropriate
    9. Extract exactly 3-5 key findings that summarize the section

    WRONG (will be penalized):
    - [10.1234/fake-doi]
    - [1], [2], [3] (numeric citations)
    - Making up DOIs

    CORRECT (as provided in input):
    - [10.3760/cma.j.cn112139-20211122-00548]
    - [10.2340/17453674.2025.44251]

    {{ ctx.output_format }}
  "#
}

// Generate structured abstract for the review
function GenerateReviewAbstract(
  topic: string,
  key_findings: string,
  total_studies: int
) -> string {
  client MiniMax
  prompt #"
    Write a structured abstract (250-300 words) for a narrative review article.

    Topic: {{ topic }}
    Total Studies Reviewed: {{ total_studies }}

    Key Findings Summary:
    {{ key_findings }}

    Format requirements:
    - Background: 2-3 sentences on clinical importance
    - Methods: Brief description of literature search scope
    - Results: Main findings organized by theme
    - Conclusions: Clinical implications and future directions

    Use clear, concise academic language.
  "#
}

// Plan review structure based on topic
function PlanReviewStructure(
  topic: string,
  literature_summary: string
) -> ReviewSectionPlan[] {
  client MiniMax
  prompt #"
    Plan the structure for a narrative review article on the following medical topic.

    Topic: {{ topic }}

    Available Literature Summary:
    {{ literature_summary }}

    Create a comprehensive review structure with 5-7 main sections.
    Each section should have:
    - Clear title
    - Specific focus area
    - Keywords for literature search
    - Expected content description

    Typical sections for medical reviews include:
    - Introduction/Background
    - Epidemiology
    - Pathophysiology
    - Clinical Presentation/Diagnosis
    - Treatment/Management
    - Prognosis/Outcomes
    - Future Directions

    Adapt sections based on the specific topic and available literature.

    {{ ctx.output_format }}
  "#
}

// Generate conclusions section
function GenerateConclusions(
  topic: string,
  section_summaries: string
) -> string {
  client MiniMax
  prompt #"
    Write the Conclusions section for a narrative review on: {{ topic }}

    Summary of Key Points from Each Section:
    {{ section_summaries }}

    Requirements:
    1. Summarize main takeaways (3-5 points)
    2. Discuss clinical implications
    3. Identify remaining gaps in knowledge
    4. Suggest future research directions
    5. Keep to 300-400 words

    Use clear, impactful language suitable for medical professionals.
  "#
}

// Generate future directions section
function GenerateFutureDirections(
  topic: string,
  current_limitations: string,
  emerging_trends: string
) -> string {
  client MiniMax
  prompt #"
    Write a Future Directions section for a narrative review on: {{ topic }}

    Current Limitations in the Field:
    {{ current_limitations }}

    Emerging Trends and Technologies:
    {{ emerging_trends }}

    Requirements:
    1. Identify 3-5 promising research directions
    2. Discuss potential clinical applications
    3. Consider technological advances
    4. Keep to 200-300 words

    Be forward-looking but evidence-based.
  "#
}

// ============ Tests ============

test test_generate_section {
  functions [GenerateReviewSection]
  args {
    topic #"
      Lumbar Disc Herniation
    "#
    section_title #"
      Diagnosis and Imaging
    "#
    section_focus #"
      Current diagnostic approaches including clinical examination and imaging modalities
    "#
    relevant_literature #"
      1. Title: MRI findings in lumbar disc herniation
         DOI: 10.1234/mri2023
         Abstract: This study evaluated MRI findings in 500 patients...

      2. Title: Clinical examination vs imaging
         DOI: 10.5678/clinical2022
         Abstract: Comparison of clinical examination accuracy with MRI...
    "#
  }
}

test test_plan_structure {
  functions [PlanReviewStructure]
  args {
    topic #"
      Lumbar Disc Herniation: A Comprehensive Review
    "#
    literature_summary #"
      980 articles covering epidemiology, pathophysiology, diagnosis, treatment, and prognosis.
      Key themes include surgical vs conservative treatment, imaging advances, and risk factors.
    "#
  }
}
