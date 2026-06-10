import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NO_FLASH_SCRIPT } from '@peace/design';
import './globals.css';

export const metadata: Metadata = {
  title      : 'peace',
  description: 'AI participants that turn conversations into evidence-linked artifacts'
};

export default function RootLayout ({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="dark"
      data-theme="tron"
      suppressHydrationWarning
    >
      <head>
        {/* Set the theme before paint (no flash of the default). */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="h-full bg-zinc-950 text-zinc-200 antialiased">{children}</body>
    </html>
  );
}
