'use client';

import * as React from 'react';
import { generateFlashcards } from '@/ai/flows/generate-flashcards';
import { extractTextFromPdf } from '@/ai/flows/extract-text-from-pdf-flow';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { FlashcardType, QuizQuestionType, Message } from '@/types';
import { Bot, User, Loader2, Send, FileText, Settings2, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from '@/lib/utils';

interface GenerateTabProps {
  onFlashcardsAndQuizGenerated: (flashcards: FlashcardType[], quizQuestions?: QuizQuestionType[]) => void;
}

export function GenerateTab({ onFlashcardsAndQuizGenerated }: GenerateTabProps) {
  const [prompt, setPrompt] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const { toast } = useToast();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  const [pdfFile, setPdfFile] = React.useState<File | null>(null);
  const [extractedPdfText, setExtractedPdfText] = React.useState<string | null>(null);
  const [numFlashcards, setNumFlashcards] = React.useState<number>(10);
  const [numQuizQuestions, setNumQuizQuestions] = React.useState<number>(5);

  React.useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handlePdfFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({ title: 'Invalid File Type', description: 'Please upload a PDF file.', variant: 'destructive' });
        setPdfFile(null);
        setExtractedPdfText(null);
        event.target.value = ''; // Reset file input
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: 'File Too Large', description: 'Please upload a PDF smaller than 5MB.', variant: 'destructive' });
        setPdfFile(null);
        setExtractedPdfText(null);
        event.target.value = ''; // Reset file input
        return;
      }

      setPdfFile(file);
      setIsProcessingPdf(true);
      const systemMessageProcessing: Message = {
        id: Date.now().toString() + 'system_pdf_processing',
        role: 'system',
        content: `Processing PDF: ${file.name}...`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, systemMessageProcessing]);

      try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
          const pdfDataUri = reader.result as string;
          const result = await extractTextFromPdf({ pdfDataUri });
          if (result.extractedText && result.extractedText.trim() !== "") {
            setExtractedPdfText(result.extractedText);
            const systemMessageSuccess: Message = {
              id: Date.now().toString() + 'system_pdf_success',
              role: 'system',
              content: (
                <div>
                  <p className="font-semibold text-green-600">Successfully extracted text from {file.name}.</p>
                  <p className="text-xs text-muted-foreground">Length: {result.extractedText.length} characters.</p>
                </div>
              ),
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, systemMessageSuccess]);
            toast({ title: 'PDF Processed', description: `Text extracted from ${file.name}.` });
          } else {
             setExtractedPdfText(null);
             const systemMessageEmpty: Message = {
              id: Date.now().toString() + 'system_pdf_empty',
              role: 'system',
              content: <p className="font-semibold text-orange-500">Could not extract text or PDF is empty: {file.name}.</p>,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, systemMessageEmpty]);
            toast({ title: 'PDF Processing Issue', description: `No text extracted from ${file.name} or file is empty.`, variant: 'default' });
          }
          setIsProcessingPdf(false);
        };
        reader.onerror = () => {
          throw new Error('Failed to read PDF file.');
        };
      } catch (error: any) {
        console.error('Error processing PDF:', error);
        setExtractedPdfText(null);
        const systemMessageError: Message = {
          id: Date.now().toString() + 'system_pdf_error',
          role: 'system',
          content: <p className="font-semibold text-destructive">Error processing PDF: {error.message}</p>,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, systemMessageError]);
        toast({ title: 'PDF Error', description: `Could not process PDF: ${error.message}`, variant: 'destructive' });
        setIsProcessingPdf(false);
        setPdfFile(null); 
        event.target.value = ''; // Reset file input
      }
    } else {
      setPdfFile(null);
      setExtractedPdfText(null);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !extractedPdfText) {
      toast({ title: 'Error', description: 'Prompt or PDF content cannot be empty.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const userMessageContent = prompt.trim() ? prompt : "Using content from uploaded PDF.";
    const userMessage: Message = {
      id: Date.now().toString() + 'user',
      role: 'user',
      content: userMessageContent,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    if (prompt.trim()) setPrompt('');

    try {
      const result = await generateFlashcards({ 
        prompt: userMessage.content as string,
        pdfText: extractedPdfText ?? undefined,
        numFlashcards,
        numQuizQuestions: numQuizQuestions > 0 ? numQuizQuestions : undefined,
      });
      
      let parsedFlashcards: FlashcardType[] = [];
      let parsedQuizQuestions: QuizQuestionType[] | undefined = undefined;
      let flashcardParseError = null;
      let quizParseError = null;

      try {
        let jsonString = result.flashcards;
        if (jsonString.startsWith('```json')) {
          jsonString = jsonString.substring(7, jsonString.length - 3).trim();
        } else if (jsonString.startsWith('```')) {
          jsonString = jsonString.substring(3, jsonString.length - 3).trim();
        }
        
        const rawParsedFc = JSON.parse(jsonString);
        if (Array.isArray(rawParsedFc)) {
          parsedFlashcards = rawParsedFc.map((item: any, index: number) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            id: item.id || `fc-${Date.now()}-${index}`,
            question: item.question || item.front || '',
            answer: item.answer || item.back || '',
          })).filter(fc => fc.question && fc.answer);
        } else {
          throw new Error('Generated flashcard data is not an array.');
        }
        if (parsedFlashcards.length === 0 && result.flashcards !== "[]") {
           throw new Error('No valid flashcards generated from non-empty AI response.');
        }
      } catch (parseError: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error('Error parsing flashcards JSON:', parseError);
        flashcardParseError = parseError.message;
      }

      if (result.quizQuestions && result.quizQuestions.trim() !== "" && result.quizQuestions.trim() !== "[]") {
        try {
          let quizJsonString = result.quizQuestions;
          if (quizJsonString.startsWith('```json')) {
            quizJsonString = quizJsonString.substring(7, quizJsonString.length - 3).trim();
          } else if (quizJsonString.startsWith('```')) {
            quizJsonString = quizJsonString.substring(3, quizJsonString.length - 3).trim();
          }
          const rawParsedQuiz = JSON.parse(quizJsonString);
          if (Array.isArray(rawParsedQuiz)) {
            parsedQuizQuestions = rawParsedQuiz.map((item: any, index: number) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
              id: item.id || `qz-${Date.now()}-${index}`,
              question: item.question || '',
              options: Array.isArray(item.options) ? item.options : [],
              correctAnswer: item.correctAnswer || '',
            })).filter(qz => qz.question && qz.options.length > 1 && qz.correctAnswer && qz.options.includes(qz.correctAnswer));
          } else {
            throw new Error('Generated quiz data is not an array.');
          }
           if (parsedQuizQuestions.length === 0 && result.quizQuestions !== "[]") {
            throw new Error('No valid quiz questions generated from non-empty AI response.');
          }
        } catch (parseError: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
          console.error('Error parsing quiz questions JSON:', parseError);
          quizParseError = parseError.message;
        }
      }
      
      const aiMessageContentParts: JSX.Element[] = [];
      if (parsedFlashcards.length > 0) {
        aiMessageContentParts.push(
          <div key="fc-preview">
            <p className="font-semibold mb-1">Flashcards generated ({parsedFlashcards.length}):</p>
            <ScrollArea className="max-h-40 rounded-md border bg-muted p-2 text-xs">
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(parsedFlashcards, null, 2)}</pre>
            </ScrollArea>
          </div>
        );
      }
      if (flashcardParseError) {
        aiMessageContentParts.push(
          <div key="fc-error" className="mt-2">
            <p className="font-semibold text-destructive mb-1">Error parsing flashcards!</p>
            <p className="text-xs text-destructive-foreground mb-1">{flashcardParseError}</p>
            <ScrollArea className="max-h-32 rounded-md border bg-destructive/10 p-2 text-xs">
              <pre className="whitespace-pre-wrap break-all text-destructive">{result.flashcards}</pre>
            </ScrollArea>
          </div>
        );
      }

      if (parsedQuizQuestions && parsedQuizQuestions.length > 0) {
         aiMessageContentParts.push(
          <div key="quiz-preview" className="mt-2">
            <p className="font-semibold mb-1">Quiz questions generated ({parsedQuizQuestions.length}):</p>
            <ScrollArea className="max-h-40 rounded-md border bg-muted p-2 text-xs">
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(parsedQuizQuestions, null, 2)}</pre>
            </ScrollArea>
          </div>
        );
      }
       if (quizParseError) {
        aiMessageContentParts.push(
          <div key="quiz-error" className="mt-2">
            <p className="font-semibold text-destructive mb-1">Error parsing quiz questions!</p>
            <p className="text-xs text-destructive-foreground mb-1">{quizParseError}</p>
            <ScrollArea className="max-h-32 rounded-md border bg-destructive/10 p-2 text-xs">
              <pre className="whitespace-pre-wrap break-all text-destructive">{result.quizQuestions || "No quiz data received"}</pre>
            </ScrollArea>
          </div>
        );
      }
      
      if (aiMessageContentParts.length === 0 && !flashcardParseError && !quizParseError) {
         aiMessageContentParts.push(<p key="no-content">AI returned no valid content or empty arrays.</p>);
      }


      const aiMessage: Message = {
        id: Date.now().toString() + 'ai',
        role: 'assistant',
        content: <div>{aiMessageContentParts}</div>,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);

      if (parsedFlashcards.length > 0) {
        onFlashcardsAndQuizGenerated(parsedFlashcards, parsedQuizQuestions);
        toast({ title: 'Success', description: `${parsedFlashcards.length} flashcards generated. ${parsedQuizQuestions ? `${parsedQuizQuestions.length} quiz questions generated.` : ''}` });
      } else if (flashcardParseError || quizParseError) {
         toast({ title: 'Parsing Error', description: 'Could not fully parse the AI response. Check details.', variant: 'destructive' });
      } else {
         toast({ title: 'No Content', description: 'AI did not generate valid flashcards or quiz questions.', variant: 'default' });
      }

    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      console.error('Error generating content:', error);
      const errorMessage = error.message || 'An unknown error occurred.';
      const aiErrorMessage: Message = {
        id: Date.now().toString() + 'ai_error',
        role: 'assistant',
        content: (
          <div>
            <p className="font-semibold text-destructive mb-2">Error generating content!</p>
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
    <div className="flex flex-col h-full max-h-[75vh]">
      <ScrollArea className="flex-grow p-1 md:p-4 rounded-md mb-4" ref={scrollAreaRef}>
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-10">
            <Bot size={48} className="mx-auto mb-4" />
            <p>Enter a topic, paste text, or upload a PDF to generate flashcards and quizzes.</p>
            <p className="text-sm">For example: "Key concepts of React" or "Spanish vocabulary for travel".</p>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg shadow-sm max-w-[90%]",
                msg.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' 
                  : msg.role === 'system' ? 'mx-auto bg-amber-100 text-amber-800 border border-amber-300 text-sm' 
                  : 'bg-muted'
              )}
            >
              <Avatar className={cn("w-8 h-8", msg.role === 'system' && "hidden sm:flex")}>
                <AvatarFallback>
                  {msg.role === 'user' ? <User size={18}/> : 
                   msg.role === 'system' ? <AlertTriangle size={18} className="text-amber-600" /> : 
                   <Bot size={18} />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-sm">
                {msg.role !== 'system' && (
                  <p className="font-semibold mb-1">
                    {msg.role === 'user' ? 'You' : 'FlashZen AI'}
                  </p>
                )}
                {typeof msg.content === 'string' ? <p className="whitespace-pre-wrap">{msg.content}</p> : msg.content}
                <p className="text-xs opacity-70 mt-1">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {(isLoading || isProcessingPdf) && (
             <div className="flex items-start gap-3 p-3 rounded-lg shadow-sm max-w-[90%] bg-muted">
                <Avatar className="w-8 h-8">
                  <AvatarFallback><Bot size={18} /></AvatarFallback>
                </Avatar>
                <div className="flex-1 text-sm">
                  <p className="font-semibold mb-1">FlashZen AI</p>
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{isProcessingPdf ? 'Processing PDF...' : 'Generating content...'}</span>
                  </div>
                </div>
             </div>
          )}
        </div>
      </ScrollArea>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 px-1">
        <div>
          <Label htmlFor="pdf-upload" className="flex items-center gap-2 mb-1 text-sm font-medium">
            <FileText size={16} /> Upload PDF (Optional)
          </Label>
          <Input 
            id="pdf-upload" 
            type="file" 
            accept=".pdf" 
            onChange={handlePdfFileChange} 
            className="text-sm file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:bg-muted file:text-muted-foreground hover:file:bg-primary/20"
            disabled={isLoading || isProcessingPdf}
          />
          {pdfFile && !isProcessingPdf && (
            <p className="text-xs text-muted-foreground mt-1">
              {extractedPdfText ? `Using: ${pdfFile.name}` : `Selected: ${pdfFile.name} (No text or error)`}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="num-flashcards" className="flex items-center gap-2 mb-1 text-sm font-medium">
            <Settings2 size={16} /> Flashcards
          </Label>
          <Input 
            id="num-flashcards" 
            type="number" 
            value={numFlashcards} 
            onChange={(e) => setNumFlashcards(Math.max(1, parseInt(e.target.value,10) || 1))} 
            min={1}
            max={50}
            className="text-sm"
            disabled={isLoading || isProcessingPdf}
          />
        </div>
        <div>
          <Label htmlFor="num-quiz-questions" className="flex items-center gap-2 mb-1 text-sm font-medium">
            <Settings2 size={16} /> Quiz Questions
          </Label>
          <Input 
            id="num-quiz-questions" 
            type="number" 
            value={numQuizQuestions} 
            onChange={(e) => setNumQuizQuestions(Math.max(0, parseInt(e.target.value,10) || 0))} 
            min={0}
            max={25}
            className="text-sm"
            disabled={isLoading || isProcessingPdf}
          />
           <p className="text-xs text-muted-foreground mt-1">(0 for none)</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t pt-4 px-1">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your topic or text here (or use PDF)..."
          className="flex-grow resize-none min-h-[60px] shadow-sm focus-visible:ring-primary"
          rows={2}
          disabled={isLoading || isProcessingPdf}
        />
        <Button 
          type="submit" 
          disabled={isLoading || isProcessingPdf || (!prompt.trim() && !extractedPdfText)} 
          className="h-auto px-4 md:px-6 shadow-md hover:shadow-lg transition-shadow"
        >
          {isLoading || isProcessingPdf ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          <span className="sr-only">Generate</span>
        </Button>
      </form>
    </div>
  );
}
