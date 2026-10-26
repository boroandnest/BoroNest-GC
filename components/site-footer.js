import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-background">
      <div className="container grid gap-8 py-12 md:grid-cols-4">
        <div>
          <div className="text-lg font-bold tracking-tight">Boro <span className="text-primary">&</span> Nest</div>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">Guaranteed Maximum Price build-outs & LL11/LL97 compliance for New York City.</p>
        </div>
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Platform</div>
          <ul className="space-y-2 text-sm">
            <li><Link href="/services" className="hover:text-primary">Services</Link></li>
            <li><Link href="/about" className="hover:text-primary">About</Link></li>
            <li><Link href="/join" className="hover:text-primary">Join</Link></li>
            <li><Link href="/book-call" className="hover:text-primary">Book a Call</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">For Trade Pros</div>
          <ul className="space-y-2 text-sm">
            <li><Link href="/join/subcontractor" className="hover:text-primary">Apply as Sub</Link></li>
            <li><Link href="/join/expediter" className="hover:text-primary">Apply as Expediter</Link></li>
            <li><Link href="/join/building-rep" className="hover:text-primary">Building Reps</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Contact</div>
          <p className="text-sm text-muted-foreground">New York City, NY</p>
          <p className="text-sm text-muted-foreground">hello@boroandnestnyc.com</p>
        </div>
      </div>
      <div className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Boro & Nest Collective. All rights reserved.</p>
        <p className="mt-1 flex items-center justify-center gap-3">
          <Link href="/privacy" className="hover:text-primary">Privacy Policy</Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms" className="hover:text-primary">Terms of Service</Link>
        </p>
      </div>
    </footer>
  );
}
