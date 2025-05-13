
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans'; // Import GeistSans
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import AppHeader from '@/components/AppHeader';
import { Providers } from './providers';

// The imported `GeistSans` from 'geist/font/sans' is already the
// configured font object. It does not need to be called as a function.
// We can use its properties like `GeistSans.variable` directly.

export const metadata: Metadata = {
  title: 'FlashZen',
  description: 'AI Powered Flashcard Generation',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/*
        Apply `GeistSans.variable` as a class name. This class, provided by next/font
        (which geist uses), defines the CSS variable (e.g., --font-geist-sans).
        The `font-sans` Tailwind class should be configured to use this CSS variable,
        or `globals.css` (as it does) can apply `font-family: var(--font-geist-sans)`.
      */}
      <body className={`${GeistSans.variable} font-sans antialiased`}>
        <Providers>
          <AppHeader />
          <main className="container mx-auto p-4 py-8 md:py-12">
            {children}
          </main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
