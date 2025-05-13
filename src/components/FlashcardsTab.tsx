
'use client';

import * as React from 'react';
import type { FlashcardType } from '@/types';
import { Button } from '@/components/ui/button';
import { FlashcardDisplay } from './FlashcardDisplay';
import { ChevronLeft, ChevronRight, RefreshCw, Info, Shuffle as ShuffleIcon, PlusCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FlashcardsTabProps {
  flashcards: FlashcardType[];
  onExpandItems: (type: 'flashcards' | 'quiz', count: number) => Promise<void>;
  isExpanding: boolean;
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function FlashcardsTab({ flashcards: initialFlashcards, onExpandItems, isExpanding }: FlashcardsTabProps) {
  const [displayedFlashcards, setDisplayedFlashcards] = React.useState<FlashcardType[]>(initialFlashcards);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [expandCountInput, setExpandCountInput] = React.useState("5");


  React.useEffect(() => {
    // Only reset displayedFlashcards if the source initialFlashcards identity changes
    // and it's not just an append (which would change identity but we want to keep current view)
    // A more sophisticated check might be needed if appends become very frequent and disruptive
    if (initialFlashcards !== displayedFlashcards && 
        (initialFlashcards.length <= displayedFlashcards.length || 
         !initialFlashcards.some(fc => displayedFlashcards.find(dfc => dfc.id === fc.id)))) {
      setDisplayedFlashcards(initialFlashcards);
      if (initialFlashcards.length > 0 && currentIndex >= initialFlashcards.length) {
        setCurrentIndex(0);
      }
      setIsFlipped(false);
    } else if (initialFlashcards.length > displayedFlashcards.length) {
      // handles appends, update displayedFlashcards
       setDisplayedFlashcards(initialFlashcards);
    }
  }, [initialFlashcards, currentIndex, displayedFlashcards]);


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
   if (!currentCard) { // Should not happen if displayedFlashcards.length > 0
    return (
      <Alert variant="destructive">
        <Info className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Could not load current flashcard. Please try again.
        </AlertDescription>
      </Alert>
    );
  }


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

  const handleExpand = () => {
    const count = parseInt(expandCountInput, 10);
    if (isNaN(count) || count <= 0) {
      alert("Please enter a valid positive number for expansion."); // Basic validation, use toast in real app
      return;
    }
    onExpandItems('flashcards', count);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-md">
        <FlashcardDisplay
          question={currentCard.question}
          answer={isFlipped ? currentCard.answer : ""}
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
          disabled={isExpanding}
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
          disabled={isExpanding}
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
          disabled={isExpanding}
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
            disabled={isExpanding}
          >
            <ShuffleIcon className="h-5 w-5 md:mr-2" />
            <span className="hidden md:inline">Shuffle</span>
          </Button>
        )}
      </div>

      <div className="mt-6 p-4 border-t w-full max-w-md flex flex-col sm:flex-row items-center gap-3">
        <Label htmlFor="expand-flashcards-count" className="text-sm whitespace-nowrap sm:mb-0">Add more:</Label>
        <Input
          id="expand-flashcards-count"
          type="number"
          value={expandCountInput}
          onChange={(e) => setExpandCountInput(e.target.value)}
          min="1"
          max="20" 
          className="h-10 text-sm w-full sm:w-24"
          disabled={isExpanding}
        />
        <Button onClick={handleExpand} disabled={isExpanding} className="w-full sm:w-auto">
          {isExpanding ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <PlusCircle className="h-5 w-5 mr-2" />}
          Expand Flashcards
        </Button>
      </div>
    </div>
  );
}
