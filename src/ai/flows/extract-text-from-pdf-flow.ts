
'use server';
/**
 * @fileOverview Extracts text content from a PDF provided as a Data URI.
 *
 * - extractTextFromPdf - A function that handles PDF text extraction.
 * - ExtractTextFromPdfInput - The input type.
 * - ExtractTextFromPdfOutput - The return type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
// pdf-parse will be required dynamically

const ExtractTextFromPdfInputSchema = z.object({
  pdfDataUri: z.string().describe(
    "A PDF file encoded as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
  ),
});
export type ExtractTextFromPdfInput = z.infer<typeof ExtractTextFromPdfInputSchema>;

// Modified Output Schema
const ExtractTextFromPdfOutputSchema = z.object({
  extractedText: z.string().describe('The text content extracted from the PDF.'),
  error: z.string().optional().describe('An error message if text extraction failed.'),
});
export type ExtractTextFromPdfOutput = z.infer<typeof ExtractTextFromPdfOutputSchema>;

// Export a wrapper function that calls the flow
export async function extractTextFromPdf(input: ExtractTextFromPdfInput): Promise<ExtractTextFromPdfOutput> {
  return extractTextFromPdfFlow(input);
}

const extractTextFromPdfFlow = ai.defineFlow(
  {
    name: 'extractTextFromPdfFlow', // Changed name to avoid conflict with wrapper function
    inputSchema: ExtractTextFromPdfInputSchema,
    outputSchema: ExtractTextFromPdfOutputSchema,
  },
  async (input): Promise<ExtractTextFromPdfOutput> => {
    let pdfParse;
    try {
      // Dynamically import pdf-parse
      const pdfParseModule = await import('pdf-parse');
      // Attempt to get the function, accommodating different module export styles
      pdfParse = pdfParseModule.default || pdfParseModule;
      if (typeof pdfParse !== 'function') {
        throw new Error('pdf-parse did not load as a function. Loaded module: ' + JSON.stringify(pdfParseModule));
      }
    } catch (e: any) {
      console.error('Failed to load pdf-parse module:', e);
      return {
        extractedText: '',
        error: `Failed to load PDF parsing library: ${e.message || 'Unknown error'}`,
      };
    }

    try {
      if (!input.pdfDataUri.startsWith('data:application/pdf;base64,')) {
        return {
          extractedText: '',
          error: 'Invalid PDF Data URI format. Expected "data:application/pdf;base64,<data>".',
        };
      }
      const base64Data = input.pdfDataUri.split(',')[1];
      if (!base64Data) {
        return {
          extractedText: '',
          error: 'Invalid PDF Data URI: Missing base64 data.',
        };
      }
      const pdfBuffer = Buffer.from(base64Data, 'base64');
      
      const data = await pdfParse(pdfBuffer);

      if (!data || typeof data.text !== 'string') {
        console.warn('pdf-parse did not return valid text output from PDF.');
        return {
          extractedText: '',
          error: 'Failed to extract text: PDF content might be an image, empty, or corrupted.',
        };
      }
      
      return { extractedText: data.text }; // Success
    } catch (error: any) {
      console.error('Error extracting text from PDF:', error);
      return {
        extractedText: '',
        error: `Failed to extract text from PDF: ${error.message || 'Unknown processing error'}`,
      };
    }
  }
);

