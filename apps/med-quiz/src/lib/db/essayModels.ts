import { ObjectId } from "mongodb";

export interface EssayPracticeRecord {
  _id?: ObjectId;
  userId: string;
  questionPrompt: string;
  essayText?: string;
  essayImageUrl?: string;
  gradingCriteria: string[];
  gradeResult: EssayGradeResult;
  submissionTime: Date;
  feedbackRead: boolean;
  savedToFavorites: boolean;
}

export interface EssayGradeResult {
  overallScore: number;
  criteriaScores: CriteriaScore[];
  detailedFeedback: string;
  grammarCorrections: GrammarCorrection[];
  vocabularySuggestions: VocabularySuggestion[];
  structureAnalysis: StructureAnalysis;
  improvementSuggestions: string[];
  gradingTime: Date;
}

export interface CriteriaScore {
  criteriaName: string;
  score: number;
  feedback: string;
  maxScore: number;
}

export interface GrammarCorrection {
  originalText: string;
  correctedText: string;
  explanation: string;
  positionStart: number;
  positionEnd: number;
}

export interface VocabularySuggestion {
  originalWord: string;
  suggestedWord: string;
  explanation: string;
  positionStart: number;
  positionEnd: number;
}

export interface StructureAnalysis {
  introductionScore: number;
  bodyParagraphsScore: number;
  conclusionScore: number;
  coherenceScore: number;
  transitionScore: number;
}

export interface EssayGradingCriteria {
  name: string;
  description: string;
  weight: number;
}

// Predefined grading criteria sets
export const GRADING_CRITERIA_SETS = {
  academic: [
    {
      name: "Content and Ideas",
      description:
        "Quality of arguments, depth of analysis, relevance to topic",
      weight: 30,
    },
    {
      name: "Organization and Structure",
      description: "Logical flow, paragraph structure, transitions",
      weight: 25,
    },
    {
      name: "Language Use",
      description: "Vocabulary range, sentence variety, tone",
      weight: 25,
    },
    {
      name: "Grammar and Mechanics",
      description: "Grammar accuracy, punctuation, spelling",
      weight: 20,
    },
  ],
  ielts: [
    {
      name: "Task Response",
      description: "How well the essay addresses all parts of the task",
      weight: 25,
    },
    {
      name: "Coherence and Cohesion",
      description: "Logical organization and use of cohesive devices",
      weight: 25,
    },
    {
      name: "Lexical Resource",
      description: "Range and accuracy of vocabulary",
      weight: 25,
    },
    {
      name: "Grammatical Range and Accuracy",
      description: "Range and accuracy of grammar",
      weight: 25,
    },
  ],
  toefl: [
    {
      name: "Development",
      description: "Quality of ideas and supporting details",
      weight: 30,
    },
    {
      name: "Organization",
      description: "Logical structure and coherence",
      weight: 25,
    },
    {
      name: "Language Use",
      description: "Vocabulary and sentence structure",
      weight: 25,
    },
    {
      name: "Mechanics",
      description: "Grammar, spelling, and punctuation",
      weight: 20,
    },
  ],
  general: [
    {
      name: "Content Quality",
      description: "Relevance and depth of content",
      weight: 35,
    },
    {
      name: "Structure",
      description: "Clear introduction, body, and conclusion",
      weight: 30,
    },
    {
      name: "Language",
      description: "Appropriate vocabulary and grammar",
      weight: 25,
    },
    { name: "Mechanics", description: "Spelling and punctuation", weight: 10 },
  ],
  business: [
    {
      name: "Professional Content",
      description: "Relevance to business context and clarity of ideas",
      weight: 30,
    },
    {
      name: "Structure and Clarity",
      description: "Logical organization and clear presentation",
      weight: 25,
    },
    {
      name: "Professional Language",
      description: "Appropriate business vocabulary and tone",
      weight: 25,
    },
    {
      name: "Accuracy",
      description: "Grammar, spelling, and punctuation",
      weight: 20,
    },
  ],
};
