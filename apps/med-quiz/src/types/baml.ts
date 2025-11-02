// Centralized BAML type definitions
// This file provides type definitions for BAML types that work consistently
// across all build environments, including Docker builds where BAML native
// bindings may not be available.

export interface Task {
  task_name: string;
  task_description: string;
  task_example_user_query: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  required_parameters: string[];
}

export interface ToolResult {
  tool_id: string;
  result: string;
  success: boolean;
  error_message?: string | null;
}

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface TranslationCorrection {
  score: number;
  correction: string;
  suggestions: string;
  grammar_teach: string;
  fullTrans: string;
}

export interface Message {
  role: string;
  content: string;
  timestamp: string;
  tool_calls?: ToolCall[] | null;
  tool_results?: ToolResult[] | null;
}

export interface ToolCall {
  tool_name: string;
  parameters: Record<string, ToolParameter>;
  id: string;
}

export interface AgentDecision {
  should_use_tool: boolean;
  selected_tool?: string | null;
  reasoning: string;
  confidence: number;
}

export interface AgentState {
  conversation_history: Message[];
  available_tools: ToolDefinition[];
  current_context: string;
  step_count: number;
  max_steps: number;
}

export interface CriteriaScore {
  criteria_name: string;
  score: number;
  feedback: string;
  max_score: number;
}

export interface Decision {
  response: string;
  selected_task: string;
}

export interface DocumentEvaluation {
  sufficient: boolean;
  explanation: string;
  missed_knowledge_point: KnowledgePoints[];
}

export interface DocumentToRerank {
  content: string;
  metadata: string;
}

export interface Entity {
  name: string;
  description: string;
  type: string;
}

export interface EssayGrade {
  overall_score: number;
  criteria_scores: CriteriaScore[];
  detailed_feedback: string;
  grammar_corrections: GrammarCorrection[];
  vocabulary_suggestions: VocabularySuggestion[];
  structure_analysis: StructureAnalysis;
  improvement_suggestions: string[];
}

export interface EssaySubmission {
  essay_text?: string | null;
  essay_image?: any; // Image type from BAML
  question_prompt: string;
  grading_criteria: string[];
  user_id: string;
  submission_time: string;
}

export interface Explanation {
  explanation: string;
}

export interface GradingCriteria {
  name: string;
  description: string;
  weight: number;
}

export interface GrammarCorrection {
  original_text: string;
  corrected_text: string;
  explanation: string;
  position_start: number;
  position_end: number;
}

export interface HyDE_query {
  quesiont: string;
  HyDE_content: string;
}

export interface HyDE_rewrite_query {
  HyDE_answer: string;
}

export interface KnowledgePoints {
  knowledgePoint: string;
  description: string;
}

export interface Knowledge_extraction_tool {
  content: string;
  extract_type: string;
  format: string;
}

export interface MutatedQuiz {
  question: string;
  options: Option[];
  answer: string[];
  explanation: string;
}

export interface Option {
  index: string;
  content: string;
}

export interface Quiz_retrieval_tool {
  query: string;
  difficulty_level: string[];
  subject: string[];
  limit: number;
}

export interface Rawquiz_A {
  question: string;
  options: Option[];
  answer: string;
}

export interface Related_documents {
  docIndex: string[];
}

export interface RelationshipSummary {
  summary: string;
}

export interface RetrievedDocument {
  title?: string | null;
  page_num?: string | null;
  content: string;
  metadata: string;
}

export interface StepResponse {
  is_final_step: boolean;
  response: string;
  tool?: ToolCall | null;
  reasoning: string;
}

export interface StructureAnalysis {
  introduction_score: number;
  body_paragraphs_score: number;
  conclusion_score: number;
  coherence_score: number;
  transition_score: number;
}

export interface Textbook_semantic_search_tool {
  search_content: string;
  max_results: number;
  subject_filter: string[];
}

export interface ToolList {
  tools: ToolDefinition[];
}

export interface VocabularySuggestion {
  original_word: string;
  suggested_word: string;
  explanation: string;
  position_start: number;
  position_end: number;
}

// Additional utility types
export interface Checked<T, CheckName extends string = string> {
  value: T;
  checks: Record<CheckName, Check>;
}

export interface Check {
  name: string;
  expr: string;
  status: "succeeded" | "failed";
}

export function all_succeeded<CheckName extends string>(checks: Record<CheckName, Check>): boolean {
  return get_checks(checks).every(check => check.status === "succeeded");
}

export function get_checks<CheckName extends string>(checks: Record<CheckName, Check>): Check[] {
  return Object.values(checks);
}

// Recursively partial type that can be null
export type RecursivePartialNull<T> = T extends object
  ? { [P in keyof T]?: RecursivePartialNull<T[P]> }
  : T | null;