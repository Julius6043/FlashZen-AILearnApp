'use server';
/**
 * @fileOverview Converts text to speech using an AI model.
 *
 * - textToSpeech - A function that handles text-to-speech conversion.
 * - TextToSpeechInput - The input type for the textToSpeech function.
 * - TextToSpeechOutput - The return type for the textToSpeech function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const TextToSpeechInputSchema = z.object({
  textToSpeak: z.string().describe('The text to be converted to speech.'),
});
export type TextToSpeechInput = z.infer<typeof TextToSpeechInputSchema>;

const TextToSpeechOutputSchema = z.object({
  audioDataUri: z.string().describe(
    "The generated audio as a data URI. Expected format: 'data:audio/<format>;base64,<encoded_data>'."
  ),
});
export type TextToSpeechOutput = z.infer<typeof TextToSpeechOutputSchema>;

export async function textToSpeech(input: TextToSpeechInput): Promise<TextToSpeechOutput> {
  return textToSpeechFlow(input);
}

const textToSpeechFlow = ai.defineFlow(
  {
    name: 'textToSpeechFlow',
    inputSchema: TextToSpeechInputSchema,
    outputSchema: TextToSpeechOutputSchema,
  },
  async (input) => {
    // Use ai.generate for direct model interaction for specific modalities
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp', // Model capable of media generation
      prompt: `Please read the following text aloud: ${input.textToSpeak}`,
      config: {
        // Changed from ['TEXT', 'AUDIO'] to ['AUDIO'] based on the error message:
        // "Model does not support the requested response modalities: audio,text."
        // This implies that for this model and task, only 'AUDIO' should be requested.
        responseModalities: ['AUDIO'], 
      },
    });

    if (!media || !media.url) {
      console.error('Audio generation failed or returned no audio data. Media:', media);
      throw new Error('Audio generation failed or returned no audio data.');
    }
    // The model might return audio in a specific format like audio/ogg or audio/mpeg
    // The browser's Audio element should handle common formats.
    return { audioDataUri: media.url };
  }
);
