'use client';

import * as React from 'react';
import { generateFlashcards } from '@/ai/flows/generate-flashcards';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { FlashcardType, Message } from '@/types';
import { Bot, User, Loader2, Send } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';

interface GenerateTabProps {
  onFlashcardsGenerated: (flashcards: FlashcardType[]) => void;
}

export function GenerateTab({ onFlashcardsGenerated }: GenerateTabProps) {
  const [prompt, setPrompt] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const { toast } = useToast();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      toast({ title: 'Error', description: 'Prompt cannot be empty.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const userMessage: Message = {
      id: Date.now().toString() + 'user',
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setPrompt(''); // Clear input after sending

    try {
      const result = await generateFlashcards({ prompt: userMessage.content as string });
      
      // Attempt to parse the JSON string from the AI
      let parsedFlashcards: FlashcardType[] = [];
      try {
        // The AI might return JSON that sometimes needs a bit of cleaning,
        // e.g. if it's wrapped in markdown code blocks.
        let jsonString = result.flashcards;
        if (jsonString.startsWith('```json')) {
          jsonString = jsonString.substring(7, jsonString.length - 3).trim();
        } else if (jsonString.startsWith('```')) {
          jsonString = jsonString.substring(3, jsonString.length - 3).trim();
        }
        
        const rawParsed = JSON.parse(jsonString);

        // Ensure it's an array and has basic structure
        if (Array.isArray(rawParsed)) {
          parsedFlashcards = rawParsed.map((item: any, index: number) => ({
            id: item.id || `fc-${Date.now()}-${index}`,
            question: item.question || item.front || '',
            answer: item.answer || item.back || '',
          })).filter(fc => fc.question && fc.answer); // Ensure basic validity
        } else {
          throw new Error('Generated data is not an array of flashcards.');
        }

        if (parsedFlashcards.length === 0) {
          throw new Error('No valid flashcards generated. The AI might have returned an empty or malformed list.');
        }

        const aiMessageContent = (
          <div>
            <p className="font-semibold mb-2">Flashcards generated successfully!</p>
            <p className="text-sm text-muted-foreground mb-2">Here's the raw JSON output:</p>
            <ScrollArea className="max-h-60 rounded-md border bg-muted p-2">
              <pre className="text-xs whitespace-pre-wrap break-all">
                {JSON.stringify(parsedFlashcards, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        );
        
        const aiMessage: Message = {
          id: Date.now().toString() + 'ai',
          role: 'assistant',
          content: aiMessageContent,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
        onFlashcardsGenerated(parsedFlashcards);
        toast({ title: 'Success', description: `${parsedFlashcards.length} flashcards generated!` });

      } catch (parseError: any) {
        console.error('Error parsing flashcards JSON:', parseError);
        const errorMessage = `Error processing AI response: ${parseError.message}. Raw AI output: \n${result.flashcards}`;
        const aiErrorMessage: Message = {
          id: Date.now().toString() + 'ai_error',
          role: 'assistant',
          content: (
            <div>
              <p className="font-semibold text-destructive mb-2">Error parsing flashcards!</p>
              <p className="text-sm text-destructive-foreground mb-2">{errorMessage}</p>
              <ScrollArea className="max-h-60 rounded-md border bg-destructive/10 p-2">
                <pre className="text-xs whitespace-pre-wrap break-all text-destructive">
                  {result.flashcards}
                </pre>
              </ScrollArea>
            </div>
          ),
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiErrorMessage]);
        toast({ title: 'Parsing Error', description: 'Could not parse the generated flashcards. Check the format.', variant: 'destructive' });
      }
    } catch (error: any) {
      console.error('Error generating flashcards:', error);
      const errorMessage = error.message || 'An unknown error occurred.';
      const aiErrorMessage: Message = {
        id: Date.now().toString() + 'ai_error',
        role: 'assistant',
        content: (
          <div>
            <p className="font-semibold text-destructive mb-2">Error generating flashcards!</p>
            <p className="text-sm text-destructive-foreground">{errorMessage}</p>
          </div>
        ),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiErrorMessage]);
      toast({ title: 'Generation Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[70vh]">
      <ScrollArea className="flex-grow p-4 rounded-md mb-4" ref={scrollAreaRef}>
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-10">
            <Bot size={48} className="mx-auto mb-4" />
            <p>Enter a topic or paste some text below to generate flashcards.</p>
            <p className="text-sm">For example: "Key concepts of React" or "Spanish vocabulary for travel".</p>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg shadow-sm max-w-[85%]",
                msg.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted'
              )}
            >
              <Avatar className="w-8 h-8">
                <AvatarFallback>
                  {msg.role === 'user' ? <User size={18}/> : <Bot size={18} />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-sm">
                <p className="font-semibold mb-1">
                  {msg.role === 'user' ? 'You' : 'FlashZen AI'}
                </p>
                {typeof msg.content === 'string' ? <p className="whitespace-pre-wrap">{msg.content}</p> : msg.content}
                <p className="text-xs opacity-70 mt-1">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex items-start gap-3 p-3 rounded-lg shadow-sm max-w-[85%] bg-muted">
                <Avatar className="w-8 h-8">
                  <AvatarFallback><Bot size={18} /></AvatarFallback>
                </Avatar>
                <div className="flex-1 text-sm">
                  <p className="font-semibold mb-1">FlashZen AI</p>
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating flashcards...</span>
                  </div>
                </div>
             </div>
          )}
        </div>
      </ScrollArea>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t pt-4">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your topic or text here..."
          className="flex-grow resize-none min-h-[60px] shadow-sm focus-visible:ring-primary"
          rows={3}
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading || !prompt.trim()} className="h-auto px-6 shadow-md hover:shadow-lg transition-shadow">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          <span className="sr-only">Generate</span>
        </Button>
      </form>
    </div>
  );
}
