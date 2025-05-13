
'use server';
/**
 * @fileOverview Transcribes audio to text using an AI model.
 *
 * - speechToText - A function that handles audio-to-text transcription.
 * - SpeechToTextInput - The input type for the speechToText function.
 * - SpeechToTextOutput - The return type for the speechToText function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SpeechToTextInputSchema = z.object({
  audioDataUri: z.string().describe(
    "The audio data as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
});
export type SpeechToTextInput = z.infer<typeof SpeechToTextInputSchema>;

const SpeechToTextOutputSchema = z.object({
  transcribedText: z.string().describe('The text transcribed from the audio.'),
});
export type SpeechToTextOutput = z.infer<typeof SpeechToTextOutputSchema>;

export async function speechToText(input: SpeechToTextInput): Promise<SpeechToTextOutput> {
  return speechToTextFlow(input);
}

const speechToTextFlow = ai.defineFlow(
  {
    name: 'speechToTextFlow',
    inputSchema: SpeechToTextInputSchema,
    outputSchema: SpeechToTextOutputSchema,
  },
  async (input) => {
    // The default model from ai/genkit.ts (gemini-2.5-pro-preview) should handle multimodal input.
    // If not, a specific model like 'googleai/gemini-1.5-flash-latest' could be specified.
    const response = await ai.generate({ // Changed const { text } to const response
      prompt: [
        { media: { url: input.audioDataUri } }, // The data URI includes the mimeType
        { text: 'Transcribe this audio recording accurately and concisely.' },
      ],
      // Ensure the model understands the context and desired output.
      // No specific 'responseModalities' needed if text is the expected primary output for transcription.
    });

    const transcribed = response.text; // Changed text() to response.text
    if (transcribed === null || transcribed === undefined) {
      console.error('Speech-to-text transcription failed or returned no text. Raw output:', response.text);
      // It's better to return an empty string than throw, so client can handle it.
      return { transcribedText: "" };
    }
    return { transcribedText: transcribed };
  }
);

