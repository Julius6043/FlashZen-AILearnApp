'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Set up PDF.js worker - use local worker file
if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

interface PDFViewerProps {
    pdfDataUri: string;
    className?: string;
    showControls?: boolean;
    maxHeight?: string | number;
    onLoadSuccess?: (info: { numPages: number }) => void;
    onLoadError?: (error: Error) => void;
}

export function PDFViewer({
    pdfDataUri,
    className,
    showControls = true,
    maxHeight = 400,
    onLoadSuccess,
    onLoadError
}: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [rotation, setRotation] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setIsLoading(false);
        setError(null);
        onLoadSuccess?.({ numPages });
    }, [onLoadSuccess]);

    const onDocumentLoadError = useCallback((error: Error) => {
        setIsLoading(false);
        setError('Failed to load PDF document');
        console.error('PDF load error:', error);
        onLoadError?.(error);
    }, [onLoadError]);

    const goToPrevPage = () => {
        setPageNumber(prev => Math.max(1, prev - 1));
    };

    const goToNextPage = () => {
        setPageNumber(prev => Math.min(numPages || 1, prev + 1));
    };

    const zoomIn = () => {
        setScale(prev => Math.min(3.0, prev + 0.25));
    };

    const zoomOut = () => {
        setScale(prev => Math.max(0.5, prev - 0.25));
    };

    const rotate = () => {
        setRotation(prev => (prev + 90) % 360);
    };

    const toggleExpanded = () => {
        setIsExpanded(prev => !prev);
    };

    if (error) {
        return (
            <div className={cn("border border-destructive/20 rounded-lg p-4 bg-destructive/5", className)}>
                <p className="text-destructive text-sm font-medium">PDF Viewer Error</p>
                <p className="text-destructive/80 text-xs mt-1">{error}</p>
            </div>
        );
    }

    const viewerHeight = isExpanded ? '80vh' : maxHeight;

    return (
        <div className={cn("border border-border rounded-lg overflow-hidden bg-background", className)}>
            {showControls && (
                <div className="border-b border-border p-2 bg-muted/30">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={goToPrevPage}
                                disabled={pageNumber <= 1 || isLoading}
                                className="h-8 px-2"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-medium px-2 min-w-fit">
                                {isLoading ? '...' : `${pageNumber} / ${numPages || 0}`}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={goToNextPage}
                                disabled={pageNumber >= (numPages || 1) || isLoading}
                                className="h-8 px-2"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={zoomOut}
                                disabled={scale <= 0.5 || isLoading}
                                className="h-8 px-2"
                            >
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-medium px-2 min-w-fit">
                                {Math.round(scale * 100)}%
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={zoomIn}
                                disabled={scale >= 3.0 || isLoading}
                                className="h-8 px-2"
                            >
                                <ZoomIn className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={rotate}
                                disabled={isLoading}
                                className="h-8 px-2"
                            >
                                <RotateCw className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleExpanded}
                                disabled={isLoading}
                                className="h-8 px-2"
                            >
                                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div
                className="relative"
                style={{ height: viewerHeight }}
            >
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                            <p className="text-sm text-muted-foreground">Loading PDF...</p>
                        </div>
                    </div>
                )}

                <ScrollArea className="h-full">
                    <div className="flex justify-center p-4">
                        <Document
                            file={pdfDataUri}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading=""
                            error=""
                            noData=""
                        >
                            <Page
                                pageNumber={pageNumber}
                                scale={scale}
                                rotate={rotation}
                                loading=""
                                error=""
                                noData=""
                                renderAnnotationLayer={false}
                                renderTextLayer={false}
                                className="shadow-lg"
                            />
                        </Document>
                    </div>
                </ScrollArea>
            </div>

            {showControls && numPages && numPages > 1 && (
                <div className="border-t border-border p-2 bg-muted/30">
                    <div className="flex justify-center">
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(numPages, 10) }, (_, i) => i + 1).map((page) => (
                                <Button
                                    key={page}
                                    variant={page === pageNumber ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setPageNumber(page)}
                                    disabled={isLoading}
                                    className="h-7 w-8 text-xs"
                                >
                                    {page}
                                </Button>
                            ))}
                            {numPages > 10 && (
                                <span className="text-xs text-muted-foreground px-2">
                                    ...{numPages}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
