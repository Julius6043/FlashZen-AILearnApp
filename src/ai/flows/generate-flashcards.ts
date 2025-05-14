// use server'
'use server';

/**
 * @fileOverview Generates flashcards and optionally quiz questions in JSON format from a text prompt, optional PDF content, web search context, or by expanding existing sets.
 *
 * - generateFlashcards - A function that handles the flashcard and quiz generation process.
 * - GenerateFlashcardsInput - The input type for the generateFlashcards function.
 * - GenerateFlashcardsOutput - The return type for the generateFlashcards function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFlashcardsInputSchema = z.object({
  prompt: z.string().describe('The primary topic or instructions for generation/expansion.'),
  pdfText: z.string().optional().describe('Text content extracted from an uploaded PDF.'),
  duckDuckGoContext: z.string().optional().describe('Context from DuckDuckGo search results.'),
  numFlashcards: z.number().int().min(0).optional().describe('Desired number of NEW flashcards to generate (if expanding, this is the additional count). Default 0 if not specified.'),
  numQuizQuestions: z.number().int().min(0).optional().describe('Desired number of NEW quiz questions. If 0 or undefined, no new quiz questions will be generated (if expanding, this is the additional count). Default 0 if not specified.'),
  existingFlashcardsJson: z.string().optional().describe('Stringified JSON of existing flashcards to use as context for expansion. Generate new, distinct items.'),
  existingQuizQuestionsJson: z.string().optional().describe('Stringified JSON of existing quiz questions to use as context for expansion. Generate new, distinct items.'),
  difficulty: z.string().optional().describe('The desired difficulty level for the generated content (e.g., Easy, Medium, Hard, Expert).'),
});
export type GenerateFlashcardsInput = z.infer<typeof GenerateFlashcardsInputSchema>;

const GenerateFlashcardsOutputSchema = z.object({
  flashcards: z.string().describe('The generated NEW flashcards in JSON format. This should be a string containing a JSON array of objects, where each object has a "question" and "answer" field. Should be "[]" if no new flashcards were generated.'),
  quizQuestions: z.string().optional().describe('Generated NEW quiz questions in JSON format. This should be a string containing a JSON array of objects, each with "question", "options" (array of strings), and "correctAnswer" (string that is one of the options). Should be "[]" if no new quiz questions were generated or requested.'),
});
export type GenerateFlashcardsOutput = z.infer<typeof GenerateFlashcardsOutputSchema>;

export async function generateFlashcards(input: GenerateFlashcardsInput): Promise<GenerateFlashcardsOutput> {
  const effectiveInput = {
    ...input,
    numFlashcards: input.numFlashcards === undefined || input.numFlashcards < 0 ? 0 : input.numFlashcards,
    numQuizQuestions: input.numQuizQuestions === undefined || input.numQuizQuestions < 0 ? 0 : input.numQuizQuestions,
  };
  // If numQuizQuestions is 0, LLM prompt handles it as "not requested".
  return generateFlashcardsFlow(effectiveInput);
}

const prompt = ai.definePrompt({
  name: 'generateFlashcardsPrompt',
  input: {schema: GenerateFlashcardsInputSchema},
  output: {schema: GenerateFlashcardsOutputSchema},
  prompt: `You are an expert flashcard and quiz generation assistant.

User's primary query/instruction: "{{{prompt}}}"

{{#if difficulty}}
The user has requested a difficulty level of "{{difficulty}}". Adjust the complexity of the generated content accordingly:
- Easy: Focus on fundamental concepts, basic definitions, and straightforward questions.
- Medium: Include more detailed explanations, common examples, and moderately challenging questions.
- Hard: Cover in-depth concepts, complex scenarios, nuanced differences, and challenging questions that require deeper understanding.
- Expert: Target highly specialized knowledge, advanced topics, critical analysis, and questions that assess expert-level comprehension.
{{/if}}

{{#if existingFlashcardsJson}}
You are EXPANDING an existing set of flashcards.
Existing Flashcards (for context, DO NOT REPEAT OR DUPLICATE content from these):
--- START EXISTING FLASHCARDS ---
{{{existingFlashcardsJson}}}
--- END EXISTING FLASHCARDS ---
Generate approximately {{numFlashcards}} NEW and DISTINCT flashcards related to the topic and the existing ones.
{{else}}
  {{#if pdfText}}
  The user has uploaded a PDF document. Use this document as the primary source material, guided by the "User's primary query/instruction" stated above.
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
  Based on the user's query: "{{{prompt}}}"{{#if pdfText}} and the provided PDF content{{/if}}{{#if duckDuckGoContext}} and the web search context{{/if}}, generate approximately {{numFlashcards}} flashcards.
{{/if}}

Each NEW flashcard must have a "question" and an "answer".
The collection of NEW flashcards should be formatted as a JSON array of objects.
Example for NEW flashcards: [{"question": "What is a new concept?", "answer": "A new explanation."}, ...]

{{#if numQuizQuestions}}
  {{#if existingQuizQuestionsJson}}
  You are EXPANDING an existing set of quiz questions.
  Existing Quiz Questions (for context, DO NOT REPEAT OR DUPLICATE content from these):
  --- START EXISTING QUIZ QUESTIONS ---
  {{{existingQuizQuestionsJson}}}
  --- END EXISTING QUIZ QUESTIONS ---
  Generate approximately {{numQuizQuestions}} NEW and DISTINCT multiple-choice quiz questions related to the topics covered and the existing ones.
  {{else}}
  Generate approximately {{numQuizQuestions}} multiple-choice quiz questions related to the topics covered by the flashcards.
  {{/if}}
  These NEW quiz questions should test understanding of the material but should NOT be direct copies of the flashcard questions/answers or existing quiz questions.
  Each NEW quiz question object must have a "question" (string), "options" (array of 3-4 strings), and a "correctAnswer" (string, which must be one of the provided options).
  Format the NEW quiz questions as a JSON array of objects.
  Example for NEW quiz questions: [{"question": "Which of these is a novel primary color concept?", "options": ["Neo-Green", "Infra-Blue", "Ultra-Orange", "Meta-Purple"], "correctAnswer": "Infra-Blue"}]
{{/if}}

Your final output MUST be a JSON object containing ONLY THE NEWLY GENERATED items.
This JSON object:
1. MUST have a key "flashcards". The value of this "flashcards" key MUST be a STRINGIFIED JSON array of the NEW flashcards you generated. If no new flashcards were requested (e.g., numFlashcards was 0 or not provided) or if none could be generated based on the context, this MUST be an empty stringified array "[]".
{{#if numQuizQuestions}}
2. MUST have a key "quizQuestions". The value of this "quizQuestions" key MUST be a STRINGIFIED JSON array of the NEW quiz questions you generated. If no new quiz questions were requested (e.g., numQuizQuestions was 0) or if none could be generated, this MUST be an empty stringified array "[]".
{{else}}
The "quizQuestions" key should be present and its value MUST be an empty stringified array "[]" if no new quiz questions were requested or generated.
{{/if}}

User's text prompt: {{{prompt}}}
Desired number of NEW flashcards: {{numFlashcards}}
{{#if numQuizQuestions}}
Desired number of NEW quiz questions: {{numQuizQuestions}}
{{/if}}
{{#if difficulty}}
Desired difficulty: {{difficulty}}
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
      if (output && typeof output.flashcards === 'object') {
        try {
          const flashcardsString = JSON.stringify(output.flashcards);
          // Ensure quizQuestions is also stringified if it's an object, or remains undefined/string
          let quizQuestionsString = output.quizQuestions;
          if (quizQuestionsString && typeof quizQuestionsString === 'object') {
            quizQuestionsString = JSON.stringify(quizQuestionsString);
          }
          return { flashcards: flashcardsString, quizQuestions: quizQuestionsString === null ? "[]" : quizQuestionsString };
        } catch (e) {
            console.error("Error stringifying LLM object output:", e);
             return { flashcards: "[]", quizQuestions: "[]" };
        }
      }
      return { flashcards: "[]", quizQuestions: "[]" }; 
    }
    
    // Ensure quizQuestions is a string ("[]" if null/undefined/empty)
    let finalQuizQuestions = output.quizQuestions;
    if (finalQuizQuestions === null || finalQuizQuestions === undefined || finalQuizQuestions.trim() === "") {
        finalQuizQuestions = "[]";
    } else if (typeof finalQuizQuestions === 'object') {
        try {
            finalQuizQuestions = JSON.stringify(finalQuizQuestions);
        } catch (e) {
            console.error("Error stringifying quizQuestions object:", e);
            finalQuizQuestions = "[]";
        }
    }


    return { ...output, flashcards: output.flashcards || "[]", quizQuestions: finalQuizQuestions };
  }
);

// Helper to ensure output is always valid, even if LLM returns unexpected (e.g. null)
// This was a previous attempt to fix the null output issue directly, 
// but the prompt constraints are the primary defense.
// The 'if (!output)' check above now handles this more robustly.
// Example:
// const { output } = await prompt(input);
// if (!output) {
//   // Handle null or undefined output from LLM, e.g., by returning empty/default.
//   return { flashcards: "[]", quizQuestions: "[]" };
// }
// return output;

