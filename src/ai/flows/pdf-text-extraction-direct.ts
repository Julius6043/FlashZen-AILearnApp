'use server';

/**
 * @fileOverview Alternative PDF text extraction without Genkit flow, for better reliability
 */

// Import pdf-parse directly
let pdfParse: any = null;

export interface SimplePdfExtractionInput {
    pdfDataUri: string;
    maxSize?: number;
}

export interface SimplePdfExtractionOutput {
    extractedText: string;
    error?: string;
    success: boolean;
    metadata?: {
        pageCount?: number;
        title?: string;
        author?: string;
        subject?: string;
        creator?: string;
        producer?: string;
        creationDate?: string;
        modificationDate?: string;
        wordCount?: number;
        charCount?: number;
        fileSizeBytes?: number;
    };
}

// Utility function to initialize pdf-parse
async function initializePdfParse() {
    if (pdfParse) return pdfParse;

    try {
        // Try different import methods for better compatibility
        let pdfParseModule;
        try {
            pdfParseModule = await import('pdf-parse');
        } catch {
            // Fallback for different module systems
            pdfParseModule = require('pdf-parse');
        }

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
    if (!dataUri || typeof dataUri !== 'string') {
        return {
            isValid: false,
            error: 'Invalid input: PDF data URI is required and must be a string.'
        };
    }

    if (!dataUri.startsWith('data:application/pdf;base64,')) {
        return {
            isValid: false,
            error: 'Invalid PDF Data URI format. Expected "data:application/pdf;base64,<data>".'
        };
    }

    const base64Data = dataUri.split(',')[1];
    if (!base64Data || base64Data.length === 0) {
        return {
            isValid: false,
            error: 'Invalid PDF Data URI: Missing or empty base64 data.'
        };
    }

    // Basic base64 validation
    try {
        atob(base64Data.substring(0, 100)); // Test decode a small portion
    } catch {
        return {
            isValid: false,
            error: 'Invalid PDF Data URI: Base64 data appears to be corrupted.'
        };
    }

    return { isValid: true, base64Data };
}

// Utility function to estimate text statistics
function getTextStatistics(text: string) {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    const charCount = text.length;
    return { wordCount, charCount };
}

// Utility function to safely format dates
function formatDate(dateValue: any): string | undefined {
    if (!dateValue) return undefined;

    try {
        if (dateValue instanceof Date) {
            return dateValue.toISOString();
        }
        if (typeof dateValue === 'string') {
            const date = new Date(dateValue);
            return isNaN(date.getTime()) ? dateValue : date.toISOString();
        }
        return String(dateValue);
    } catch {
        return undefined;
    }
}

/**
 * Alternative PDF text extraction function that works without Genkit flows
 */
export async function extractPdfTextDirect(input: SimplePdfExtractionInput): Promise<SimplePdfExtractionOutput> {
    const maxSize = input.maxSize || 10 * 1024 * 1024; // Default 10MB

    try {
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

        // Convert base64 to buffer
        let pdfBuffer: Buffer;
        try {
            pdfBuffer = Buffer.from(validation.base64Data!, 'base64');
        } catch (error: any) {
            return {
                extractedText: '',
                error: 'Failed to decode PDF data: Invalid base64 encoding.',
                success: false,
            };
        }

        // Check file size
        if (pdfBuffer.length > maxSize) {
            return {
                extractedText: '',
                error: `PDF file too large (${Math.round(pdfBuffer.length / 1024 / 1024)}MB). Maximum allowed: ${Math.round(maxSize / 1024 / 1024)}MB.`,
                success: false,
            };
        }

        // Verify this is actually a PDF by checking the header
        const pdfHeader = pdfBuffer.slice(0, 4);
        if (pdfHeader.toString() !== '%PDF') {
            return {
                extractedText: '',
                error: 'Invalid file format: File does not appear to be a valid PDF.',
                success: false,
            };
        }

        // Extract text and metadata with timeout
        const extractionPromise = pdfParseFunction(pdfBuffer, {
            // Options for pdf-parse
            normalizeWhitespace: true,
            disableCombineTextItems: false,
        });

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('PDF processing timeout (30 seconds)')), 30000);
        });

        const data = await Promise.race([extractionPromise, timeoutPromise]);

        if (!data) {
            return {
                extractedText: '',
                error: 'Failed to parse PDF: No data returned from parser.',
                success: false,
            };
        }

        // Get text content
        const extractedText = (data.text || '').trim();

        if (extractedText.length === 0) {
            return {
                extractedText: '',
                error: 'No text content found. PDF might contain only images, be scanned without OCR, or be corrupted.',
                success: false,
                metadata: {
                    pageCount: data.numpages || 0,
                    wordCount: 0,
                    charCount: 0,
                    fileSizeBytes: pdfBuffer.length,
                },
            };
        }

        // Calculate text statistics
        const { wordCount, charCount } = getTextStatistics(extractedText);

        // Extract metadata safely
        const info = data.info || {};
        const metadata = {
            pageCount: data.numpages || undefined,
            title: info.Title ? String(info.Title).trim() : undefined,
            author: info.Author ? String(info.Author).trim() : undefined,
            subject: info.Subject ? String(info.Subject).trim() : undefined,
            creator: info.Creator ? String(info.Creator).trim() : undefined,
            producer: info.Producer ? String(info.Producer).trim() : undefined,
            creationDate: formatDate(info.CreationDate),
            modificationDate: formatDate(info.ModDate),
            wordCount,
            charCount,
            fileSizeBytes: pdfBuffer.length,
        };

        // Remove empty string values from metadata
        Object.keys(metadata).forEach(key => {
            const value = metadata[key as keyof typeof metadata];
            if (value === '' || value === null || value === undefined) {
                delete metadata[key as keyof typeof metadata];
            }
        });

        return {
            extractedText,
            success: true,
            metadata,
        };

    } catch (error: any) {
        console.error('Error extracting text from PDF:', error);

        // Provide more specific error messages based on error type
        let errorMessage = 'Failed to extract text from PDF';

        if (error.message?.includes('Invalid PDF') || error.message?.includes('PDF header')) {
            errorMessage = 'Invalid PDF file format or corrupted file';
        } else if (error.message?.includes('password') || error.message?.includes('encrypted')) {
            errorMessage = 'PDF is password protected or encrypted and cannot be processed';
        } else if (error.message?.includes('memory') || error.message?.includes('allocation') || error.message?.includes('heap')) {
            errorMessage = 'PDF too large or complex to process in available memory';
        } else if (error.message?.includes('timeout')) {
            errorMessage = 'PDF processing timeout - file may be too complex';
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            errorMessage = 'Network error during PDF processing';
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

/**
 * Fallback function that uses the direct extraction method
 * Can be used as a backup when the Genkit flow fails
 */
export async function extractTextFromPdfFallback(pdfDataUri: string, maxSize?: number): Promise<SimplePdfExtractionOutput> {
    return extractPdfTextDirect({ pdfDataUri, maxSize });
}
