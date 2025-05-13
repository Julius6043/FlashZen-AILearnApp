'use client';

import { BrainCircuit } from 'lucide-react';
import Link from 'next/link';

export default function AppHeader() {
  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-primary hover:text-primary/90 transition-colors">
          <BrainCircuit className="h-7 w-7" />
          <span>FlashZen</span>
        </Link>
        {/* Future navigation items can go here */}
      </div>
    </header>
  );
}
