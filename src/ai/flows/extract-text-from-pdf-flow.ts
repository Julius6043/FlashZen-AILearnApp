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
import pdf from 'pdf-parse';

const ExtractTextFromPdfInputSchema = z.object({
  pdfDataUri: z.string().describe(
    "A PDF file encoded as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
  ),
});
export type ExtractTextFromPdfInput = z.infer<typeof ExtractTextFromPdfInputSchema>;

const ExtractTextFromPdfOutputSchema = z.object({
  extractedText: z.string().describe('The text content extracted from the PDF.'),
});
export type ExtractTextFromPdfOutput = z.infer<typeof ExtractTextFromPdfOutputSchema>;

export async function extractTextFromPdf(input: ExtractTextFromPdfInput): Promise<ExtractTextFromPdfOutput> {
  return extractTextFromPdfFlow(input);
}

const extractTextFromPdfFlow = ai.defineFlow(
  {
    name: 'extractTextFromPdfFlow',
    inputSchema: ExtractTextFromPdfInputSchema,
    outputSchema: ExtractTextFromPdfOutputSchema,
  },
  async (input) => {
    try {
      if (!input.pdfDataUri.startsWith('data:application/pdf;base64,')) {
        throw new Error('Invalid PDF Data URI format. Expected "data:application/pdf;base64,<data>".');
      }
      const base64Data = input.pdfDataUri.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid PDF Data URI: Missing base64 data.');
      }
      const pdfBuffer = Buffer.from(base64Data, 'base64');
      const data = await pdf(pdfBuffer);
      return { extractedText: data.text };
    } catch (error: any) {
      console.error('Error extracting text from PDF:', error);
      // Return an empty string in case of error to prevent flow failure, client can handle.
      // Or rethrow if a hard failure is preferred:
      // throw new Error(`Failed to extract text from PDF: ${error.message}`);
      return { extractedText: "" };
    }
  }
);
