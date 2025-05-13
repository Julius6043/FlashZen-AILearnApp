'use client';

import * as React from 'react';
import type { FlashcardType, QuizQuestionType as AIQuizQuestionType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Info, Lightbulb, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuizTabProps {
  flashcards: FlashcardType[];
  aiQuizQuestions: AIQuizQuestionType[];
}

// Internal Quiz Question structure, can be derived from FlashcardType or AIQuizQuestionType
interface QuizDisplayQuestion {
  id: string;
  question: string;
  options: string[]; // Always shuffled for display consistency once generated
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

export function QuizTab({ flashcards, aiQuizQuestions }: QuizTabProps) {
  const [quizDisplayQuestions, setQuizDisplayQuestions] = React.useState<QuizDisplayQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [selectedAnswer, setSelectedAnswer] = React.useState<string | null>(null);
  const [isAnswered, setIsAnswered] = React.useState(false);
  const [score, setScore] = React.useState(0);
  const [quizCompleted, setQuizCompleted] = React.useState(false);
  const [isLoadingQuiz, setIsLoadingQuiz] = React.useState(true);

  React.useEffect(() => {
    setIsLoadingQuiz(true);
    let generatedQuestions: QuizDisplayQuestion[] = [];

    if (aiQuizQuestions && aiQuizQuestions.length > 0) {
      // Use AI-generated quiz questions
      generatedQuestions = aiQuizQuestions.map(q => ({
        ...q,
        options: shuffleArray(q.options), // Shuffle options for display
      }));
    } else if (flashcards.length >= 2) {
      // Fallback: Derive MCQs from flashcards if no AI questions and enough flashcards
      generatedQuestions = flashcards.map((card) => {
        const otherAnswers = flashcards
          .filter(fc => fc.id !== card.id)
          .map(fc => fc.answer);
        
        let incorrectOptions = shuffleArray(otherAnswers).slice(0, 3);
        // Ensure 3 incorrect options if possible
        const potentialOptions = [...new Set(otherAnswers)]; // Unique other answers
        while (incorrectOptions.length < 3 && incorrectOptions.length < potentialOptions.length) {
          const nextOption = potentialOptions.find(opt => !incorrectOptions.includes(opt) && opt !== card.answer);
          if (nextOption) {
            incorrectOptions.push(nextOption);
          } else {
            break; // No more unique incorrect options
          }
        }
         // If still not enough, duplicate from existing incorrect options (less ideal but makes 4 choices)
        let i = 0;
        while (incorrectOptions.length < 3 && incorrectOptions.length > 0) {
            incorrectOptions.push(incorrectOptions[i % incorrectOptions.length]);
            i++;
        }


        const allOptions = [card.answer, ...incorrectOptions];
        // Ensure unique and then shuffle
        const uniqueOptions = [...new Set(allOptions)]; 
        
        return {
          id: card.id,
          question: card.question,
          options: shuffleArray(uniqueOptions),
          correctAnswer: card.answer,
        };
      });
    }

    setQuizDisplayQuestions(shuffleArray(generatedQuestions));
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setQuizCompleted(false);
    setIsLoadingQuiz(false);

  }, [flashcards, aiQuizQuestions]);

  if (isLoadingQuiz) {
    return <div className="text-center p-10">Preparing your quiz... <Lightbulb className="inline h-5 w-5 animate-pulse" /></div>;
  }

  if (quizDisplayQuestions.length === 0) {
     return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Not Enough Content for Quiz</AlertTitle>
        <AlertDescription>
          {aiQuizQuestions && aiQuizQuestions.length > 0 ? "AI generated questions are available, but seem to be empty or invalid." : "You need at least 2 flashcards to start a multiple-choice quiz if no AI questions are provided. Please generate more flashcards or ensure AI generates quiz questions."}
        </AlertDescription>
      </Alert>
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
    setQuizDisplayQuestions(prevQuestions => shuffleArray(prevQuestions.map(q => ({...q, options: shuffleArray(q.options.slice()) })))); // Re-shuffle options too
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setQuizCompleted(false);
  };


  if (quizCompleted) {
    return (
      <Card className="w-full max-w-lg mx-auto text-center shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Quiz Completed!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xl">Your Score: <span className="font-bold text-primary">{score}</span> / {quizDisplayQuestions.length}</p>
          <Progress value={(score / quizDisplayQuestions.length) * 100} className="w-full h-3" />
          <p className="text-muted-foreground">
            {score === quizDisplayQuestions.length ? "Perfect score! 🎉" : "Keep practicing to improve!"}
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={handleRestartQuiz} className="w-full" variant="default">
            <RotateCcw className="mr-2 h-4 w-4" /> Restart Quiz
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (!currentQuestion) { // Should not happen if quizDisplayQuestions has items
      return <div className="text-center p-10">Error loading current question.</div>;
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Question {currentQuestionIndex + 1} of {quizDisplayQuestions.length}</CardTitle>
        <CardDescription className="text-base pt-4 min-h-[60px]">{currentQuestion.question}</CardDescription>
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
              key={`${currentQuestion.id}-option-${index}`} // More unique key
              variant={buttonVariant}
              className={cn(
                "w-full justify-start text-left h-auto py-3 px-4 rounded-md transition-all duration-150 ease-in-out",
                "hover:bg-accent/50 hover:text-accent-foreground",
                isSelected && !isAnswered && "ring-2 ring-primary",
                isAnswered && isCorrectOption && "bg-green-500/20 border-green-500 text-green-700 hover:bg-green-500/30",
                isAnswered && isSelected && !isCorrectOption && "bg-red-500/20 border-red-500 text-red-700 hover:bg-red-500/30"
              )}
              onClick={() => handleAnswerSelect(option)}
              disabled={isAnswered}
              aria-label={`Option: ${option}${isSelected ? ", selected" : ""}${isAnswered && isCorrectOption ? ", correct" : ""}${isAnswered && isSelected && !isCorrectOption ? ", incorrect" : ""}`}
            >
              {icon && <span className="mr-2">{icon}</span>}
              <span className="flex-1">{option}</span>
            </Button>
          );
        })}
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-4">
        {isAnswered && (
          <div className="w-full p-3 rounded-md text-center font-semibold">
            {selectedAnswer === currentQuestion.correctAnswer ? (
              <p className="text-green-600 flex items-center justify-center"><CheckCircle2 className="mr-2"/> Correct!</p>
            ) : (
              <p className="text-red-600 flex items-center justify-center"><XCircle className="mr-2"/> Incorrect. The correct answer is: <strong className="ml-1">{currentQuestion.correctAnswer}</strong></p>
            )}
          </div>
        )}
        <Button 
          onClick={handleNextQuestion} 
          disabled={!isAnswered} 
          className="w-full shadow-md hover:shadow-lg transition-shadow"
        >
          {currentQuestionIndex === quizDisplayQuestions.length - 1 ? 'Finish Quiz' : 'Next Question'}
        </Button>
         <p className="text-sm text-muted-foreground">Score: {score} / {quizDisplayQuestions.length}</p>
      </CardFooter>
    </Card>
  );
}
