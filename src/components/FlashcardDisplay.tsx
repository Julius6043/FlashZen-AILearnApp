
'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';

interface FlashcardDisplayProps {
  question: string;
  answer: string; // This will be empty if not flipped, controlled by parent
  isFlipped: boolean;
  onFlip: () => void;
}

export function FlashcardDisplay({ question, answer, isFlipped, onFlip }: FlashcardDisplayProps) {
  return (
    <div
      className={cn('flashcard w-full h-80 rounded-lg shadow-xl cursor-pointer', isFlipped && 'flipped')}
      onClick={onFlip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onFlip()}
      aria-pressed={isFlipped}
      aria-label={`Flashcard. Question: ${question}. Click to flip.`}
    >
      <div className="flashcard-inner rounded-lg">
        <Card className="flashcard-front bg-card border-2 border-primary/50">
          <CardContent className="h-full">
            <ScrollArea className="h-full">
              <p className="text-lg md:text-xl font-medium">{question}</p>
            </ScrollArea>
          </CardContent>
        </Card>
        <Card className="flashcard-back bg-card border-2 border-accent/50">
          <CardContent className="h-full">
            <ScrollArea className="h-full">
              {/* Answer prop is now pre-conditioned by parent based on isFlipped */}
              <p className="text-base md:text-lg">{answer}</p>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
