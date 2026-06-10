/* eslint-disable new-cap -- next/font factories are PascalCase by design */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import { NO_FLASH_SCRIPT, ThemeProvider } from '@peace/design';
import '@peace/design/styles';
import './_kit/theme.css';
import './globals.css';

// The design system's font tokens map to these; loaded once at the root so the
// whole product inherits them.
const hanken = Hanken_Grotesk({
  subsets : ['latin'],
  variable: '--font-hanken',
  display : 'swap'
});

const mono = JetBrains_Mono({
  subsets : ['latin'],
  variable: '--font-mono',
  display : 'swap'
});

const fraunces = Fraunces({
  subsets : ['latin'],
  variable: '--font-fraunces',
  display : 'swap'
});

export const metadata: Metadata = {
  title      : 'peace',
  description: 'AI participants that turn conversations into evidence-linked artifacts'
};

export default function RootLayout ({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="tron"
      suppressHydrationWarning
      className={`${hanken.variable} ${mono.variable} ${fraunces.variable}`}
    >
      <head>
        {/* Set the theme before paint (no flash of the default). */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="peace-root antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
