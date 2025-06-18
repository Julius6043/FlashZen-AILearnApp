
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

// Import pdf-parse statically for better reliability
let pdfParse: any = null;

const ExtractTextFromPdfInputSchema = z.object({
  pdfDataUri: z.string().describe(
    "A PDF file encoded as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
  ),
  maxSize: z.number().optional().describe('Maximum file size in bytes (default: 10MB)'),
});
export type ExtractTextFromPdfInput = z.infer<typeof ExtractTextFromPdfInputSchema>;

// Enhanced Output Schema with more metadata
const ExtractTextFromPdfOutputSchema = z.object({
  extractedText: z.string().describe('The text content extracted from the PDF.'),
  error: z.string().optional().describe('An error message if text extraction failed.'),
  metadata: z.object({
    pageCount: z.number().optional(),
    title: z.string().optional(),
    author: z.string().optional(),
    subject: z.string().optional(),
    creator: z.string().optional(),
    producer: z.string().optional(),
    creationDate: z.string().optional(),
    modificationDate: z.string().optional(),
    wordCount: z.number().optional(),
    charCount: z.number().optional(),
  }).optional().describe('PDF metadata and statistics'),
  success: z.boolean().describe('Whether the extraction was successful'),
});
export type ExtractTextFromPdfOutput = z.infer<typeof ExtractTextFromPdfOutputSchema>;

// Utility function to initialize pdf-parse
async function initializePdfParse() {
  if (pdfParse) return pdfParse;

  try {
    const pdfParseModule = await import('pdf-parse');
    pdfParse = pdfParseModule.default || pdfParseModule;

    if (typeof pdfParse !== 'function') {
      throw new Error('pdf-parse module did not export a function');
    }

    return pdfParse;
  } catch (error: any) {
    console.error('Failed to load pdf-parse module:', error);
    throw new Error(`Failed to load PDF parsing library: ${error.message}`);
  }
}

// Utility function to validate PDF data URI
function validatePdfDataUri(dataUri: string): { isValid: boolean; error?: string; base64Data?: string } {
  if (!dataUri.startsWith('data:application/pdf;base64,')) {
    return {
      isValid: false,
      error: 'Invalid PDF Data URI format. Expected "data:application/pdf;base64,<data>".'
    };
  }

  const base64Data = dataUri.split(',')[1];
  if (!base64Data) {
    return {
      isValid: false,
      error: 'Invalid PDF Data URI: Missing base64 data.'
    };
  }

  return { isValid: true, base64Data };
}

// Utility function to estimate text statistics
function getTextStatistics(text: string) {
  const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
  const charCount = text.length;
  return { wordCount, charCount };
}

// Export a wrapper function that calls the flow
export async function extractTextFromPdf(input: ExtractTextFromPdfInput): Promise<ExtractTextFromPdfOutput> {
  return extractTextFromPdfFlow(input);
}

const extractTextFromPdfFlow = ai.defineFlow(
  {
    name: 'extractTextFromPdfFlow',
    inputSchema: ExtractTextFromPdfInputSchema,
    outputSchema: ExtractTextFromPdfOutputSchema,
  },
  async (input): Promise<ExtractTextFromPdfOutput> => {
    const maxSize = input.maxSize || 10 * 1024 * 1024; // Default 10MB

    // Initialize pdf-parse
    let pdfParseFunction;
    try {
      pdfParseFunction = await initializePdfParse();
    } catch (error: any) {
      return {
        extractedText: '',
        error: error.message,
        success: false,
      };
    }

    // Validate PDF data URI
    const validation = validatePdfDataUri(input.pdfDataUri);
    if (!validation.isValid) {
      return {
        extractedText: '',
        error: validation.error!,
        success: false,
      };
    }

    try {
      // Convert base64 to buffer
      const pdfBuffer = Buffer.from(validation.base64Data!, 'base64');

      // Check file size
      if (pdfBuffer.length > maxSize) {
        return {
          extractedText: '',
          error: `PDF file too large (${Math.round(pdfBuffer.length / 1024 / 1024)}MB). Maximum allowed: ${Math.round(maxSize / 1024 / 1024)}MB.`,
          success: false,
        };
      }

      // Extract text and metadata
      const data = await pdfParseFunction(pdfBuffer);

      if (!data) {
        return {
          extractedText: '',
          error: 'Failed to parse PDF: No data returned from parser.',
          success: false,
        };
      }

      // Get text content
      const extractedText = data.text || '';

      if (extractedText.trim().length === 0) {
        return {
          extractedText: '',
          error: 'No text content found. PDF might contain only images or be corrupted.',
          success: false,
          metadata: {
            pageCount: data.numpages || 0,
            wordCount: 0,
            charCount: 0,
          },
        };
      }

      // Calculate text statistics
      const { wordCount, charCount } = getTextStatistics(extractedText);

      // Extract metadata
      const metadata = {
        pageCount: data.numpages || undefined,
        title: data.info?.Title || undefined,
        author: data.info?.Author || undefined,
        subject: data.info?.Subject || undefined,
        creator: data.info?.Creator || undefined,
        producer: data.info?.Producer || undefined,
        creationDate: data.info?.CreationDate?.toString() || undefined,
        modificationDate: data.info?.ModDate?.toString() || undefined,
        wordCount,
        charCount,
      };

      return {
        extractedText,
        success: true,
        metadata,
      };

    } catch (error: any) {
      console.error('Error extracting text from PDF:', error);

      // Provide more specific error messages
      let errorMessage = 'Failed to extract text from PDF';

      if (error.message?.includes('Invalid PDF')) {
        errorMessage = 'Invalid PDF file format or corrupted file';
      } else if (error.message?.includes('password')) {
        errorMessage = 'PDF is password protected and cannot be processed';
      } else if (error.message?.includes('memory') || error.message?.includes('allocation')) {
        errorMessage = 'PDF too large or complex to process';
      } else if (error.message) {
        errorMessage = `PDF processing error: ${error.message}`;
      }

      return {
        extractedText: '',
        error: errorMessage,
        success: false,
      };
    }
  }
);

