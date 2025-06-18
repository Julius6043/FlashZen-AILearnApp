
'use client';

import * as React from 'react';
import { generateFlashcards } from '@/ai/flows/generate-flashcards';
import { extractTextFromPdf } from '@/ai/flows/extract-text-from-pdf-flow';
import { extractTextFromPdfFallback } from '@/ai/flows/pdf-text-extraction-direct';
import { speechToText } from '@/ai/flows/speech-to-text-flow'; // Import the new flow
import { searchDuckDuckGo } from '@/app/actions/search-actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { FlashcardType, QuizQuestionType, Message } from '@/types';
import { Bot, User, Loader2, Send, FileText, Settings2, AlertTriangle, X, Search, BarChart3, Mic, MicOff, AudioLines } from 'lucide-react'; // Added Mic, MicOff, AudioLines
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PDFViewer } from '@/components/PDFViewer';


interface GenerateTabProps {
  onFlashcardsAndQuizGenerated: (
    flashcards: FlashcardType[],
    quizQuestions?: QuizQuestionType[],
    source?: 'generate' | 'import'
  ) => void;
}

export function GenerateTab({ onFlashcardsAndQuizGenerated }: GenerateTabProps) {
  const [prompt, setPrompt] = React.useState('');
  const [isGeneratingContent, setIsGeneratingContent] = React.useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = React.useState(false);
  const [isSearchingWeb, setIsSearchingWeb] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const { toast } = useToast();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [pdfFile, setPdfFile] = React.useState<File | null>(null); // Represents the file currently selected in the input
  const [extractedPdfText, setExtractedPdfText] = React.useState<string | null>(null); // Text from the successfully processed PDF
  const [pdfFileSourceOfText, setPdfFileSourceOfText] = React.useState<string | null>(null); // Name of the PDF that 'extractedPdfText' came from
  const [pdfDataUri, setPdfDataUri] = React.useState<string | null>(null); // Data URI for PDF viewer
  const [showPdfViewer, setShowPdfViewer] = React.useState(false); // Controls PDF viewer visibility

  const [numFlashcards, setNumFlashcards] = React.useState<number>(10);
  const [numQuizQuestions, setNumQuizQuestions] = React.useState<number>(5);
  const [useDuckDuckGoSearch, setUseDuckDuckGoSearch] = React.useState<boolean>(false);
  const [difficulty, setDifficulty] = React.useState<string>("Medium");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Speech-to-text states
  const [isRecording, setIsRecording] = React.useState(false);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const [hasMicPermission, setHasMicPermission] = React.useState<boolean | null>(null);


  React.useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);
  const clearAllPdfData = () => {
    setPdfFile(null);
    setExtractedPdfText(null);
    setPdfFileSourceOfText(null);
    setPdfDataUri(null);
    setShowPdfViewer(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    const systemMessageClear: Message = {
      id: Date.now().toString() + 'system_pdf_cleared',
      role: 'system',
      content: <p className="font-semibold">PDF selection and extracted text cleared.</p>,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, systemMessageClear]);
  };


  const handlePdfFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileFromInput = event.target.files?.[0];

    if (!fileFromInput) { // User cancelled file selection
      setPdfFile(null); // Clear the file from the input state
      if (fileInputRef.current) fileInputRef.current.value = ''; // Ensure input element is also cleared

      if (pdfFileSourceOfText) { // If a previous PDF was successfully loaded
        const systemMessageKept: Message = {
          id: Date.now().toString() + 'system_pdf_kept_after_cancel',
          role: 'system',
          content: <p className="font-semibold">File selection cancelled. Using previously loaded PDF: {pdfFileSourceOfText}.</p>,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, systemMessageKept]);
      }
      return;
    }

    setPdfFile(fileFromInput); // Set the file in input state immediately

    if (fileFromInput.type !== 'application/pdf') {
      toast({ title: 'Invalid File Type', description: 'Please upload a PDF file.', variant: 'destructive' });
      // Old pdfFileSourceOfText and extractedPdfText remain if they were valid. The invalid file is shown in `pdfFile`.
      return;
    }
    if (fileFromInput.size > 5 * 1024 * 1024) { // 5MB limit
      toast({ title: 'File Too Large', description: 'Please upload a PDF smaller than 5MB.', variant: 'destructive' });
      // Old pdfFileSourceOfText and extractedPdfText remain. The oversized file is shown in `pdfFile`.
      return;
    }

    setIsProcessingPdf(true);
    const systemMessageProcessing: Message = {
      id: Date.now().toString() + 'system_pdf_processing',
      role: 'system',
      content: `Processing PDF: ${fileFromInput.name}...`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, systemMessageProcessing]);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(fileFromInput); reader.onload = async () => {
        const pdfDataUri = reader.result as string;

        // Store the PDF data URI for the viewer
        setPdfDataUri(pdfDataUri);
        setShowPdfViewer(true);

        try { // Outer try: covers the call to extractTextFromPdf and its immediate handling
          const result = await extractTextFromPdf({ pdfDataUri }); if (!result.success || result.error) {
            console.error('Error from extractTextFromPdf flow:', result.error);
            // Try fallback method
            console.log('Attempting fallback PDF extraction method...');
            try {
              const fallbackResult = await extractTextFromPdfFallback(pdfDataUri);

              if (fallbackResult.success && fallbackResult.extractedText && fallbackResult.extractedText.trim() !== "") {
                setExtractedPdfText(fallbackResult.extractedText);
                setPdfFileSourceOfText(fileFromInput.name);

                // Success message with fallback indicator
                const metadata = fallbackResult.metadata;
                const metadataInfo = [];
                if (metadata?.charCount) metadataInfo.push(`${metadata.charCount.toLocaleString()} characters`);
                if (metadata?.wordCount) metadataInfo.push(`${metadata.wordCount.toLocaleString()} words`);
                if (metadata?.pageCount) metadataInfo.push(`${metadata.pageCount} pages`);

                const systemMessageFallbackSuccess: Message = {
                  id: Date.now().toString() + 'system_pdf_fallback_success',
                  role: 'system',
                  content: (
                    <div>
                      <p className="font-semibold text-blue-600 dark:text-blue-400">Successfully extracted text from {fileFromInput.name} (using alternative method).</p>
                      {metadataInfo.length > 0 && (
                        <p className="text-xs text-muted-foreground">{metadataInfo.join(', ')}</p>
                      )}
                      {metadata?.title && (
                        <p className="text-xs text-muted-foreground">Title: {metadata.title}</p>
                      )}
                    </div>
                  ),
                  timestamp: new Date(),
                };
                setMessages(prev => [...prev, systemMessageFallbackSuccess]);
                toast({
                  title: 'PDF Processed (Alternative Method)',
                  description: `Text extracted from ${fileFromInput.name}. ${metadataInfo.join(', ')}`
                });
              } else {
                // Fallback also failed or returned empty content
                if (pdfFileSourceOfText && pdfFileSourceOfText !== fileFromInput.name) {
                  toast({ title: 'PDF Extraction Error', description: `Could not extract text from ${fileFromInput.name}: ${result.error}. Using previous PDF: ${pdfFileSourceOfText}.`, variant: 'destructive' });
                  const systemMessageErrorKept: Message = {
                    id: Date.now().toString() + 'system_pdf_flow_error_kept',
                    role: 'system',
                    content: <p className="font-semibold text-destructive">Error extracting from {fileFromInput.name}. Using previously loaded: {pdfFileSourceOfText}.</p>,
                    timestamp: new Date(),
                  };
                  setMessages(prev => [...prev, systemMessageErrorKept]);
                } else {
                  setExtractedPdfText(null);
                  setPdfFileSourceOfText(null);
                  const errorMsg = fallbackResult.error || result.error || 'Unknown error';
                  toast({ title: 'PDF Extraction Error', description: `Could not extract text from ${fileFromInput.name}: ${errorMsg}`, variant: 'destructive' });
                  const systemMessageError: Message = {
                    id: Date.now().toString() + 'system_pdf_flow_error',
                    role: 'system',
                    content: <p className="font-semibold text-destructive">Error extracting text from {fileFromInput.name}: {errorMsg}</p>,
                    timestamp: new Date(),
                  };
                  setMessages(prev => [...prev, systemMessageError]);
                }
              }
            } catch (fallbackError: any) {
              console.error('Fallback PDF extraction also failed:', fallbackError);
              // Handle fallback failure same as original failure
              if (pdfFileSourceOfText && pdfFileSourceOfText !== fileFromInput.name) {
                toast({ title: 'PDF Extraction Error', description: `Could not extract text from ${fileFromInput.name}: ${result.error}. Using previous PDF: ${pdfFileSourceOfText}.`, variant: 'destructive' });
                const systemMessageErrorKept: Message = {
                  id: Date.now().toString() + 'system_pdf_flow_error_kept',
                  role: 'system',
                  content: <p className="font-semibold text-destructive">Error extracting from {fileFromInput.name}. Using previously loaded: {pdfFileSourceOfText}.</p>,
                  timestamp: new Date(),
                };
                setMessages(prev => [...prev, systemMessageErrorKept]);
              } else {
                setExtractedPdfText(null);
                setPdfFileSourceOfText(null);
                toast({ title: 'PDF Extraction Error', description: `Could not extract text from ${fileFromInput.name}: ${result.error}`, variant: 'destructive' });
                const systemMessageError: Message = {
                  id: Date.now().toString() + 'system_pdf_flow_error',
                  role: 'system',
                  content: <p className="font-semibold text-destructive">Error extracting text from {fileFromInput.name}: {result.error}</p>,
                  timestamp: new Date(),
                };
                setMessages(prev => [...prev, systemMessageError]);
              }
            }
          } else if (result.extractedText && result.extractedText.trim() !== "") {
            setExtractedPdfText(result.extractedText);
            setPdfFileSourceOfText(fileFromInput.name);

            // Enhanced success message with metadata
            const metadata = result.metadata;
            const metadataInfo = [];
            if (metadata?.charCount) metadataInfo.push(`${metadata.charCount.toLocaleString()} characters`);
            if (metadata?.wordCount) metadataInfo.push(`${metadata.wordCount.toLocaleString()} words`);
            if (metadata?.pageCount) metadataInfo.push(`${metadata.pageCount} pages`);

            const systemMessageSuccess: Message = {
              id: Date.now().toString() + 'system_pdf_success',
              role: 'system',
              content: (
                <div>
                  <p className="font-semibold text-green-600 dark:text-green-400">Successfully extracted text from {fileFromInput.name}.</p>
                  {metadataInfo.length > 0 && (
                    <p className="text-xs text-muted-foreground">{metadataInfo.join(', ')}</p>
                  )}
                  {metadata?.title && (
                    <p className="text-xs text-muted-foreground">Title: {metadata.title}</p>
                  )}
                </div>
              ),
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, systemMessageSuccess]);
            toast({
              title: 'PDF Processed',
              description: `Text extracted from ${fileFromInput.name}. ${metadataInfo.join(', ')}`
            });
          } else { // Successfully processed, but no text content (empty string or only whitespace)
            setExtractedPdfText(""); // Set to empty string, not null
            setPdfFileSourceOfText(fileFromInput.name); // Acknowledge this file was processed

            const pageInfo = result.metadata?.pageCount ? ` (${result.metadata.pageCount} pages)` : '';
            toast({ title: 'PDF Processed', description: `No text content found in ${fileFromInput.name}${pageInfo}.`, variant: 'default' });
            const systemMessageEmptyText: Message = {
              id: Date.now().toString() + 'system_pdf_empty_text',
              role: 'system',
              content: <p className="font-semibold text-orange-500 dark:text-orange-400">Successfully processed {fileFromInput.name}${pageInfo}, but no text content was found.</p>,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, systemMessageEmptyText]);
          }
        } catch (extractionProcessError: any) { // Catch for if extractTextFromPdf *itself* throws or network fails
          console.error('Error calling/processing PDF extraction flow:', extractionProcessError);
          // Try fallback method for process errors too
          console.log('Primary PDF extraction failed with process error, attempting fallback...');
          try {
            const fallbackResult = await extractTextFromPdfFallback(pdfDataUri);

            if (fallbackResult.success && fallbackResult.extractedText && fallbackResult.extractedText.trim() !== "") {
              setExtractedPdfText(fallbackResult.extractedText);
              setPdfFileSourceOfText(fileFromInput.name);

              // Success message with fallback indicator
              const metadata = fallbackResult.metadata;
              const metadataInfo = [];
              if (metadata?.charCount) metadataInfo.push(`${metadata.charCount.toLocaleString()} characters`);
              if (metadata?.wordCount) metadataInfo.push(`${metadata.wordCount.toLocaleString()} words`);
              if (metadata?.pageCount) metadataInfo.push(`${metadata.pageCount} pages`);

              const systemMessageFallbackSuccess: Message = {
                id: Date.now().toString() + 'system_pdf_fallback_process_success',
                role: 'system',
                content: (
                  <div>
                    <p className="font-semibold text-blue-600 dark:text-blue-400">Successfully extracted text from {fileFromInput.name} (using alternative method).</p>
                    {metadataInfo.length > 0 && (
                      <p className="text-xs text-muted-foreground">{metadataInfo.join(', ')}</p>
                    )}
                    {metadata?.title && (
                      <p className="text-xs text-muted-foreground">Title: {metadata.title}</p>
                    )}
                  </div>
                ),
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, systemMessageFallbackSuccess]);
              toast({
                title: 'PDF Processed (Alternative Method)',
                description: `Text extracted from ${fileFromInput.name}. ${metadataInfo.join(', ')}`
              });
            } else {
              // Fallback also failed
              if (pdfFileSourceOfText && pdfFileSourceOfText !== fileFromInput.name) {
                toast({ title: 'PDF Processing Error', description: `Could not process ${fileFromInput.name}: ${extractionProcessError.message}. Using previous PDF: ${pdfFileSourceOfText}.`, variant: 'destructive' });
                const systemMessageErrorKept: Message = {
                  id: Date.now().toString() + 'system_pdf_proc_error_kept',
                  role: 'system',
                  content: <p className="font-semibold text-destructive">Error processing {fileFromInput.name}. Using previously loaded: {pdfFileSourceOfText}.</p>,
                  timestamp: new Date(),
                };
                setMessages(prev => [...prev, systemMessageErrorKept]);
              } else {
                setExtractedPdfText(null);
                setPdfFileSourceOfText(null);
                const errorMsg = fallbackResult.error || extractionProcessError.message;
                toast({ title: 'PDF Processing Error', description: `Could not process ${fileFromInput.name}: ${errorMsg}`, variant: 'destructive' });
                const systemMessageError: Message = {
                  id: Date.now().toString() + 'system_pdf_proc_error',
                  role: 'system',
                  content: <p className="font-semibold text-destructive">Error processing {fileFromInput.name}: ${errorMsg}</p>,
                  timestamp: new Date(),
                };
                setMessages(prev => [...prev, systemMessageError]);
              }
            }
          } catch (fallbackProcessError: any) {
            console.error('Fallback PDF extraction also failed for process error:', fallbackProcessError);
            // Handle as original process error
            if (pdfFileSourceOfText && pdfFileSourceOfText !== fileFromInput.name) {
              toast({ title: 'PDF Processing Error', description: `Could not process ${fileFromInput.name}: ${extractionProcessError.message}. Using previous PDF: ${pdfFileSourceOfText}.`, variant: 'destructive' });
              const systemMessageErrorKept: Message = {
                id: Date.now().toString() + 'system_pdf_proc_error_kept',
                role: 'system',
                content: <p className="font-semibold text-destructive">Error processing {fileFromInput.name}. Using previously loaded: {pdfFileSourceOfText}.</p>,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, systemMessageErrorKept]);
            } else {
              setExtractedPdfText(null);
              setPdfFileSourceOfText(null);
              toast({ title: 'PDF Processing Error', description: `Could not process ${fileFromInput.name}: ${extractionProcessError.message}`, variant: 'destructive' });
              const systemMessageError: Message = {
                id: Date.now().toString() + 'system_pdf_proc_error',
                role: 'system',
                content: <p className="font-semibold text-destructive">Error processing {fileFromInput.name}: ${extractionProcessError.message}</p>,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, systemMessageError]);
            }
          }
        } finally {
          setIsProcessingPdf(false);
        }
      }; reader.onerror = () => {
        console.error('Failed to read PDF file.');
        toast({ title: 'File Read Error', description: `Could not read the selected file: ${fileFromInput.name}.`, variant: 'destructive' });
        setIsProcessingPdf(false);
        setPdfDataUri(null);
        setShowPdfViewer(false);
        // pdfFile state still holds fileFromInput. Old pdfFileSourceOfText and extractedPdfText remain if different.
        // If this was the only PDF or same as active, the active context might be stale if not explicitly cleared.
        // For simplicity, if reader fails, we don't alter existing good extractedPdfText from another file.
      };
    } catch (error: any) {
      console.error('Error setting up FileReader for PDF:', error);
      toast({ title: 'PDF Setup Error', description: 'An unexpected error occurred while preparing to read the PDF.', variant: 'destructive' });
      setIsProcessingPdf(false);
      setPdfFile(null);
      setPdfDataUri(null);
      setShowPdfViewer(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentPrompt = prompt.trim();
    // Allow generation if there's a prompt OR if there's extracted PDF text (even if empty string, as long as pdfFileSourceOfText is set)
    if (!currentPrompt && !(pdfFileSourceOfText && extractedPdfText !== null)) {
      toast({ title: 'Error', description: 'Prompt or processed PDF content is required.', variant: 'destructive' });
      return;
    }

    const userMessageContentElements: JSX.Element[] = [];
    if (currentPrompt) {
      userMessageContentElements.push(<span key="prompt-text">{currentPrompt}</span>);
    }
    if (pdfFileSourceOfText) {
      userMessageContentElements.push(<span key="pdf-indicator" className="block text-xs opacity-80 mt-1">Using content from: {pdfFileSourceOfText} {extractedPdfText === "" ? "(no text found)" : ""}</span>);
    }


    userMessageContentElements.push(
      <span key="difficulty-info" className="block text-xs opacity-80 mt-1">
        (Difficulty: {difficulty})
      </span>
    );

    const userMessage: Message = {
      id: Date.now().toString() + 'user',
      role: 'user',
      content: <div>{userMessageContentElements}</div>,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    if (currentPrompt) setPrompt('');

    let duckDuckGoContextData: string | undefined = undefined;
    const effectivePromptForSearch = currentPrompt || pdfFileSourceOfText || "content from PDF";


    if (useDuckDuckGoSearch && effectivePromptForSearch) {
      setIsSearchingWeb(true);
      const searchSystemMessage: Message = {
        id: Date.now().toString() + 'system_search_start',
        role: 'system',
        content: `Searching the web for "${effectivePromptForSearch}"...`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, searchSystemMessage]);

      try {
        const searchResult = await searchDuckDuckGo(effectivePromptForSearch);
        if (searchResult) {
          if (searchResult.startsWith('Error:')) {
            const searchErrorSystemMessage: Message = {
              id: Date.now().toString() + 'system_search_error',
              role: 'system',
              content: <p className="font-semibold text-destructive">{searchResult}</p>,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, searchErrorSystemMessage]);
            toast({ title: 'Web Search Error', description: searchResult, variant: 'destructive' });
          } else {
            duckDuckGoContextData = searchResult;
            const searchSuccessSystemMessage: Message = {
              id: Date.now().toString() + 'system_search_success',
              role: 'system',
              content: (
                <div>
                  <p className="font-semibold text-green-600 dark:text-green-400">Web search context found for "{effectivePromptForSearch}".</p>
                  <ScrollArea className="max-h-32 rounded-md border bg-muted p-2 text-xs mt-1">
                    <pre className="whitespace-pre-wrap break-all">{searchResult}</pre>
                  </ScrollArea>
                </div>
              ),
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, searchSuccessSystemMessage]);
          }
        } else {
          const searchNoResultSystemMessage: Message = {
            id: Date.now().toString() + 'system_search_noresult',
            role: 'system',
            content: <p className="font-semibold">No specific context found from web search for "{effectivePromptForSearch}".</p>,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, searchNoResultSystemMessage]);
        }
      } catch (searchError: any) {
        const searchErrorSystemMessage: Message = {
          id: Date.now().toString() + 'system_search_exception',
          role: 'system',
          content: <p className="font-semibold text-destructive">Web search failed: {searchError.message}</p>,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, searchErrorSystemMessage]);
        toast({ title: 'Web Search Failed', description: searchError.message, variant: 'destructive' });
      } finally {
        setIsSearchingWeb(false);
      }
    }

    setIsGeneratingContent(true);
    try {
      const generationInputPrompt = currentPrompt || (pdfFileSourceOfText ? `Using content from PDF: ${pdfFileSourceOfText}. Focus on its key topics.` : "Generate flashcards on a general topic.");

      const result = await generateFlashcards({
        prompt: generationInputPrompt,
        // Pass pdfText only if it's not null and not an empty string.
        // The AI prompt itself checks for existence of pdfText.
        pdfText: (extractedPdfText && extractedPdfText.trim() !== "" && pdfFileSourceOfText) ? extractedPdfText : undefined,
        duckDuckGoContext: duckDuckGoContextData,
        numFlashcards,
        numQuizQuestions: numQuizQuestions > 0 ? numQuizQuestions : undefined,
        difficulty: difficulty,
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
          parsedFlashcards = rawParsedFc.map((item: any, index: number) => ({
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
      } catch (parseError: any) {
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
            parsedQuizQuestions = rawParsedQuiz.map((item: any, index: number) => ({
              id: item.id || `qz-${Date.now()}-${index}`,
              question: item.question || '',
              options: Array.isArray(item.options) ? item.options : [],
              correctAnswer: item.correctAnswer || '',
            })).filter(qz => qz.question && qz.options.length > 1 && qz.correctAnswer && qz.options.includes(qz.correctAnswer));
          } else {
            throw new Error('Generated quiz data is not an array.');
          }
          if (parsedQuizQuestions && parsedQuizQuestions.length === 0 && result.quizQuestions !== "[]") {
            throw new Error('No valid quiz questions generated from non-empty AI response.');
          }
        } catch (parseError: any) {
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

      onFlashcardsAndQuizGenerated(parsedFlashcards, parsedQuizQuestions, 'generate');

      if (parsedFlashcards.length === 0 && (flashcardParseError || quizParseError)) {
        toast({ title: 'Parsing Error', description: 'Could not fully parse the AI response. Check details in chat.', variant: 'destructive' });
      } else if (parsedFlashcards.length === 0 && !flashcardParseError && !quizParseError && (numFlashcards > 0 || numQuizQuestions > 0)) {
        toast({ title: 'No Content', description: 'AI did not generate valid flashcards or quiz questions.', variant: 'default' });
      }

    } catch (error: any) {
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
      setIsGeneratingContent(false);
    }
  };

  const handleMicClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      // Transcription will happen in onstop
    } else {
      // Request permission and start recording
      try {
        if (hasMicPermission === null) {
          const systemMessagePerm: Message = { id: Date.now().toString() + 'system_mic_perm', role: 'system', content: 'Requesting microphone permission...', timestamp: new Date() };
          setMessages(prev => [...prev, systemMessagePerm]);
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setHasMicPermission(true);

        const systemMessageStart: Message = { id: Date.now().toString() + 'system_mic_start', role: 'system', content: 'Recording started...', timestamp: new Date() };
        setMessages(prev => [...prev, systemMessageStart]);

        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || 'audio/webm' });
          audioChunksRef.current = [];

          if (audioBlob.size === 0) {
            toast({ title: 'Audio Error', description: 'No audio recorded.', variant: 'destructive' });
            const systemMessageNoAudio: Message = { id: Date.now().toString() + 'system_mic_no_audio', role: 'system', content: <p className="font-semibold text-destructive">No audio was recorded.</p>, timestamp: new Date() };
            setMessages(prev => [...prev, systemMessageNoAudio]);
            return;
          }

          setIsTranscribing(true);
          const systemMessageTranscribing: Message = { id: Date.now().toString() + 'system_mic_transcribing', role: 'system', content: 'Transcribing audio...', timestamp: new Date() };
          setMessages(prev => [...prev, systemMessageTranscribing]);

          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const audioDataUri = reader.result as string;
            try {
              const result = await speechToText({ audioDataUri });
              if (result.transcribedText) {
                setPrompt(prev => prev ? `${prev.trim()} ${result.transcribedText}` : result.transcribedText);
                toast({ title: 'Transcription Successful', description: 'Text added to prompt.' });
                const systemMessageSuccess: Message = { id: Date.now().toString() + 'system_mic_success', role: 'system', content: <p className="font-semibold text-green-600 dark:text-green-400">Transcription successful. Text added to prompt.</p>, timestamp: new Date() };
                setMessages(prev => [...prev, systemMessageSuccess]);
              } else {
                toast({ title: 'Transcription Empty', description: 'AI did not return any text.', variant: 'default' });
                const systemMessageEmptyTranscription: Message = { id: Date.now().toString() + 'system_mic_empty_transcription', role: 'system', content: <p className="font-semibold text-orange-500 dark:text-orange-400">Transcription returned no text.</p>, timestamp: new Date() };
                setMessages(prev => [...prev, systemMessageEmptyTranscription]);
              }
            } catch (transcriptionError: any) {
              console.error('Speech-to-text error:', transcriptionError);
              toast({ title: 'Transcription Error', description: transcriptionError.message || 'Could not transcribe audio.', variant: 'destructive' });
              const systemMessageError: Message = { id: Date.now().toString() + 'system_mic_trans_error', role: 'system', content: <p className="font-semibold text-destructive">Error during transcription: {transcriptionError.message}</p>, timestamp: new Date() };
              setMessages(prev => [...prev, systemMessageError]);
            } finally {
              setIsTranscribing(false);
            }
          };
          reader.onerror = () => {
            toast({ title: 'File Read Error', description: 'Could not process recorded audio.', variant: 'destructive' });
            setIsTranscribing(false);
            const systemMessageReadError: Message = { id: Date.now().toString() + 'system_mic_read_error', role: 'system', content: <p className="font-semibold text-destructive">Error processing recorded audio data.</p>, timestamp: new Date() };
            setMessages(prev => [...prev, systemMessageReadError]);
          }
        };
        mediaRecorderRef.current.start();
        setIsRecording(true);

      } catch (error: any) {
        console.error('Error accessing microphone:', error);
        setHasMicPermission(false);
        toast({
          title: 'Microphone Access Denied',
          description: 'Please enable microphone permissions in your browser settings.',
          variant: 'destructive',
        });
        const systemMessageDenied: Message = { id: Date.now().toString() + 'system_mic_denied', role: 'system', content: <p className="font-semibold text-destructive">Microphone permission denied or microphone not found.</p>, timestamp: new Date() };
        setMessages(prev => [...prev, systemMessageDenied]);
      }
    }
  };

  const anyLoading = isProcessingPdf || isSearchingWeb || isGeneratingContent || isTranscribing;
  const micButtonDisabled = anyLoading || (isRecording && isTranscribing);

  const showPdfClearButton = pdfFile || pdfFileSourceOfText;
  let pdfStatusMessageElement = null;
  if (isProcessingPdf && pdfFile) {
    pdfStatusMessageElement = <p className="text-xs text-muted-foreground mt-1 truncate" title={pdfFile.name}>Processing: {pdfFile.name}...</p>;
  } else if (pdfFileSourceOfText) {
    const statusText = extractedPdfText === "" ? `${pdfFileSourceOfText} (no text found)` : pdfFileSourceOfText;
    const statusColor = extractedPdfText === "" ? "text-orange-500 dark:text-orange-400" : "text-green-600 dark:text-green-400";
    pdfStatusMessageElement = (
      <div className="flex items-center justify-between mt-1">
        <p className={cn("text-xs truncate", statusColor)} title={pdfFileSourceOfText}>Using: {statusText}</p>
        {pdfDataUri && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPdfViewer(!showPdfViewer)}
            className="h-5 px-1 text-xs ml-1 shrink-0"
          >
            {showPdfViewer ? 'Hide' : 'Preview'}
          </Button>
        )}
      </div>
    );
  } else if (pdfFile) {
    pdfStatusMessageElement = <p className="text-xs text-orange-500 dark:text-orange-400 mt-1 truncate" title={pdfFile.name}>Selected: {pdfFile.name} (No active PDF text. Try processing or select a valid PDF.)</p>;
  }


  return (
    <div className="flex flex-col h-full max-h-[calc(var(--min-content-height,75vh)+160px)] md:max-h-[calc(var(--min-content-height,70vh)+180px)]">
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
                  : msg.role === 'system' ? 'mx-auto bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-sm'
                    : 'bg-muted'
              )}
            >
              <Avatar className={cn("w-8 h-8", msg.role === 'system' && "hidden sm:flex")}>
                <AvatarFallback>
                  {msg.role === 'user' ? <User size={18} /> :
                    msg.role === 'system' ? <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" /> :
                      <Bot size={18} />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-sm break-words">
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
          {anyLoading && (
            <div className="flex items-start gap-3 p-3 rounded-lg shadow-sm max-w-[90%] bg-muted">
              <Avatar className="w-8 h-8">
                <AvatarFallback><Bot size={18} /></AvatarFallback>
              </Avatar>
              <div className="flex-1 text-sm">
                <p className="font-semibold mb-1">FlashZen AI</p>
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {isProcessingPdf ? 'Processing PDF...' :
                      isSearchingWeb ? 'Searching web...' :
                        isTranscribing ? 'Transcribing audio...' :
                          isGeneratingContent ? 'Generating content...' : 'Loading...'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4 px-1">
        <div className="relative">
          <Label htmlFor="pdf-upload" className="flex items-center gap-2 mb-1 text-sm font-medium">
            <FileText size={16} /> Upload PDF (Optional)
          </Label>
          <Input
            id="pdf-upload"
            type="file"
            accept=".pdf"
            onChange={handlePdfFileChange}
            ref={fileInputRef}
            className="text-sm file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:bg-muted file:text-muted-foreground hover:file:bg-primary/20"
            disabled={anyLoading}
          />
          {showPdfClearButton && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-6 right-0 h-7 w-7"
              onClick={clearAllPdfData}
              disabled={anyLoading}
              aria-label="Clear PDF file"
            >
              <X size={16} />
            </Button>
          )}
          {pdfStatusMessageElement}
        </div>
        <div>
          <Label htmlFor="num-flashcards" className="flex items-center gap-2 mb-1 text-sm font-medium">
            <Settings2 size={16} /> Flashcards
          </Label>
          <Input
            id="num-flashcards"
            type="number"
            value={numFlashcards}
            onChange={(e) => setNumFlashcards(Math.max(0, parseInt(e.target.value, 10) || 0))} // Allow 0 for flashcards too
            min={0}
            max={50}
            className="text-sm"
            disabled={anyLoading}
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
            onChange={(e) => setNumQuizQuestions(Math.max(0, parseInt(e.target.value, 10) || 0))}
            min={0}
            max={25}
            className="text-sm"
            disabled={anyLoading}
          />
          <p className="text-xs text-muted-foreground mt-1">(0 for none)</p>
        </div>
        <div className="flex flex-col justify-center">
          <Label htmlFor="difficulty-select" className="flex items-center gap-2 mb-1 text-sm font-medium">
            <BarChart3 size={16} /> Difficulty
          </Label>
          <Select value={difficulty} onValueChange={setDifficulty} disabled={anyLoading}>
            <SelectTrigger id="difficulty-select" className="text-sm h-10">
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Hard">Hard</SelectItem>
              <SelectItem value="Expert">Expert</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col justify-center">
          <Label htmlFor="use-duckduckgo" className="flex items-center gap-2 mb-1 text-sm font-medium">
            <Search size={16} /> Web Search
          </Label>
          <div className="flex items-center space-x-2 mt-1">
            <Switch
              id="use-duckduckgo"
              checked={useDuckDuckGoSearch}
              onCheckedChange={setUseDuckDuckGoSearch}
              disabled={anyLoading}
            />
            <span className="text-xs text-muted-foreground">Enable DuckDuckGo</span>
          </div>        </div>
      </div>

      {/* PDF Viewer */}
      {showPdfViewer && pdfDataUri && (
        <div className="mb-4 px-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">PDF Preview</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPdfViewer(false)}
              className="h-7 px-2 text-xs"
            >
              Hide Preview
            </Button>
          </div>
          <PDFViewer
            pdfDataUri={pdfDataUri}
            className="w-full"
            maxHeight={300}
            onLoadSuccess={(info) => {
              console.log(`PDF loaded successfully: ${info.numPages} pages`);
            }}
            onLoadError={(error) => {
              console.error('PDF viewer error:', error);
              toast({
                title: 'PDF Viewer Error',
                description: 'Failed to display PDF preview. Text extraction may still work.',
                variant: 'default'
              });
            }}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t pt-4 px-1 items-end">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={pdfFileSourceOfText ? `Add instructions or context for ${pdfFileSourceOfText}...` : "Enter your topic or text here..."}
          className="flex-grow resize-none min-h-[60px] shadow-sm focus-visible:ring-primary"
          rows={2}
          disabled={anyLoading}
          suppressHydrationWarning
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleMicClick}
          disabled={micButtonDisabled}
          className={cn("h-auto p-2.5 aspect-square", isRecording && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording && !isTranscribing && <MicOff className="h-5 w-5" />}
          {!isRecording && !isTranscribing && <Mic className="h-5 w-5" />}
          {isTranscribing && <AudioLines className="h-5 w-5 animate-pulse" />}
        </Button>
        <Button
          type="submit"
          disabled={anyLoading || (!prompt.trim() && !(pdfFileSourceOfText && extractedPdfText !== null))}
          className="h-auto px-4 md:px-6 shadow-md hover:shadow-lg transition-shadow"
        >
          {isGeneratingContent ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          <span className="sr-only">Generate</span>
        </Button>
      </form>
      {hasMicPermission === false && (
        <p className="text-xs text-destructive text-center mt-1">Microphone permission denied. Please enable it in browser settings.</p>
      )}
    </div>
  );
}

