/* eslint-disable new-cap -- next/font factories are PascalCase by design */
import type { ReactNode } from 'react';
import { ThemeProvider, ThemeToggle } from '@peace/design';
import {
  Fraunces,
  Hanken_Grotesk,
  JetBrains_Mono,
  Newsreader,
  Sora,
  Unbounded
} from 'next/font/google';
import '@peace/design/styles';
import '../_kit/theme.css';

/*
 * Fonts for the design-direction mockups. Each direction reaches for a
 * different pairing via these CSS variables; loading them all here (self-hosted
 * by next/font, no runtime Google request) keeps each page a pure style sheet.
 * Mockup-only — the real app's font strategy is decided when D3 lands.
 */

const hanken = Hanken_Grotesk({
  subsets : ['latin'],
  variable: '--font-hanken',
  display : 'swap'
});

const newsreader = Newsreader({
  subsets : ['latin'],
  variable: '--font-newsreader',
  display : 'swap',
  style   : ['normal', 'italic']
});

const fraunces = Fraunces({
  subsets : ['latin'],
  variable: '--font-fraunces',
  display : 'swap',
  style   : ['normal', 'italic']
});

const sora = Sora({
  subsets : ['latin'],
  variable: '--font-sora',
  display : 'swap'
});

const unbounded = Unbounded({
  subsets : ['latin'],
  variable: '--font-unbounded',
  display : 'swap'
});

const mono = JetBrains_Mono({
  subsets : ['latin'],
  variable: '--font-mono',
  display : 'swap'
});

export default function MockupsLayout ({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <div className={`${hanken.variable} ${newsreader.variable} ${fraunces.variable} ${sora.variable} ${unbounded.variable} ${mono.variable} h-full`}>
        {children}
        <ThemeToggle className="fixed bottom-4 right-4 z-[2000] rounded-md border border-white/25 bg-black/60 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-white/85 backdrop-blur transition-colors hover:text-white" />
      </div>
    </ThemeProvider>
  );
}
