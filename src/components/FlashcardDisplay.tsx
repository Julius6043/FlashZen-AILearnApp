
'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Loader2, Volume2, PauseCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { textToSpeech } from '@/ai/flows/text-to-speech-flow';

interface FlashcardDisplayProps {
  question: string;
  answer: string;
  isFlipped: boolean;
  onFlip: () => void;
}

export function FlashcardDisplay({ question, answer, isFlipped, onFlip }: FlashcardDisplayProps) {
  const [audioState, setAudioState] = React.useState<{ status: 'idle' | 'loading' | 'playing'; side: 'question' | 'answer' | null }>({ status: 'idle', side: null });
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const handleAudioButtonClick = async (event: React.MouseEvent, text: string, side: 'question' | 'answer') => {
    event.stopPropagation(); // Prevent card flip

    // Clear any existing audio element and its event listeners
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.src = ''; // Detach source
      audioRef.current = null;
    }

    if (audioState.status === 'playing' && audioState.side === side) {
      setAudioState({ status: 'idle', side: null });
      return;
    }
    
    if (audioState.status === 'loading' && audioState.side === side) {
      // If already loading this side, do nothing or cancel? For now, do nothing.
      return;
    }

    setAudioState({ status: 'loading', side });
    try {
      const result = await textToSpeech({ textToSpeak: text });
      if (result.audioDataUri) {
        const audio = new Audio(result.audioDataUri);
        audioRef.current = audio; // Assign current audio element

        audio.play().then(() => {
            setAudioState({ status: 'playing', side });
        }).catch(playError => {
            console.error('Audio play() failed:', playError);
            toast({ title: 'Audio Error', description: 'Could not start audio playback.', variant: 'destructive' });
            setAudioState({ status: 'idle', side: null });
            if (audioRef.current === audio) audioRef.current = null;
        });

        audio.onended = () => {
          if (audioRef.current === audio) { // Ensure it's the same audio instance
            setAudioState({ status: 'idle', side: null });
            audioRef.current = null;
          }
        };
        audio.onerror = (e) => {
          if (audioRef.current === audio) { // Ensure it's the same audio instance
            console.error('Audio playback error:', e);
            toast({ title: 'Audio Error', description: 'Could not play audio.', variant: 'destructive' });
            setAudioState({ status: 'idle', side: null });
            audioRef.current = null;
          }
        };
      } else {
        toast({ title: 'Audio Error', description: 'Failed to generate audio data.', variant: 'destructive' });
        setAudioState({ status: 'idle', side: null });
      }
    } catch (error: any) {
      console.error('Text-to-speech error:', error);
      toast({ title: 'Text-to-Speech Error', description: error.message || 'Could not generate audio.', variant: 'destructive' });
      setAudioState({ status: 'idle', side: null }); // Reset state on error
    }
  };
  
  // Cleanup audio on component unmount or when card flips (which might hide the active button)
  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current = null;
      }
    };
  }, []);

  // When card flips, stop any ongoing audio.
   React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setAudioState({ status: 'idle', side: null });
      // No need to nullify audioRef.current here as the useEffect cleanup will handle it,
      // or a new play action will.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlipped]);


  const renderAudioButton = (text: string, side: 'question' | 'answer') => {
    let icon;
    let label = `Play ${side} audio`;

    if (audioState.status === 'loading' && audioState.side === side) {
      icon = <Loader2 className="h-5 w-5 animate-spin" />;
      label = `Loading ${side} audio...`;
    } else if (audioState.status === 'playing' && audioState.side === side) {
      icon = <PauseCircle className="h-5 w-5" />;
      label = `Stop ${side} audio`;
    } else {
      icon = <Volume2 className="h-5 w-5" />;
    }

    return (
      <Button
        variant="ghost"
        size="icon"
        className="absolute bottom-2 right-2 z-10 rounded-full bg-card/70 hover:bg-card focus-visible:ring-1 focus-visible:ring-ring"
        onClick={(e) => handleAudioButtonClick(e, text, side)}
        disabled={audioState.status === 'loading' && audioState.side !== side} // Disable if other side is loading
        aria-label={label}
      >
        {icon}
      </Button>
    );
  };

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
        <Card className="flashcard-front bg-card border-2 border-primary/50 relative">
          <CardContent className="h-full">
            {/* Adjust max height to make space for the button if content is long */}
            <ScrollArea className="h-full max-h-[calc(100%-0.5rem)] pr-2"> 
              <p className="text-lg md:text-xl font-medium">{question}</p>
            </ScrollArea>
          </CardContent>
          {renderAudioButton(question, 'question')}
        </Card>
        <Card className="flashcard-back bg-card border-2 border-accent/50 relative">
          <CardContent className="h-full">
             {/* Adjust max height to make space for the button if content is long */}
            <ScrollArea className="h-full max-h-[calc(100%-0.5rem)] pr-2">
              {isFlipped && <p className="text-base md:text-lg">{answer}</p>}
            </ScrollArea>
          </CardContent>
          {isFlipped && renderAudioButton(answer, 'answer')}
        </Card>
      </div>
    </div>
  );
}
