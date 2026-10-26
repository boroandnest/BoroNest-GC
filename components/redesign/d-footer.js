import Link from 'next/link';
import Wordmark from '@/components/brand/wordmark';
import DMarquee from '@/components/redesign/d-marquee';

// Redesign Direction D · BORO_NEST_REDESIGN_BUILD_SPEC.md §2.
export default function DFooter() {
  return (
    <footer className="relative overflow-hidden bg-[var(--d-forest-3)] text-[var(--d-ivory)]">
      {/* Radial brick glow — decorative only, never intercepts input. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/3 rounded-full"
        style={{ background: 'var(--d-brick)', opacity: 0.25, filter: 'blur(60px)' }}
      />

      <div className="relative -rotate-[1.4deg] border-y border-[var(--d-hair)] py-3">
        <DMarquee speed={28}>
          <span className="px-8 text-sm uppercase tracking-[0.2em]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
            Ready to begin?
          </span>
        </DMarquee>
      </div>

      <div className="relative container flex flex-wrap items-center justify-center gap-4 py-10">
        <Link
          href="/book-call"
          className="rounded-full bg-[var(--d-brick)] px-6 py-3 text-sm font-semibold text-[var(--d-ivory)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ivory)]"
          style={{ minHeight: 48 }}
        >
          Start a Project
        </Link>
        <Link
          href="/pricing"
          className="rounded-full border border-[var(--d-hair)] px-6 py-3 text-sm font-semibold text-[var(--d-ivory)] transition-colors hover:bg-[var(--d-forest-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ivory)]"
          style={{ minHeight: 48 }}
        >
          See Pricing
        </Link>
      </div>

      <div className="relative flex justify-center overflow-hidden px-6 pb-6">
        <Wordmark
          as="div"
          stroke
          className="select-none text-center font-[900] leading-none"
          style={{ fontSize: 'clamp(96px, 13.4vw, 193px)', WebkitTextStroke: '1px var(--d-ivory)' }}
        />
      </div>

      <div className="relative container flex flex-col items-center gap-2 pb-10 text-xs text-[var(--d-sage)]">
        <nav className="flex flex-wrap justify-center gap-4" style={{ fontFamily: 'var(--font-plex-mono)' }}>
          <Link href="/services" className="hover:text-[var(--d-ivory)]">Services</Link>
          <Link href="/pricing" className="hover:text-[var(--d-ivory)]">Pricing</Link>
          <Link href="/about" className="hover:text-[var(--d-ivory)]">About</Link>
          <Link href="/join" className="hover:text-[var(--d-ivory)]">Join</Link>
          <Link href="/login" className="hover:text-[var(--d-ivory)]">Workspace</Link>
        </nav>
        <p>&copy; {new Date().getFullYear()} Boro &amp; Nest Collective. NYC build-outs, delivered on budget.</p>
      </div>
    </footer>
  );
}
