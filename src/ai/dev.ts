
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-flashcards.ts';
import '@/ai/flows/validate-json.ts';
import '@/ai/flows/extract-text-from-pdf-flow';
import '@/ai/flows/text-to-speech-flow';
import '@/ai/flows/speech-to-text-flow'; // Added new flow
