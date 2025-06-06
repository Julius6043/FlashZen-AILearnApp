
'use client';

import * as React from 'react';
import type { FlashcardType, QuizQuestionType as AIQuizQuestionType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Info, Lightbulb, RotateCcw, Settings, PlusCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuizTabProps {
  flashcards: FlashcardType[];
  aiQuizQuestions: AIQuizQuestionType[];
  onExpandItems: (type: 'flashcards' | 'quiz', count: number) => Promise<void>;
  isExpanding: boolean;
}

interface QuizDisplayQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function QuizTab({ flashcards, aiQuizQuestions, onExpandItems, isExpanding }: QuizTabProps) {
  const [quizDisplayQuestions, setQuizDisplayQuestions] = React.useState<QuizDisplayQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [selectedAnswer, setSelectedAnswer] = React.useState<string | null>(null);
  const [isAnswered, setIsAnswered] = React.useState(false);
  const [score, setScore] = React.useState(0);
  const [quizCompleted, setQuizCompleted] = React.useState(false);
  const [isLoadingQuiz, setIsLoadingQuiz] = React.useState(true);

  const [numAutoQuizQuestionsInput, setNumAutoQuizQuestionsInput] = React.useState("5");
  const [quizMode, setQuizMode] = React.useState<'ai_direct' | 'auto_config' | 'auto_active' | 'empty'>('empty');
  const [expandQuizCountInput, setExpandQuizCountInput] = React.useState("5");

  const initializeQuiz = React.useCallback(() => {
    setIsLoadingQuiz(true);
    let initialQuestions: QuizDisplayQuestion[] = [];
    let newQuizMode: typeof quizMode = 'empty';

    if (aiQuizQuestions && aiQuizQuestions.length > 0) {
      initialQuestions = aiQuizQuestions.map(q => ({ ...q, options: shuffleArray(q.options) }));
      newQuizMode = 'ai_direct';
    } else if (flashcards.length >= 2) {
      newQuizMode = 'auto_config'; // User needs to configure and start
    }
    
    setQuizDisplayQuestions(initialQuestions);
    setQuizMode(newQuizMode);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setQuizCompleted(false);
    setIsLoadingQuiz(false);
  }, [aiQuizQuestions, flashcards]);

  React.useEffect(() => {
    initializeQuiz();
  }, [initializeQuiz]);
  
  // Effect to update quizDisplayQuestions when aiQuizQuestions prop changes (e.g., after expansion)
  // This handles external updates to the AI-provided questions
  React.useEffect(() => {
    if (quizMode === 'ai_direct') {
        // If new questions were added to aiQuizQuestions (expansion)
        if (aiQuizQuestions.length > quizDisplayQuestions.length) {
            const newQuestions = aiQuizQuestions.filter(aiQ => !quizDisplayQuestions.some(dq => dq.id === aiQ.id));
            setQuizDisplayQuestions(prev => [...prev, ...newQuestions.map(q => ({...q, options: shuffleArray(q.options)}))]);
        } else if (aiQuizQuestions.length < quizDisplayQuestions.length && aiQuizQuestions.length === 0) {
            // If all AI questions were cleared, re-initialize
            initializeQuiz();
        } else if (aiQuizQuestions.length > 0 && quizDisplayQuestions.length === 0 ) {
           // If we had no questions and now we do (e.g. initial load was empty, now populated by generate)
           initializeQuiz();
        }
    }
  }, [aiQuizQuestions, quizMode, quizDisplayQuestions.length, initializeQuiz]);


  const handleStartAutoQuiz = () => {
    const num = parseInt(numAutoQuizQuestionsInput, 10);
    if (isNaN(num) || num < 1 || num > flashcards.length) {
      alert(`Please enter a number between 1 and ${flashcards.length}.`);
      return;
    }
    const autoGenerated = generateAutoQuiz(num);
    if (autoGenerated.length === 0) {
        alert("Could not generate quiz questions from flashcards. Ensure you have enough distinct flashcards.");
        setQuizMode('auto_config'); // Stay in config
        return;
    }
    setQuizDisplayQuestions(shuffleArray(autoGenerated));
    setQuizMode('auto_active');
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setQuizCompleted(false);
  };
  
  const generateAutoQuiz = (numQuestions: number): QuizDisplayQuestion[] => {
    if (flashcards.length < 2) return []; // Need at least 2 cards for options
    const questionsToGenerate = Math.min(numQuestions, flashcards.length);
    const shuffledFlashcards = shuffleArray([...flashcards]); // Use a copy
    
    return shuffledFlashcards.slice(0, questionsToGenerate).map((card, idx) => {
      const otherAnswers = flashcards
        .filter(fc => fc.id !== card.id)
        .map(fc => fc.answer);
      
      let incorrectOptions = shuffleArray(otherAnswers).slice(0, 3); // Max 3 incorrect options

      // Ensure enough unique incorrect options, or fill with placeholders/variations if necessary
      const potentialOptions = [...new Set(otherAnswers)];
      let currentOptionIndex = 0;
      while (incorrectOptions.length < 3 && potentialOptions.length > 0) {
        const nextOption = potentialOptions[currentOptionIndex % potentialOptions.length];
        if (!incorrectOptions.includes(nextOption) && nextOption !== card.answer) {
          incorrectOptions.push(nextOption);
        }
        currentOptionIndex++;
        if (currentOptionIndex > potentialOptions.length * 2 && incorrectOptions.length <3) break; // Avoid infinite loop
      }
      // If still not enough, create variations or simple placeholders
      let placeholderCounter = 1;
      while (incorrectOptions.length < 3) {
        incorrectOptions.push(`Option ${placeholderCounter++} for Q${idx + 1}`);
      }

      const finalOptions = shuffleArray([...new Set([card.answer, ...incorrectOptions.slice(0,3)])]);
      
      return {
        id: card.id + `_quiz_${idx}`, // Make quiz ID unique from flashcard ID
        question: card.question,
        options: finalOptions.length > 1 ? finalOptions : [card.answer, "Incorrect Option 1", "Incorrect Option 2", "Incorrect Option 3"], // Ensure at least some options
        correctAnswer: card.answer,
      };
    }).filter(q => q.options.includes(q.correctAnswer)); // Final check
  };


  if (isLoadingQuiz) {
    return <div className="text-center p-10">Preparing your quiz... <Lightbulb className="inline h-5 w-5 animate-pulse" /></div>;
  }
  
  if (quizMode === 'empty') {
    return (
     <Alert>
       <Info className="h-4 w-4" />
       <AlertTitle>Not Enough Content for Quiz</AlertTitle>
       <AlertDescription>
         You need at least 2 flashcards to start a multiple-choice quiz if no AI questions are provided. Generate more flashcards or ensure AI generates quiz questions.
       </AlertDescription>
     </Alert>
   );
 }

  if (quizMode === 'auto_config') {
    return (
      <Card className="w-full max-w-md mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-6 w-6 text-primary"/>Configure Quiz</CardTitle>
          <CardDescription>Set up your quiz generated from flashcards. (Requires at least 2 flashcards)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="num-auto-quiz">Number of Questions (1-{flashcards.length})</Label>
            <Input 
              id="num-auto-quiz"
              type="number"
              value={numAutoQuizQuestionsInput}
              onChange={(e) => setNumAutoQuizQuestionsInput(e.target.value)}
              min={1}
              max={flashcards.length}
              className="mt-1"
              disabled={isExpanding}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleStartAutoQuiz} className="w-full" disabled={isExpanding || flashcards.length < 2}>Start Quiz</Button>
        </CardFooter>
      </Card>
    );
  }


  if (quizDisplayQuestions.length === 0 && (quizMode === 'ai_direct' || quizMode === 'auto_active')) {
    // This state might occur if AI returns no questions or auto-generation fails unexpectedly
     return (
      <div className="text-center">
        <Alert variant="default" className="mb-4">
          <Info className="h-4 w-4" />
          <AlertTitle>No Quiz Questions Yet</AlertTitle>
          <AlertDescription>
            {quizMode === 'ai_direct' ? "AI hasn't provided quiz questions for this set, or they were cleared." : "Quiz questions need to be generated from flashcards."}
            You can try generating them or expanding if content is available.
          </AlertDescription>
        </Alert>
        {quizMode === 'ai_direct' && aiQuizQuestions.length === 0 && flashcards.length > 0 && ( // If AI provided none, but we have flashcards, offer to generate from flashcards
            <Button onClick={() => setQuizMode('auto_config')} disabled={isExpanding}>
                Generate Quiz from Flashcards
            </Button>
        )}
        {(flashcards.length > 0 || aiQuizQuestions.length > 0) && ( // Offer expansion if there's any base content
           <div className="mt-6 p-4 border-t w-full max-w-md mx-auto flex flex-col sm:flex-row items-center gap-3">
              <Label htmlFor="expand-quiz-count" className="text-sm whitespace-nowrap sm:mb-0">Add more:</Label>
              <Input
                id="expand-quiz-count"
                type="number"
                value={expandQuizCountInput}
                onChange={(e) => setExpandQuizCountInput(e.target.value)}
                min="1"
                max="20"
                className="h-10 text-sm w-full sm:w-24"
                disabled={isExpanding}
              />
              <Button 
                onClick={() => {
                  const count = parseInt(expandQuizCountInput, 10);
                  if (isNaN(count) || count <= 0) { alert("Please enter a valid positive number."); return; }
                  onExpandItems('quiz', count);
                }} 
                disabled={isExpanding || (flashcards.length === 0 && aiQuizQuestions.length === 0)} // Disable if no base content
                className="w-full sm:w-auto"
              >
                {isExpanding ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <PlusCircle className="h-5 w-5 mr-2" />}
                Expand Quiz
              </Button>
            </div>
        )}
      </div>
   );
  }

  const currentQuestion = quizDisplayQuestions[currentQuestionIndex];

  const handleAnswerSelect = (answer: string) => {
    if (isAnswered) return;
    setSelectedAnswer(answer);
    setIsAnswered(true);
    if (answer === currentQuestion.correctAnswer) {
      setScore(prevScore => prevScore + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizDisplayQuestions.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      setQuizCompleted(true);
    }
  };
  
  const handleRestartQuiz = () => {
    // Re-initialize based on current mode or go back to config for auto_quiz
    if (quizMode === 'ai_direct' && aiQuizQuestions.length > 0) {
       setQuizDisplayQuestions(shuffleArray(aiQuizQuestions.map(q => ({...q, options: shuffleArray(q.options.slice()) }))));
    } else if (quizMode === 'auto_active' || (quizMode === 'ai_direct' && aiQuizQuestions.length === 0 && flashcards.length >=2 )) {
       setQuizMode('auto_config'); 
       setQuizDisplayQuestions([]);
    } else { // Fallback to full re-init if modes are mixed up or no clear path
        initializeQuiz();
    }
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setQuizCompleted(false);
  };


  if (quizCompleted) {
    return (
      <div className="flex flex-col items-center">
        <Card className="w-full max-w-2xl mx-auto text-center shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Quiz Completed!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xl">Your Score: <span className="font-bold text-primary">{score}</span> / {quizDisplayQuestions.length}</p>
            <Progress value={(quizDisplayQuestions.length > 0 ? (score / quizDisplayQuestions.length) : 0) * 100} className="w-full h-3" />
            <p className="text-muted-foreground">
              {quizDisplayQuestions.length > 0 && score === quizDisplayQuestions.length ? "Perfect score! 🎉" : "Keep practicing to improve!"}
            </p>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button onClick={handleRestartQuiz} className="w-full" variant="default"  disabled={isExpanding}>
              <RotateCcw className="mr-2 h-4 w-4" /> Restart Quiz
            </Button>
          </CardFooter>
        </Card>
         <div className="mt-6 p-4 border-t w-full max-w-md flex flex-col sm:flex-row items-center gap-3">
            <Label htmlFor="expand-quiz-count-completed" className="text-sm whitespace-nowrap sm:mb-0">Add more questions:</Label>
            <Input
              id="expand-quiz-count-completed"
              type="number"
              value={expandQuizCountInput}
              onChange={(e) => setExpandQuizCountInput(e.target.value)}
              min="1"
              max="20"
              className="h-10 text-sm w-full sm:w-24"
              disabled={isExpanding}
            />
            <Button 
              onClick={() => {
                const count = parseInt(expandQuizCountInput, 10);
                if (isNaN(count) || count <= 0) { alert("Please enter a valid positive number."); return; }
                onExpandItems('quiz', count).then(() => {
                    // After expansion, decide how to continue:
                    // Option 1: Restart the quiz entirely to include new questions in the shuffle
                    // Option 2: Just add to the end (might be complex if quizCompleted is true)
                    // For simplicity, let's prompt for a restart or go to config.
                    // Here, we'll just allow restarting. The new questions will be in `aiQuizQuestions` or affect `auto_config`
                    setQuizCompleted(false); // Allow restarting
                    if (quizMode === 'ai_direct') {
                        // aiQuizQuestions is updated by parent, useEffect will handle quizDisplayQuestions
                    } else {
                         setQuizMode('auto_config'); // Force reconfig for auto quiz
                    }

                });
              }} 
              disabled={isExpanding} 
              className="w-full sm:w-auto"
            >
              {isExpanding ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <PlusCircle className="h-5 w-5 mr-2" />}
              Expand Quiz
            </Button>
          </div>
      </div>
    );
  }

  if (!currentQuestion) { 
      return (
        <div className="text-center p-10">
          <p>Error loading current question. Please try restarting the quiz.</p>
          <Button onClick={handleRestartQuiz} className="mt-4" variant="outline" disabled={isExpanding}>
            <RotateCcw className="mr-2 h-4 w-4" /> Restart Quiz
          </Button>
        </div>
      );
  }

  return (
    <div className="flex flex-col items-center">
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Question {currentQuestionIndex + 1} of {quizDisplayQuestions.length}</CardTitle>
        <CardDescription className="text-base pt-4 min-h-[60px] break-words">{currentQuestion.question}</CardDescription>
        <Progress value={((currentQuestionIndex + 1) / quizDisplayQuestions.length) * 100} className="w-full h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        {currentQuestion.options.map((option, index) => {
          const isCorrectOption = option === currentQuestion.correctAnswer;
          const isSelected = option === selectedAnswer;
          let buttonVariant: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link" = "outline";
          let icon = null;

          if (isAnswered) {
            if (isCorrectOption) {
              buttonVariant = "secondary"; 
              icon = <CheckCircle2 className="h-5 w-5 text-green-500" />;
            } else if (isSelected && !isCorrectOption) {
              buttonVariant = "destructive"; 
              icon = <XCircle className="h-5 w-5" />;
            }
          }
          
          return (
            <Button
              key={`${currentQuestion.id}-option-${index}`}
              variant={buttonVariant}
              className={cn(
                "w-full justify-start text-left h-auto py-3 px-4 rounded-md transition-all duration-150 ease-in-out",
                "hover:bg-accent/50 hover:text-accent-foreground",
                isSelected && !isAnswered && "ring-2 ring-primary ring-offset-1",
                isAnswered && isCorrectOption && "bg-green-500/20 border-green-500 text-green-700 dark:text-green-300 dark:border-green-600 dark:bg-green-700/30 hover:bg-green-500/30",
                isAnswered && isSelected && !isCorrectOption && "bg-red-500/20 border-red-500 text-red-700 dark:text-red-300 dark:border-red-600 dark:bg-red-700/30 hover:bg-red-500/30"
              )}
              onClick={() => handleAnswerSelect(option)}
              disabled={isAnswered || isExpanding}
              aria-label={`Option: ${option}${isSelected ? ", selected" : ""}${isAnswered && isCorrectOption ? ", correct" : ""}${isAnswered && isSelected && !isCorrectOption ? ", incorrect" : ""}`}
            >
              {icon && <span className="mr-2 shrink-0">{icon}</span>}
              <span className="flex-1 whitespace-normal break-words">{option}</span>
            </Button>
          );
        })}
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-4">
        {isAnswered && (
          <div className="w-full p-3 rounded-md text-center font-semibold">
            {selectedAnswer === currentQuestion.correctAnswer ? (
              <p className="text-green-600 dark:text-green-400 flex items-center justify-center"><CheckCircle2 className="mr-2"/> Correct!</p>
            ) : (
              <p className="text-red-600 dark:text-red-400 flex flex-col sm:flex-row items-center justify-center gap-1">
                <span className="flex items-center"><XCircle className="mr-2"/> Incorrect.</span>
                <span>Correct answer: <strong className="ml-1">{currentQuestion.correctAnswer}</strong></span>
              </p>
            )}
          </div>
        )}
        <Button 
          onClick={handleNextQuestion} 
          disabled={!isAnswered || isExpanding} 
          className="w-full shadow-md hover:shadow-lg transition-shadow"
        >
          {currentQuestionIndex === quizDisplayQuestions.length - 1 ? 'Finish Quiz' : 'Next Question'}
        </Button>
         <p className="text-sm text-muted-foreground">Score: {score} / {quizDisplayQuestions.length}</p>
      </CardFooter>
    </Card>
    {!quizCompleted && (
      <div className="mt-6 p-4 border-t w-full max-w-md flex flex-col sm:flex-row items-center gap-3">
        <Label htmlFor="expand-quiz-count-active" className="text-sm whitespace-nowrap sm:mb-0">Add more questions:</Label>
        <Input
          id="expand-quiz-count-active"
          type="number"
          value={expandQuizCountInput}
          onChange={(e) => setExpandQuizCountInput(e.target.value)}
          min="1"
          max="20"
          className="h-10 text-sm w-full sm:w-24"
          disabled={isExpanding}
        />
        <Button 
          onClick={() => {
            const count = parseInt(expandQuizCountInput, 10);
             if (isNaN(count) || count <= 0) { alert("Please enter a valid positive number."); return; }
            onExpandItems('quiz', count);
            // New questions will be added to aiQuizQuestions state by HomePage
            // The useEffect in QuizTab should pick up these changes if quizMode is 'ai_direct'
            // For 'auto_active', if expansion is based on flashcards, user might need to restart/reconfigure quiz
            // For now, this assumes expansion adds to the pool that `aiQuizQuestions` represents
            // If new questions are added, the total quiz length might change if user hasn't finished.
          }} 
          disabled={isExpanding} 
          className="w-full sm:w-auto"
        >
          {isExpanding ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <PlusCircle className="h-5 w-5 mr-2" />}
          Expand Quiz
        </Button>
      </div>
    )}
    </div>
  );
}
