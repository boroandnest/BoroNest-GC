import Link from 'next/link';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';

export const metadata = { title: 'Terms of Service — Boro & Nest Collective' };

// SECURITY_HARDENING.md C5 — placeholder only, needs counsel review.
export default function TermsPage() {
  return (
    <>
      <SiteNav />
      <div className="container max-w-3xl py-16 md:py-24">
        <div className="mb-8 inline-block rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-destructive">
          Draft — for counsel review, not yet legally reviewed
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: placeholder — set on counsel sign-off.</p>

        <div className="prose prose-sm mt-10 max-w-none text-foreground [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_p]:mt-3 [&_p]:text-muted-foreground">
          <h2>Using this site</h2>
          <p>This site lets you request a Guaranteed Maximum Price estimate, book a scoping call, and apply to join as a client, management company, building rep, expediter, or subcontractor. Figures shown before a signed contract are estimates, not binding offers.</p>

          <h2>Accounts</h2>
          <p>Account access is granted by role. Staff accounts are never created through the public join form. We may suspend an account for misuse, including attempts to access another account's or project's data.</p>

          <h2>Nest chat assistant</h2>
          <p>Nest is an automated assistant for pre-sale questions. Its responses are informational, not a quote, a legal opinion, or a binding commitment. A Boro &amp; Nest project manager confirms all project-specific figures.</p>

          <h2>Limitation of liability</h2>
          <p>Placeholder clause — to be drafted by counsel for the applicable jurisdiction.</p>

          <h2>Contact</h2>
          <p>Boro &amp; Nest Collective — New York City, NY — <a href="mailto:hello@boroandnestnyc.com" className="text-primary underline">hello@boroandnestnyc.com</a></p>
        </div>

        <p className="mt-10 text-sm"><Link href="/privacy" className="text-primary underline">Privacy Policy →</Link></p>
      </div>
      <SiteFooter />
    </>
  );
}
