// use server'
'use server';

/**
 * @fileOverview Generates flashcards and optionally quiz questions in JSON format from a text prompt and optional PDF content.
 *
 * - generateFlashcards - A function that handles the flashcard and quiz generation process.
 * - GenerateFlashcardsInput - The input type for the generateFlashcards function.
 * - GenerateFlashcardsOutput - The return type for the generateFlashcards function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFlashcardsInputSchema = z.object({
  prompt: z.string().describe('The text prompt to generate flashcards from.'),
  pdfText: z.string().optional().describe('Text content extracted from an uploaded PDF.'),
  duckDuckGoContext: z.string().optional().describe('Context from DuckDuckGo search results.'),
  numFlashcards: z.number().int().positive().optional().default(10).describe('Desired number of flashcards.'),
  numQuizQuestions: z.number().int().positive().optional().describe('Desired number of quiz questions. If 0 or undefined, no quiz questions will be generated.'),
});
export type GenerateFlashcardsInput = z.infer<typeof GenerateFlashcardsInputSchema>;

const GenerateFlashcardsOutputSchema = z.object({
  flashcards: z.string().describe('The generated flashcards in JSON format. This should be a string containing a JSON array of objects, where each object has a "question" and "answer" field.'),
  quizQuestions: z.string().optional().describe('Generated quiz questions in JSON format. This should be a string containing a JSON array of objects, each with "question", "options" (array of strings), and "correctAnswer" (string that is one of the options).'),
});
export type GenerateFlashcardsOutput = z.infer<typeof GenerateFlashcardsOutputSchema>;

export async function generateFlashcards(input: GenerateFlashcardsInput): Promise<GenerateFlashcardsOutput> {
  // If numQuizQuestions is 0, treat it as undefined so the prompt handles it as "not requested"
  const effectiveInput = {
    ...input,
    numQuizQuestions: input.numQuizQuestions === 0 ? undefined : input.numQuizQuestions,
  };
  return generateFlashcardsFlow(effectiveInput);
}

const prompt = ai.definePrompt({
  name: 'generateFlashcardsPrompt',
  input: {schema: GenerateFlashcardsInputSchema},
  output: {schema: GenerateFlashcardsOutputSchema},
  prompt: `You are an expert flashcard and quiz generation assistant.

User's primary query: "{{{prompt}}}"

{{#if pdfText}}
The user has uploaded a PDF document. Please prioritize the content from this PDF for generation.
PDF Content:
--- START PDF CONTENT ---
{{{pdfText}}}
--- END PDF CONTENT ---
{{/if}}

{{#if duckDuckGoContext}}
Additional context from a web search has been provided. Use this to supplement your knowledge.
Web Search Context:
--- START WEB SEARCH CONTEXT ---
{{{duckDuckGoContext}}}
--- END WEB SEARCH CONTEXT ---
{{/if}}

Based on the user's query: "{{{prompt}}}"{{#if pdfText}} and the provided PDF content{{/if}}{{#if duckDuckGoContext}} and the web search context{{/if}}:

1. Flashcards:
   Generate approximately {{numFlashcards}} flashcards.
   Each flashcard must have a "question" and an "answer".
   The collection of flashcards should be formatted as a JSON array of objects.
   For example: [{"question": "What is the capital of France?", "answer": "Paris"}, {"question": "What is 2 + 2?", "answer": "4"}]

{{#if numQuizQuestions}}
2. Quiz Questions:
   Generate approximately {{numQuizQuestions}} quiz questions related to the topics covered by the flashcards.
   These quiz questions should test understanding of the material but should NOT be direct copies of the flashcard questions or answers.
   Aim for variety in question style if possible, but primarily generate multiple-choice questions.
   Each quiz question object must have a "question" (string), "options" (array of 3-4 strings), and a "correctAnswer" (string, which must be one of the provided options).
   Format the quiz questions as a JSON array of objects.
   For example: [{"question": "Which of these is a primary color?", "options": ["Green", "Blue", "Orange", "Purple"], "correctAnswer": "Blue"}]
{{/if}}

Your final output MUST be a JSON object.
This JSON object:
1. MUST have a key "flashcards". The value of this "flashcards" key MUST be a STRINGIFIED JSON array of the flashcards you generated (e.g., "[{\\"question\\": \\"Q1\\", \\"answer\\": \\"A1\\"}, ...]").
{{#if numQuizQuestions}}
2. MUST have a key "quizQuestions" if quiz questions were requested. The value of this "quizQuestions" key MUST be a STRINGIFIED JSON array of the quiz questions you generated (e.g., "[{\\"question\\": \\"QZ1\\", \\"options\\": [\\"O1\\", \\"O2\\"], \\"correctAnswer\\": \\"O1\\"}, ...]"). If no quiz questions were requested or none could be generated, you can omit this key or set its value to an empty stringified array "[]".
{{else}}
The "quizQuestions" key should be omitted if no quiz questions were requested.
{{/if}}

User's text prompt: {{{prompt}}}
Desired number of flashcards: {{numFlashcards}}
{{#if numQuizQuestions}}
Desired number of quiz questions: {{numQuizQuestions}}
{{/if}}
`,
});

const generateFlashcardsFlow = ai.defineFlow(
  {
    name: 'generateFlashcardsFlow',
    inputSchema: GenerateFlashcardsInputSchema,
    outputSchema: GenerateFlashcardsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output || typeof output.flashcards !== 'string') {
      console.error("LLM did not produce the expected 'flashcards' string output.", output);
      // Attempt to salvage if output is an object but flashcards is not a string
      if (output && typeof output.flashcards === 'object') {
        try {
          const flashcardsString = JSON.stringify(output.flashcards);
          const quizQuestionsString = (output.quizQuestions && typeof output.quizQuestions === 'object') 
            ? JSON.stringify(output.quizQuestions)
            : output.quizQuestions;

          return { flashcards: flashcardsString, quizQuestions: quizQuestionsString === null ? undefined : quizQuestionsString };
        } catch (e) {
            // stringify failed
             return { flashcards: "[]" };
        }
      }
      return { flashcards: "[]" }; 
    }
    // Ensure quizQuestions is either a string or undefined, not null.
    if (output.quizQuestions === null) {
        return { ...output, quizQuestions: undefined };
    }
    return output;
  }
);
