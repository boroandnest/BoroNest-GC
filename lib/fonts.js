// Redesign Direction D · Build Spec §1. next/font only — self-hosted at
// build time, zero runtime third-party requests. Keep this separate from
// the Inter/Playfair/JetBrains Mono stack in app/globals.css (still used by
// /admin, the project room and the partner portal until §8 swaps them too).
import { Archivo, Newsreader, IBM_Plex_Mono } from 'next/font/google';

export const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-archivo',
  display: 'swap'
});

// display:'block' here, not 'swap' — Build Spec §3: the letter-window
// headline paints over a panning photo and a mid-animation font swap pops
// the glyphs at the wrong weight.
export const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'block'
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap'
});
