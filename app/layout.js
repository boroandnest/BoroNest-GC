import './globals.css';
import { Toaster } from 'sonner';
import NestChat from '@/components/nest-chat';

export const metadata = {
  title: 'Boro & Nest Collective — NYC Build-Outs, Delivered On Budget',
  description: 'Guaranteed Maximum Price commercial build-outs and residential gut renovations in New York City. Know your ceiling before a nail is driven.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <NestChat />
        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}
