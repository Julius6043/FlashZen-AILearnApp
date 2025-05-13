export interface FlashcardType {
  id: string;
  question: string;
  answer: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string | JSX.Element;
  timestamp: Date;
}
