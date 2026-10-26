'use client';

// Redesign Direction D · BORO_NEST_REDESIGN_BUILD_SPEC.md §2.
// Marketing + the four public/partner screens only — /admin, the project
// room and the partner portal keep the old <SiteNav/> until §8.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Wordmark from '@/components/brand/wordmark';

// Work/Process point at homepage anchors added in PR 3 (work strip,
// sticky phases) — on a page without those sections the browser just
// scrolls to top, same graceful fallback the old nav's #how-it-works used.
const LINKS = [
  { href: '/#work', label: 'Work' },
  { href: '/services', label: 'Services' },
  { href: '/#process', label: 'Process' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/dashboard', label: 'Workspace' }
];

// `transparent`: only the home page's hero passes this — every other
// redesigned screen has no hero photo behind the nav, so it renders solid
// from the first paint.
export default function DNav({ transparent = false }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [transparent]);

  const solid = !transparent || scrolled;

  return (
    <nav
      className={`sticky top-0 z-40 transition-colors duration-300 ${solid ? 'bg-[var(--d-forest-3)]' : 'bg-transparent'}`}
      style={{ fontFamily: 'var(--font-archivo)' }}
    >
      <div className="container flex h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2 max-[960px]:h-auto">
        <Link href="/" className="shrink-0">
          <Wordmark className="text-xl font-bold tracking-tight text-[var(--d-ivory)]" />
        </Link>

        <div className="flex flex-wrap items-center gap-1 max-[960px]:basis-full max-[960px]:justify-start">
          {LINKS.map((l, i) => (
            <Link
              key={`${l.href}-${i}`}
              href={l.href}
              className="group relative px-3 py-2 text-sm text-[var(--d-mist)] transition-colors hover:text-[var(--d-ivory)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-brick)]"
            >
              {l.label}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-3 bottom-1 h-px origin-left scale-x-0 bg-[var(--d-brick)] transition-transform duration-[180ms] ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
              />
            </Link>
          ))}
        </div>

        <Link
          href="/book-call"
          className="shrink-0 rounded-full bg-[var(--d-brick)] px-5 py-3 text-sm font-semibold text-[var(--d-ivory)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ivory)]"
          style={{ minHeight: 48 }}
        >
          Start a Project
        </Link>
      </div>
    </nav>
  );
}
