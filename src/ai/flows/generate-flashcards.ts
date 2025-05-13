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
  flashcards: z.string().describe('The generated flashcards in JSON format.'),
});
export type GenerateFlashcardsOutput = z.infer<typeof GenerateFlashcardsOutputSchema>;

const validateJsonTool = ai.defineTool({
  name: 'validateJson',
  description: 'Validates if the provided string is a valid JSON format.',
  inputSchema: z.object({
    jsonString: z.string().describe('The JSON string to validate.'),
  }),
  outputSchema: z.boolean(),
}, async (input) => {
  try {
    JSON.parse(input.jsonString);
    return true;
  } catch (e) {
    return false;
  }
});

export async function generateFlashcards(input: GenerateFlashcardsInput): Promise<GenerateFlashcardsOutput> {
  return generateFlashcardsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFlashcardsPrompt',
  input: {schema: GenerateFlashcardsInputSchema},
  output: {schema: GenerateFlashcardsOutputSchema},
  tools: [validateJsonTool],
  prompt: `You are a flashcard generator. Please generate flashcards in JSON format based on the following prompt: {{{prompt}}}. Validate the JSON structure using the validateJson tool before returning it.`,
});

const generateFlashcardsFlow = ai.defineFlow(
  {
    name: 'generateFlashcardsFlow',
    inputSchema: GenerateFlashcardsInputSchema,
    outputSchema: GenerateFlashcardsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
