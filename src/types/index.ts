export interface FlashcardType {
  id: string;
  question: string;
  answer: string;
}

export interface QuizQuestionType {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  // explanation?: string; // Optional field if AI provides it
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string | JSX.Element;
  timestamp: Date;
}
