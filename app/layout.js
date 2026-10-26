import './globals.css';
import { Toaster } from 'sonner';
import NestChat from '@/components/nest-chat';
import { archivo, newsreader, plexMono } from '@/lib/fonts';

export const metadata = {
  title: 'Boro & Nest Collective — NYC Build-Outs, Delivered On Budget',
  description: 'Guaranteed Maximum Price commercial build-outs and residential gut renovations in New York City. Know your ceiling before a nail is driven.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${archivo.variable} ${newsreader.variable} ${plexMono.variable}`}>
      {/* Redesign Direction D fonts are exposed as CSS vars here but not
          applied to html/body font-family — /admin and every page not yet
          migrated keeps rendering in the existing Inter/Playfair stack
          (app/globals.css). Only redesigned components reference --font-archivo
          etc. directly. */}
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <NestChat />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
