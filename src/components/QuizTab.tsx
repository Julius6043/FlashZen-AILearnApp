'use client';

import * as React from 'react';
import type { FlashcardType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Info, Lightbulb, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuizTabProps {
  flashcards: FlashcardType[];
}

interface QuizQuestion extends FlashcardType {
  options: string[];
  shuffledOptions: string[]; // To keep a stable order for display once generated
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function QuizTab({ flashcards }: QuizTabProps) {
  const [quizQuestions, setQuizQuestions] = React.useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [selectedAnswer, setSelectedAnswer] = React.useState<string | null>(null);
  const [isAnswered, setIsAnswered] = React.useState(false);
  const [score, setScore] = React.useState(0);
  const [quizCompleted, setQuizCompleted] = React.useState(false);

  React.useEffect(() => {
    if (flashcards.length < 2) { // Need at least 2 for MCQs
      setQuizQuestions([]);
      return;
    }

    const generatedQuestions = flashcards.map((card) => {
      const otherAnswers = flashcards
        .filter(fc => fc.id !== card.id)
        .map(fc => fc.answer);
      
      const incorrectOptions = shuffleArray(otherAnswers).slice(0, 3);
      // Ensure we have 3 incorrect options if possible, otherwise fewer
      while (incorrectOptions.length < 3 && otherAnswers.length > incorrectOptions.length) {
         // This logic is a bit simplistic, if few cards, options might not be diverse
        incorrectOptions.push(otherAnswers[incorrectOptions.length % otherAnswers.length]);
      }
      
      const options = [card.answer, ...incorrectOptions];
      return {
        ...card,
        options: shuffleArray(options.filter((opt, idx, self) => self.indexOf(opt) === idx)), // Unique options
        shuffledOptions: [] // will be set once
      };
    }).map(q => ({...q, shuffledOptions: q.options})); // Set shuffledOptions initially

    setQuizQuestions(shuffleArray(generatedQuestions));
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setQuizCompleted(false);
  }, [flashcards]);

  if (flashcards.length < 2) {
     return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Not Enough Flashcards for Quiz</AlertTitle>
        <AlertDescription>
          You need at least 2 flashcards to start a multiple-choice quiz. Please generate more flashcards.
        </AlertDescription>
      </Alert>
    );
  }

  if (quizQuestions.length === 0 && flashcards.length >=2) {
    // Initial loading or processing state
    return <div className="text-center p-10">Preparing your quiz... <Lightbulb className="inline h-5 w-5 animate-pulse" /></div>;
  }
  
  if (quizQuestions.length === 0) {
     return <div className="text-center p-10">No quiz questions available.</div>;
  }


  const currentQuestion = quizQuestions[currentQuestionIndex];

  const handleAnswerSelect = (answer: string) => {
    if (isAnswered) return;
    setSelectedAnswer(answer);
    setIsAnswered(true);
    if (answer === currentQuestion.answer) {
      setScore(prevScore => prevScore + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      setQuizCompleted(true);
    }
  };
  
  const handleRestartQuiz = () => {
     // Re-shuffle questions for a new attempt
    setQuizQuestions(shuffleArray(quizQuestions.map(q => ({...q, shuffledOptions: shuffleArray(q.options)}))));
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
          <p className="text-xl">Your Score: <span className="font-bold text-primary">{score}</span> / {quizQuestions.length}</p>
          <Progress value={(score / quizQuestions.length) * 100} className="w-full h-3" />
          <p className="text-muted-foreground">
            {score === quizQuestions.length ? "Perfect score! 🎉" : "Keep practicing to improve!"}
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


  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Question {currentQuestionIndex + 1} of {quizQuestions.length}</CardTitle>
        <CardDescription className="text-base pt-4 min-h-[60px]">{currentQuestion.question}</CardDescription>
        <Progress value={((currentQuestionIndex + 1) / quizQuestions.length) * 100} className="w-full h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        {currentQuestion.shuffledOptions.map((option, index) => {
          const isCorrect = option === currentQuestion.answer;
          const isSelected = option === selectedAnswer;
          let buttonVariant: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link" = "outline";
          let icon = null;

          if (isAnswered) {
            if (isCorrect) {
              buttonVariant = "secondary"; // Correct answer style
              icon = <CheckCircle2 className="h-5 w-5 text-green-500" />;
            } else if (isSelected && !isCorrect) {
              buttonVariant = "destructive"; // Incorrect selected answer
              icon = <XCircle className="h-5 w-5" />;
            }
          }
          
          return (
            <Button
              key={index}
              variant={buttonVariant}
              className={cn(
                "w-full justify-start text-left h-auto py-3 px-4 rounded-md transition-all duration-150 ease-in-out",
                "hover:bg-accent/50 hover:text-accent-foreground",
                isSelected && !isAnswered && "ring-2 ring-primary",
                isAnswered && isCorrect && "bg-green-500/20 border-green-500 text-green-700 hover:bg-green-500/30",
                isAnswered && isSelected && !isCorrect && "bg-red-500/20 border-red-500 text-red-700 hover:bg-red-500/30"
              )}
              onClick={() => handleAnswerSelect(option)}
              disabled={isAnswered}
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
            {selectedAnswer === currentQuestion.answer ? (
              <p className="text-green-600 flex items-center justify-center"><CheckCircle2 className="mr-2"/> Correct!</p>
            ) : (
              <p className="text-red-600 flex items-center justify-center"><XCircle className="mr-2"/> Incorrect. The correct answer is: <strong className="ml-1">{currentQuestion.answer}</strong></p>
            )}
          </div>
        )}
        <Button 
          onClick={handleNextQuestion} 
          disabled={!isAnswered} 
          className="w-full shadow-md hover:shadow-lg transition-shadow"
        >
          {currentQuestionIndex === quizQuestions.length - 1 ? 'Finish Quiz' : 'Next Question'}
        </Button>
         <p className="text-sm text-muted-foreground">Score: {score} / {quizQuestions.length}</p>
      </CardFooter>
    </Card>
  );
}
