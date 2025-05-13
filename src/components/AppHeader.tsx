
'use client';

import { BrainCircuit, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import * as React from 'react';

export default function AppHeader() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-primary hover:text-primary/90 transition-colors">
          <BrainCircuit className="h-7 w-7" />
          <span>FlashZen</span>
        </Link>
        
        {mounted && (
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        )}
      </div>
    </header>
  );
}
