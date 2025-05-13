'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GenerateTab } from '@/components/GenerateTab';
import { FlashcardsTab } from '@/components/FlashcardsTab';
import { QuizTab } from '@/components/QuizTab';
import type { FlashcardType, QuizQuestionType } from '@/types';
import { Wand2, Layers, ClipboardCheck, Icon } from 'lucide-react';

type TabValue = 'generate' | 'flashcards' | 'quiz';

interface TabConfig {
  value: TabValue;
  label: string;
  icon: Icon;
  disabled?: (flashcards: FlashcardType[], quizQuestions: QuizQuestionType[]) => boolean;
  component: React.FC<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export default function HomePage() {
  const [flashcards, setFlashcards] = React.useState<FlashcardType[]>([]);
  const [quizQuestions, setQuizQuestions] = React.useState<QuizQuestionType[]>([]);
  const [activeTab, setActiveTab] = React.useState<TabValue>('generate');

  const handleFlashcardsAndQuizGenerated = (
    newFlashcards: FlashcardType[],
    newQuizQuestions?: QuizQuestionType[]
  ) => {
    setFlashcards(newFlashcards);
    setQuizQuestions(newQuizQuestions || []);
    
    if (newFlashcards.length > 0) {
      setActiveTab('flashcards');
    } else {
      // Fallback to generate if no flashcards were made, e.g. only quiz questions (unlikely)
      // or if an error occurred and lists are empty.
      setActiveTab('generate');
    }
  };

  const tabConfigs: TabConfig[] = [
    {
      value: 'generate',
      label: 'Generate',
      icon: Wand2,
      component: () => <GenerateTab onFlashcardsAndQuizGenerated={handleFlashcardsAndQuizGenerated} />,
    },
    {
      value: 'flashcards',
      label: 'Flashcards',
      icon: Layers,
      disabled: (cards, _quizItems) => cards.length === 0,
      component: () => <FlashcardsTab flashcards={flashcards} />,
    },
    {
      value: 'quiz',
      label: 'Quiz',
      icon: ClipboardCheck,
      // Quiz can be from AI-generated questions OR derived from flashcards
      // Disable if neither source has enough content.
      // Prioritize AI generated quiz questions.
      disabled: (cards, quizItems) => {
        if (quizItems.length > 0) return quizItems.length < 1; // Need at least 1 AI question
        return cards.length < 2; // Fallback: need at least 2 cards for MCQ derivation
      },
      component: () => <QuizTab flashcards={flashcards} aiQuizQuestions={quizQuestions} />,
    },
  ];

  return (
    <div className="flex flex-col items-center w-full">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)} className="w-full max-w-3xl">
        <TabsList className="grid w-full grid-cols-3 mb-6 shadow-sm">
          {tabConfigs.map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              disabled={tab.disabled?.(flashcards, quizQuestions)}
              className="py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200 ease-in-out"
            >
              <tab.icon className="w-5 h-5 mr-2" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabConfigs.map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="rounded-lg border bg-card text-card-foreground shadow-lg p-6 min-h-[400px]">
            <tab.component />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
