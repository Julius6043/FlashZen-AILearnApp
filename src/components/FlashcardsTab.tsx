
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
  // displayedFlashcards is the list this component works with (can be a shuffled version of initialFlashcards)
  const [displayedFlashcards, setDisplayedFlashcards] = React.useState<FlashcardType[]>(initialFlashcards);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [expandCountInput, setExpandCountInput] = React.useState("5");

  React.useEffect(() => {
    // When initialFlashcards (prop) changes, reset our internal displayedFlashcards.
    // This means any shuffle is lost, and the user can re-shuffle the new/updated list.
    // This handles new generations, imports, and expansions correctly.
    setDisplayedFlashcards(initialFlashcards);
    if (initialFlashcards.length > 0) {
        // If current index is out of bounds for the new list, reset to 0
        setCurrentIndex(prevIndex => Math.min(prevIndex, initialFlashcards.length - 1));
        if (currentIndex >= initialFlashcards.length) { // Reset if out of bounds specifically
             setCurrentIndex(0);
        }
    } else {
        setCurrentIndex(0); // No cards, index must be 0
    }
    setIsFlipped(false); // Reset flip state for new card or new list
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
   if (!currentCard) {
    // This case should ideally not be reached if displayedFlashcards.length > 0 and currentIndex is managed.
    // But as a fallback:
    return (
      <Alert variant="destructive">
        <Info className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Could not load current flashcard. Please try restarting or generating new cards.
        </AlertDescription>
      </Alert>
    );
  }


  const handleNext = () => {
    setIsFlipped(false); // Unflip before changing card
    setCurrentIndex((prevIndex) => (prevIndex + 1) % displayedFlashcards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false); // Unflip before changing card
    setCurrentIndex((prevIndex) => (prevIndex - 1 + displayedFlashcards.length) % displayedFlashcards.length);
  };

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleShuffle = () => {
    setDisplayedFlashcards(currentCards => shuffleArray([...currentCards]));
    setCurrentIndex(0);
    setIsFlipped(false);
  }

  const handleExpand = () => {
    const count = parseInt(expandCountInput, 10);
    if (isNaN(count) || count <= 0) {
      // Consider using toast for errors
      alert("Please enter a valid positive number for expansion.");
      return;
    }
    onExpandItems('flashcards', count);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center justify-center gap-1 md:gap-2 w-full max-w-xl px-2 sm:px-0">
        {displayedFlashcards.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            className="rounded-full shadow-md hover:shadow-lg transition-shadow bg-card/70 hover:bg-card p-2 disabled:opacity-30"
            aria-label="Previous card"
            disabled={isExpanding || displayedFlashcards.length <= 1}
          >
            <ChevronLeft className="h-7 w-7" />
          </Button>
        )}
        <div className="w-full max-w-md flex-grow"> {/* Flashcard container takes up space */}
          <FlashcardDisplay
            question={currentCard.question}
            answer={currentCard.answer} // Pass full answer
            isFlipped={isFlipped}
            onFlip={handleFlip}
          />
        </div>
        {displayedFlashcards.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            className="rounded-full shadow-md hover:shadow-lg transition-shadow bg-card/70 hover:bg-card p-2 disabled:opacity-30"
            aria-label="Next card"
            disabled={isExpanding || displayedFlashcards.length <= 1}
          >
            <ChevronRight className="h-7 w-7" />
          </Button>
        )}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        Card {currentIndex + 1} of {displayedFlashcards.length}
      </div>

      <div className="flex flex-wrap justify-center items-center gap-3 md:gap-4 w-full">
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
             <span className="md:hidden">Shuffle</span>
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
