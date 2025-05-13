// use server'
'use server';

/**
 * @fileOverview Generates flashcards in JSON format from a text prompt.
 *
 * - generateFlashcards - A function that handles the flashcard generation process.
 * - GenerateFlashcardsInput - The input type for the generateFlashcards function.
 * - GenerateFlashcardsOutput - The return type for the generateFlashcards function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFlashcardsInputSchema = z.object({
  prompt: z.string().describe('The text prompt to generate flashcards from.'),
});
export type GenerateFlashcardsInput = z.infer<typeof GenerateFlashcardsInputSchema>;

const GenerateFlashcardsOutputSchema = z.object({
  flashcards: z.string().describe('The generated flashcards in JSON format. This should be a string containing a JSON array of objects, where each object has a "question" and "answer" field.'),
});
export type GenerateFlashcardsOutput = z.infer<typeof GenerateFlashcardsOutputSchema>;

export async function generateFlashcards(input: GenerateFlashcardsInput): Promise<GenerateFlashcardsOutput> {
  return generateFlashcardsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFlashcardsPrompt',
  input: {schema: GenerateFlashcardsInputSchema},
  output: {schema: GenerateFlashcardsOutputSchema},
  // tools: [], // Tool removed for simplicity
  prompt: `You are an expert flashcard generation assistant.
Based on the user's query: {{{prompt}}}, you need to generate a set of flashcards.
Each flashcard must have a "question" and an "answer".
The collection of flashcards should be formatted as a JSON array of objects.
For example: [{"question": "What is the capital of France?", "answer": "Paris"}, {"question": "What is 2 + 2?", "answer": "4"}]

Your final output MUST be a JSON object with a single key "flashcards". The value of this "flashcards" key MUST be the stringified JSON array of flashcards you generated.

User's request:
{{{prompt}}}
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
      // Attempt to provide a valid empty structure if primary generation fails
      // This helps satisfy the schema for the flow and lets the client handle "no flashcards"
      return { flashcards: "[]" }; 
    }
    return output;
  }
);

