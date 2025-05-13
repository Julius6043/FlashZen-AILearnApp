
'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { GenerateTab } from '@/components/GenerateTab';
import { FlashcardsTab } from '@/components/FlashcardsTab';
import { QuizTab } from '@/components/QuizTab';
import type { FlashcardType, QuizQuestionType, ExportedDataType } from '@/types';
import { Wand2, Layers, ClipboardCheck, Icon, Upload, Download, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { generateFlashcards } from '@/ai/flows/generate-flashcards';


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
  const { toast, dismiss: dismissToast } = useToast(); // Destructure dismissToast
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = React.useState(false);
  const [confirmationDialogContent, setConfirmationDialogContent] = React.useState({ title: '', description: ''});
  const [onConfirmAction, setOnConfirmAction] = React.useState<(() => void) | null>(null);
  const [isExpanding, setIsExpanding] = React.useState(false);


  const actuallyUpdateFlashcards = (
    newFlashcards: FlashcardType[],
    newQuizQuestions?: QuizQuestionType[]
  ) => {
    setFlashcards(newFlashcards);
    setQuizQuestions(newQuizQuestions || []);
    
    if (newFlashcards.length > 0) {
      setActiveTab('flashcards');
    } else {
      setActiveTab('generate'); 
    }
  };
  
  const requestFlashcardUpdate = (
    newFlashcards: FlashcardType[],
    newQuizQuestions?: QuizQuestionType[],
    source: 'generate' | 'import' = 'generate'
  ) => {
    if (flashcards.length > 0 || quizQuestions.length > 0) {
      setConfirmationDialogContent({
        title: "Overwrite Existing Content?",
        description: `You have existing flashcards${quizQuestions.length > 0 ? ' and quiz questions' : ''}. ${source === 'generate' ? 'Generating new content' : 'Importing data'} will replace your current set. Are you sure you want to proceed?`
      });
      // Wrap the call to actuallyUpdateFlashcards within another function for setOnConfirmAction
      setOnConfirmAction(() => () => actuallyUpdateFlashcards(newFlashcards, newQuizQuestions));
      setIsConfirmationDialogOpen(true);
    } else {
      actuallyUpdateFlashcards(newFlashcards, newQuizQuestions);
       if (source === 'import') {
         toast({ title: 'Import Successful', description: 'Flashcards and quiz data loaded.' });
       }
    }
  };

  const handleExpandItems = async (
    type: 'flashcards' | 'quiz',
    count: number
  ) => {
    if (count <= 0) {
      toast({ title: 'Invalid Count', description: 'Number of items to expand must be positive.', variant: 'destructive'});
      return;
    }
    setIsExpanding(true);
    const toastId = `expanding-${type}-${Date.now()}`;
    const currentToastInstance = toast({ // Store the toast instance
      id: toastId,
      title: `Expanding ${type}...`,
      description: (
        <div className="flex items-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating {count} new {type}...
        </div>
      ),
      duration: Infinity, // Keep toast until explicitly dismissed
    });

    const promptForExpansion = type === 'flashcards'
      ? `Expand the current flashcards with ${count} new, related items. Ensure they are distinct from the existing ones.`
      : `Expand the current quiz with ${count} new, related multiple-choice questions based on the flashcards and existing quiz items. Ensure they are distinct.`;

    try {
      const result = await generateFlashcards({
        prompt: promptForExpansion,
        existingFlashcardsJson: JSON.stringify(flashcards),
        existingQuizQuestionsJson: quizQuestions.length > 0 ? JSON.stringify(quizQuestions) : undefined,
        numFlashcards: type === 'flashcards' ? count : 0,
        numQuizQuestions: type === 'quiz' ? count : 0,
      });

      let newGeneratedFlashcards: FlashcardType[] = [];
      let newGeneratedQuizQuestions: QuizQuestionType[] = [];
      let parseError = false;

      try {
        if (result.flashcards && result.flashcards !== "[]") {
          const parsedFc = JSON.parse(result.flashcards);
          if (Array.isArray(parsedFc)) {
            newGeneratedFlashcards = parsedFc.map((item: any, index: number) => ({
              id: item.id || `exp-fc-${Date.now()}-${flashcards.length + index}`,
              question: item.question || '',
              answer: item.answer || '',
            })).filter(fc => fc.question && fc.answer);
          } else { throw new Error("Flashcards not an array");}
        }
      } catch (e) {
        console.error("Error parsing expanded flashcards:", e);
        toast({ title: 'Expansion Error', description: 'Failed to parse newly generated flashcards.', variant: 'destructive' });
        parseError = true;
      }

      try {
        if (result.quizQuestions && result.quizQuestions !== "[]") {
          const parsedQz = JSON.parse(result.quizQuestions);
          if (Array.isArray(parsedQz)) {
            newGeneratedQuizQuestions = parsedQz.map((item: any, index: number) => ({
              id: item.id || `exp-qz-${Date.now()}-${quizQuestions.length + index}`,
              question: item.question || '',
              options: Array.isArray(item.options) ? item.options : [],
              correctAnswer: item.correctAnswer || '',
            })).filter(qz => qz.question && qz.options.length > 1 && qz.correctAnswer && qz.options.includes(qz.correctAnswer));
          } else { throw new Error("Quiz questions not an array");}
        }
      } catch (e) {
        console.error("Error parsing expanded quiz questions:", e);
        toast({ title: 'Expansion Error', description: 'Failed to parse newly generated quiz questions.', variant: 'destructive' });
        parseError = true;
      }

      if (!parseError) {
        if (type === 'flashcards' && newGeneratedFlashcards.length > 0) {
          setFlashcards(prev => [...prev, ...newGeneratedFlashcards]);
          currentToastInstance.update({ title: 'Expansion Successful!', description: `${newGeneratedFlashcards.length} new flashcards added.`, duration: 5000 });
        } else if (type === 'quiz' && newGeneratedQuizQuestions.length > 0) {
          setQuizQuestions(prev => [...prev, ...newGeneratedQuizQuestions]);
          currentToastInstance.update({ title: 'Expansion Successful!', description: `${newGeneratedQuizQuestions.length} new quiz questions added.`, duration: 5000 });
        } else {
           currentToastInstance.update({ title: 'Expansion Note', description: `No new ${type} were generated, or the AI returned empty results.`, duration: 5000 });
        }
      } else {
        dismissToast(toastId); // Dismiss loading toast if there was a parse error already handled
      }

    } catch (error: any) {
      console.error(`Error expanding ${type}:`, error);
      currentToastInstance.update({ title: 'Expansion Failed', description: `Could not generate additional ${type}: ${error.message}`, variant: 'destructive', duration: 5000 });
    } finally {
      setIsExpanding(false);
      // Ensure any persistent toast is dismissed if not updated to success/failure
      // The update calls above should handle this, but as a fallback:
      setTimeout(() => dismissToast(toastId), 5100); // Give a bit more time than the update duration
    }
  };


  const tabConfigs: TabConfig[] = [
    {
      value: 'generate',
      label: 'Generate',
      icon: Wand2,
      component: () => <GenerateTab onFlashcardsAndQuizGenerated={requestFlashcardUpdate} />,
    },
    {
      value: 'flashcards',
      label: 'Flashcards',
      icon: Layers,
      disabled: (cards, _quizItems) => cards.length === 0,
      component: () => <FlashcardsTab flashcards={flashcards} onExpandItems={handleExpandItems} isExpanding={isExpanding} />,
    },
    {
      value: 'quiz',
      label: 'Quiz',
      icon: ClipboardCheck,
      disabled: (cards, quizItems) => {
        if (quizItems.length > 0) return false; 
        return cards.length < 2; 
      },
      component: () => <QuizTab flashcards={flashcards} aiQuizQuestions={quizQuestions} onExpandItems={handleExpandItems} isExpanding={isExpanding} />,
    },
  ];

  const hasContent = flashcards.length > 0 || quizQuestions.length > 0;

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json') {
      toast({ title: 'Invalid File Type', description: 'Please upload a JSON file.', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error('Failed to read file content.');
        }
        const parsedData = JSON.parse(text) as ExportedDataType;

        if (!Array.isArray(parsedData.flashcards)) {
          throw new Error('Invalid JSON format: "flashcards" array is missing or not an array.');
        }
        const importedQuizQuestions = Array.isArray(parsedData.quizQuestions) ? parsedData.quizQuestions : [];

        const isValidFlashcards = parsedData.flashcards.every(fc => 
          typeof fc.id === 'string' && typeof fc.question === 'string' && typeof fc.answer === 'string'
        );
        const isValidQuizQuestions = importedQuizQuestions.every(qq => 
          typeof qq.id === 'string' && typeof qq.question === 'string' && Array.isArray(qq.options) && typeof qq.correctAnswer === 'string'
        );

        if (!isValidFlashcards || !isValidQuizQuestions) {
          throw new Error('Invalid data structure within JSON file.');
        }
        
        requestFlashcardUpdate(parsedData.flashcards, importedQuizQuestions, 'import');
        
      } catch (error: any) {
        console.error("Error importing JSON:", error);
        toast({ title: 'Import Error', description: `Failed to parse or validate JSON file: ${error.message}`, variant: 'destructive' });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.onerror = () => {
      toast({ title: 'File Read Error', description: 'Could not read the selected file.', variant: 'destructive' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    if (!hasContent) {
      toast({ title: 'No Content', description: 'There is no data to export.', variant: 'default'});
      return;
    }
    const dataToExport: ExportedDataType = { flashcards, quizQuestions };
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flashzen_export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Export Successful', description: 'Data downloaded as flashzen_export.json'});
  };


  return (
    <div className="flex flex-col items-center w-full">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)} className="w-full max-w-5xl">
        <TabsList className="grid w-full grid-cols-3 mb-6 shadow-sm">
          {tabConfigs.map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              disabled={tab.disabled?.(flashcards, quizQuestions) || isExpanding}
              className="py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200 ease-in-out"
            >
              <tab.icon className="w-5 h-5 mr-2" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabConfigs.map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="rounded-lg border bg-card text-card-foreground shadow-lg p-6 min-h-[calc(var(--min-content-height,60vh)+100px)] md:min-h-[calc(var(--min-content-height,65vh)+100px)]">
            <tab.component />
          </TabsContent>
        ))}
      </Tabs>

      <div className="fixed bottom-6 right-6 z-50">
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
          disabled={isExpanding}
        />
        {hasContent ? (
          <Button
            onClick={handleDownload}
            size="lg"
            className="rounded-full shadow-xl p-4 h-auto aspect-square md:aspect-auto md:px-6"
            aria-label="Download data"
            disabled={isExpanding}
          >
            <Download className="w-6 h-6 md:mr-2" />
            <span className="hidden md:inline">Export</span>
          </Button>
        ) : (
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="lg"
            className="rounded-full shadow-xl p-4 h-auto aspect-square md:aspect-auto md:px-6"
            aria-label="Upload data"
            disabled={isExpanding}
          >
            <Upload className="w-6 h-6 md:mr-2" />
             <span className="hidden md:inline">Import</span>
          </Button>
        )}
      </div>

      <AlertDialog open={isConfirmationDialogOpen} onOpenChange={setIsConfirmationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" /> 
              {confirmationDialogContent.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationDialogContent.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setOnConfirmAction(null); setIsConfirmationDialogOpen(false);}}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (onConfirmAction) {
                  onConfirmAction();
                  toast({ title: 'Content Updated', description: 'Your flashcards and quiz data have been updated.' });
                }
                setOnConfirmAction(null);
                setIsConfirmationDialogOpen(false);
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

