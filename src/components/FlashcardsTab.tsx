'use client';

import * as React from 'react';
import type { FlashcardType } from '@/types';
import { Button } from '@/components/ui/button';
import { FlashcardDisplay } from './FlashcardDisplay';
import { ChevronLeft, ChevronRight, RefreshCw, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface FlashcardsTabProps {
  flashcards: FlashcardType[];
}

export function FlashcardsTab({ flashcards }: FlashcardsTabProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isFlipped, setIsFlipped] = React.useState(false);

  React.useEffect(() => {
    // Reset to first card and unflipped state if flashcards array changes
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [flashcards]);

  if (flashcards.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No Flashcards</AlertTitle>
        <AlertDescription>
          Generate some flashcards in the "Generate" tab to view them here.
        </AlertDescription>
      </Alert>
    );
  }

  const currentCard = flashcards[currentIndex];

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % flashcards.length);
    setIsFlipped(false);
  };

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + flashcards.length) % flashcards.length);
    setIsFlipped(false);
  };

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-md">
        <FlashcardDisplay
          question={currentCard.question}
          answer={currentCard.answer}
          isFlipped={isFlipped}
          onFlip={handleFlip}
        />
      </div>
      <div className="text-center text-sm text-muted-foreground">
        Card {currentIndex + 1} of {flashcards.length}
      </div>
      <div className="flex justify-center items-center gap-4 w-full">
        <Button
          variant="outline"
          size="lg"
          onClick={handlePrev}
          className="shadow-md hover:shadow-lg transition-shadow"
          aria-label="Previous card"
        >
          <ChevronLeft className="h-5 w-5" />
          Prev
        </Button>
        <Button
          variant="default"
          size="lg"
          onClick={handleFlip}
          className="shadow-md hover:shadow-lg transition-shadow"
          aria-label="Flip card"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Flip
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={handleNext}
          className="shadow-md hover:shadow-lg transition-shadow"
          aria-label="Next card"
        >
          Next
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
