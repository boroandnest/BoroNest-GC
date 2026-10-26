import Link from 'next/link';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';

export const metadata = { title: 'Privacy Policy — Boro & Nest Collective' };

// SECURITY_HARDENING.md C5 — placeholder only. The site collects name,
// phone, email, company, insurance certificates and chatbot text with no
// privacy notice anywhere; this closes that gap with real text, but the
// text itself is a draft and needs counsel review before launch.
export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <div className="container max-w-3xl py-16 md:py-24">
        <div className="mb-8 inline-block rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-destructive">
          Draft — for counsel review, not yet legally reviewed
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: placeholder — set on counsel sign-off.</p>

        <div className="prose prose-sm mt-10 max-w-none text-foreground [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_p]:mt-3 [&_p]:text-muted-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:text-muted-foreground">
          <h2>What we collect</h2>
          <p>When you book a call, submit the join form, or request a quote, we collect your name, email, phone number, and company name. Trade partners additionally submit certificates of insurance. If you use the Nest chat widget, we retain your message text.</p>

          <h2>How we use it</h2>
          <ul>
            <li>To respond to your inquiry and schedule calls</li>
            <li>To create and manage your account if you join as a client, partner, or trade</li>
            <li>To verify insurance coverage before assigning work</li>
            <li>To improve the Nest chat assistant</li>
          </ul>

          <h2>AI / chatbot notice</h2>
          <p>The Nest chat widget sends your messages to a third-party language model provider to generate a response. Do not share information you don't want processed by that provider. Nest does not have access to other clients' project data, pricing internals, or margin figures.</p>

          <h2>Sharing</h2>
          <p>We do not sell your data. We share it with subcontractors and trade partners only as needed to staff your project, and with service providers (hosting, email, payments) under standard confidentiality terms.</p>

          <h2>Your rights</h2>
          <p>You can request a copy of your data or ask us to delete it by emailing <a href="mailto:hello@boroandnestnyc.com" className="text-primary underline">hello@boroandnestnyc.com</a>.</p>

          <h2>Contact</h2>
          <p>Boro &amp; Nest Collective — New York City, NY — <a href="mailto:hello@boroandnestnyc.com" className="text-primary underline">hello@boroandnestnyc.com</a></p>
        </div>

        <p className="mt-10 text-sm"><Link href="/terms" className="text-primary underline">Terms of Service →</Link></p>
      </div>
      <SiteFooter />
    </>
  );
}
