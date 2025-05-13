
'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { GenerateTab } from '@/components/GenerateTab';
import { FlashcardsTab } from '@/components/FlashcardsTab';
import { QuizTab } from '@/components/QuizTab';
import type { FlashcardType, QuizQuestionType, ExportedDataType } from '@/types';
import { Wand2, Layers, ClipboardCheck, Icon, Upload, Download, AlertTriangle } from 'lucide-react';
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

type TabValue = 'generate' | 'flashcards' | 'quiz';

interface TabConfig {
  value: TabValue;
  label: string;
  icon: Icon;
  disabled?: (flashcards: FlashcardType[], quizQuestions: QuizQuestionType[]) => boolean;
  component: React.FC<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface PendingAction {
  newFlashcards: FlashcardType[];
  newQuizQuestions?: QuizQuestionType[];
}

export default function HomePage() {
  const [flashcards, setFlashcards] = React.useState<FlashcardType[]>([]);
  const [quizQuestions, setQuizQuestions] = React.useState<QuizQuestionType[]>([]);
  const [activeTab, setActiveTab] = React.useState<TabValue>('generate');
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = React.useState(false);
  const [confirmationDialogContent, setConfirmationDialogContent] = React.useState({ title: '', description: ''});
  const [onConfirmAction, setOnConfirmAction] = React.useState<(() => void) | null>(null);


  const actuallyUpdateFlashcards = (
    newFlashcards: FlashcardType[],
    newQuizQuestions?: QuizQuestionType[]
  ) => {
    setFlashcards(newFlashcards);
    setQuizQuestions(newQuizQuestions || []);
    
    if (newFlashcards.length > 0) {
      setActiveTab('flashcards');
    } else {
      // if generating resulted in empty, or import was empty, stay/go to generate
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
      setOnConfirmAction(() => () => actuallyUpdateFlashcards(newFlashcards, newQuizQuestions));
      setIsConfirmationDialogOpen(true);
    } else {
      actuallyUpdateFlashcards(newFlashcards, newQuizQuestions);
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
      component: () => <FlashcardsTab flashcards={flashcards} />,
    },
    {
      value: 'quiz',
      label: 'Quiz',
      icon: ClipboardCheck,
      disabled: (cards, quizItems) => {
         // Quiz can be generated from AI questions OR from at least 2 flashcards
        if (quizItems.length > 0) return false; // AI questions exist
        return cards.length < 2; // Not enough flashcards for auto-quiz
      },
      component: () => <QuizTab flashcards={flashcards} aiQuizQuestions={quizQuestions} />,
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
        // Toast for success will be shown after confirmation if any, or directly
        if (!(flashcards.length > 0 || quizQuestions.length > 0)) { // if no existing content, toast now
            toast({ title: 'Import Successful', description: 'Flashcards and quiz data loaded.' });
        }

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
              disabled={tab.disabled?.(flashcards, quizQuestions)}
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
        />
        {hasContent ? (
          <Button
            onClick={handleDownload}
            size="lg"
            className="rounded-full shadow-xl p-4 h-auto aspect-square md:aspect-auto md:px-6"
            aria-label="Download data"
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
            <AlertDialogCancel onClick={() => setOnConfirmAction(null)}>Cancel</AlertDialogCancel>
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
