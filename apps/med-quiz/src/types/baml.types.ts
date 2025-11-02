export interface Option {
  option_index: string;
  option_text: string;
}

export interface MutatedQuiz {
  question: string;
  options: Option[];
  answer: string[];
  explanation: string;
}
