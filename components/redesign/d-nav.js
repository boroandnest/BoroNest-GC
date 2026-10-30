'use client';

// BORO_NEST_UI_FIX_PLAN_4.md F1 — the transparent-over-hero state measured
// 1.30:1 (link text) / 2.06:1 (wordmark) against the cream it painted at
// scroll 0, both well under WCAG AA. One skin, always dark: no transparent
// variant, no scroll listener, nothing that can drift back into this bug.
import Link from 'next/link';
import Wordmark from '@/components/brand/wordmark';

// Work/Process point at homepage anchors (work strip, sticky phases) — on a
// page without those sections the browser just scrolls to top.
const LINKS = [
  { href: '/#work', label: 'Work' },
  { href: '/services', label: 'Services' },
  { href: '/#process', label: 'Process' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/dashboard', label: 'Workspace' }
];

export default function DNav() {
  return (
    <nav className="sticky top-0 z-40 bg-[var(--d-forest-3)]" style={{ fontFamily: 'var(--font-archivo)' }}>
      <div className="container flex h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2 max-[960px]:h-auto">
        <Link href="/" className="shrink-0">
          <Wordmark className="text-xl font-bold tracking-tight text-[var(--d-ivory)]" />
        </Link>

        <div className="flex flex-wrap items-center gap-1 max-[960px]:basis-full max-[960px]:justify-start">
          {LINKS.map((l, i) => (
            <Link
              key={`${l.href}-${i}`}
              href={l.href}
              className="group relative px-3 py-2 text-sm text-[var(--d-ivory)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-brick)]"
            >
              {l.label}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-3 bottom-1 h-[2px] origin-left scale-x-0 bg-[var(--d-brick)] transition-transform duration-[180ms] ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
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
