
'use client';

import * as React from 'react';
import type { FlashcardType } from '@/types';
import { Button } from '@/components/ui/button';
import { FlashcardDisplay } from './FlashcardDisplay';
import { ChevronLeft, ChevronRight, RefreshCw, Info, Shuffle as ShuffleIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface FlashcardsTabProps {
  flashcards: FlashcardType[];
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function FlashcardsTab({ flashcards: initialFlashcards }: FlashcardsTabProps) {
  const [displayedFlashcards, setDisplayedFlashcards] = React.useState<FlashcardType[]>(initialFlashcards);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isFlipped, setIsFlipped] = React.useState(false);

  React.useEffect(() => {
    setDisplayedFlashcards(initialFlashcards);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [initialFlashcards]);

  if (displayedFlashcards.length === 0) {
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

  const currentCard = displayedFlashcards[currentIndex];

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % displayedFlashcards.length);
    setIsFlipped(false);
  };

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + displayedFlashcards.length) % displayedFlashcards.length);
    setIsFlipped(false);
  };

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleShuffle = () => {
    setDisplayedFlashcards(shuffleArray(displayedFlashcards));
    setCurrentIndex(0);
    setIsFlipped(false);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-md">
        <FlashcardDisplay
          question={currentCard.question}
          answer={isFlipped ? currentCard.answer : ""} // Pass empty answer if not flipped to prevent flicker
          isFlipped={isFlipped}
          onFlip={handleFlip}
        />
      </div>
      <div className="text-center text-sm text-muted-foreground">
        Card {currentIndex + 1} of {displayedFlashcards.length}
      </div>
      <div className="flex flex-wrap justify-center items-center gap-3 md:gap-4 w-full">
        <Button
          variant="outline"
          size="lg"
          onClick={handlePrev}
          className="shadow-md hover:shadow-lg transition-shadow"
          aria-label="Previous card"
        >
          <ChevronLeft className="h-5 w-5 md:mr-2" />
          <span className="hidden md:inline">Prev</span>
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
          <span className="hidden md:inline">Next</span>
          <ChevronRight className="h-5 w-5 md:ml-2" />
        </Button>
         {displayedFlashcards.length > 1 && (
          <Button
            variant="outline"
            size="lg"
            onClick={handleShuffle}
            className="shadow-md hover:shadow-lg transition-shadow"
            aria-label="Shuffle cards"
          >
            <ShuffleIcon className="h-5 w-5 md:mr-2" />
            <span className="hidden md:inline">Shuffle</span>
          </Button>
        )}
      </div>
    </div>
  );
}
