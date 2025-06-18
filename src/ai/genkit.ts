import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  })],
  model: 'googleai/gemini-2.5-pro-preview-05-06',
});
