class EssayGrade {
  overall_score float @description("Overall score from 0-100")
  criteria_scores CriteriaScore[]
  detailed_feedback string
  grammar_corrections GrammarCorrection[]
  vocabulary_suggestions VocabularySuggestion[]
  structure_analysis StructureAnalysis
  improvement_suggestions string[]
}

class CriteriaScore {
  criteria_name string
  score float @description("Score for this criteria from 0-100")
  feedback string
  max_score float
}

class GrammarCorrection {
  original_text string
  corrected_text string
  explanation string
  position_start int
  position_end int
}

class VocabularySuggestion {
  original_word string
  suggested_word string
  explanation string
  position_start int
  position_end int
}

class StructureAnalysis {
  introduction_score float
  body_paragraphs_score float
  conclusion_score float
  coherence_score float
  transition_score float
}

class EssaySubmission {
  essay_text string?
  essay_image image?
  question_prompt string
  grading_criteria string[]
  user_id string
  submission_time string
}

// Grading criteria definitions
class GradingCriteria {
  name string
  description string
  weight float @description("Weight for this criteria in overall score")
}

// Function to grade essay based on text input
function GradeEssayText(essay: EssaySubmission, criteria: GradingCriteria[]) -> EssayGrade {
  client "QWen3"
  prompt #"
  {{_.role('system')}}
  You are an expert English writing instructor with extensive experience in academic essay grading. You provide detailed, constructive feedback to help students improve their writing skills.

  {{_.role('user')}}
  ---TASK---
  Grade the following English essay based on the provided criteria. Be thorough, fair, and provide actionable feedback.

  ---ESSAY QUESTION---
  {{ essay.question_prompt }}

  ---STUDENT ESSAY---
  {{ essay.essay_text }}

  ---GRADING CRITERIA---
  {% for criterion in criteria %}
  - {{ criterion.name }} (Weight: {{ criterion.weight }}%): {{ criterion.description }}
  {% endfor %}

  ---GRADING INSTRUCTIONS---
  1. Provide an overall score from 0-100
  2. Score each criterion separately with detailed feedback
  3. Identify specific grammar errors with corrections
  4. Suggest vocabulary improvements
  5. Analyze essay structure (introduction, body, conclusion)
  6. Provide 3-5 specific improvement suggestions

  ---OUTPUT FORMAT---
  {{ ctx.output_format }}
  "#
}

// Function to grade essay based on image input
function GradeEssayImage(essay: EssaySubmission, criteria: GradingCriteria[]) -> EssayGrade {
  client "QWen3"
  prompt #"
  {{_.role('system')}}
  You are an expert English writing instructor with extensive experience in academic essay grading. You can analyze handwritten or typed essays from images and provide detailed, constructive feedback.

  {{_.role('user')}}
  ---TASK---
  Analyze the essay image and grade it based on the provided criteria. Extract the text accurately and provide comprehensive feedback.

  ---ESSAY QUESTION---
  {{ essay.question_prompt }}

  ---ESSAY IMAGE---
  {{ essay.essay_image }}

  ---GRADING CRITERIA---
  {% for criterion in criteria %}
  - {{ criterion.name }} (Weight: {{ criterion.weight }}%): {{ criterion.description }}
  {% endfor %}

  ---GRADING INSTRUCTIONS---
  1. First, accurately extract all text from the image
  2. Provide an overall score from 0-100
  3. Score each criterion separately with detailed feedback
  4. Identify specific grammar errors with corrections
  5. Suggest vocabulary improvements
  6. Analyze essay structure (introduction, body, conclusion)
  7. Provide 3-5 specific improvement suggestions

  ---OUTPUT FORMAT---
  {{ ctx.output_format }}
  "#
}

// Predefined grading criteria sets
function GetGradingCriteriaSet(criteria_type: string) -> GradingCriteria[] {
  client "GLM4Flash"
  prompt #"
  {{_.role('system')}}
  You are an expert in academic writing assessment. Provide comprehensive grading criteria sets for English essays.

  {{_.role('user')}}
  ---CRITERIA TYPE---
  {{ criteria_type }}

  ---AVAILABLE CRITERIA TYPES---
  - academic: University-level academic essay criteria
  - ielts: IELTS writing task 2 criteria
  - toefl: TOEFL independent writing criteria
  - general: General English writing criteria
  - business: Business English writing criteria

  ---OUTPUT---
  Return a list of 4-6 grading criteria with appropriate weights that sum to 100%. Each should have:
  - name: Clear criterion name
  - description: Detailed description of what this criterion assesses
  - weight: Percentage weight (must sum to 100% across all criteria)

  {{ ctx.output_format }}
  "#
}

test TestGradeEssayText {
  functions [GradeEssayText]
  args {
    essay {
      essay_text "Technology has become an integral part of our daily lives. In my opinion, while technology offers numerous benefits, it also presents significant challenges that we must address. First, technology has greatly improved communication. People can now connect with others across the globe instantly through various platforms. Second, technology has enhanced educational opportunities. Students can access vast amounts of information and learn at their own pace. However, technology also has negative effects. Many people spend excessive time on social media, which can lead to decreased productivity and mental health issues. Additionally, the over-reliance on technology may reduce face-to-face interactions. In conclusion, technology is a double-edged sword that requires balanced usage."
      question_prompt "Discuss the impact of technology on modern society."
      grading_criteria ["academic"]
      user_id "test_user"
      submission_time "2025-07-16T14:30:00Z"
    }
    criteria [
      {
        name "Content and Ideas"
        description "Quality of arguments, depth of analysis, relevance to topic"
        weight 30
      },
      {
        name "Organization and Structure"
        description "Logical flow, paragraph structure, transitions"
        weight 25
      },
      {
        name "Language Use"
        description "Vocabulary range, sentence variety, tone"
        weight 25
      },
      {
        name "Grammar and Mechanics"
        description "Grammar accuracy, punctuation, spelling"
        weight 20
      }
    ]
  }
}

test TestGetGradingCriteriaSet {
  functions [GetGradingCriteriaSet]
  args {
    criteria_type "ielts"
  }
}