
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import AppHeader from '@/components/AppHeader';
import { Providers } from './providers';

const geistSans = GeistSans({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

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
      <body className={`${geistSans.variable} font-sans antialiased`}>
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
