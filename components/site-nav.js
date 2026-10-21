'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { LogOut, User, LayoutDashboard, Briefcase, FileText, Menu, ShieldCheck } from 'lucide-react';

export function openNest() {
  window.dispatchEvent(new Event('nest:open'));
}

const PUBLIC_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' }
];

export default function SiteNav() {
  const [user, setUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setUser(d.user)).catch(() => {});
  }, [pathname]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/');
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">Boro <span className="text-primary">&</span> Nest</span>
          <span className="hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">Collective</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {[...PUBLIC_LINKS, user ? { href: '/dashboard', label: 'Workspace' } : { href: '/join', label: 'Join' }].map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${pathname === l.href ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={openNest}
            className="ml-2 rounded-[20px] border border-[rgba(200,184,154,.38)] bg-[rgba(200,184,154,.11)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[2px] text-[#C8B89A] hover:bg-[rgba(200,184,154,.2)]"
          >
            ✦ Ask Nest →
          </button>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {(user.name || user.email || '?')[0].toUpperCase()}
                  </div>
                  <span className="hidden max-w-[120px] truncate sm:inline">{user.name || user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{user.name || 'Account'}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                  <div className="mt-1 inline-flex rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">{user.role}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.isStaff ? (
                  <DropdownMenuItem asChild><Link href="/admin"><ShieldCheck className="mr-2 h-4 w-4" /> PM Console</Link></DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild><Link href="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" /> Workspace</Link></DropdownMenuItem>
                )}
                {user.role === 'client' && (
                  <DropdownMenuItem asChild><Link href="/book-call"><Briefcase className="mr-2 h-4 w-4" /> Book a Call</Link></DropdownMenuItem>
                )}
                {user.role === 'subcontractor' && (
                  <DropdownMenuItem asChild><Link href="/dashboard/subcontractor"><FileText className="mr-2 h-4 w-4" /> My Jobs</Link></DropdownMenuItem>
                )}
                {!user.isStaff && <DropdownMenuItem asChild><Link href={`/join/${user.role}`}><User className="mr-2 h-4 w-4" /> Edit Profile</Link></DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" /> Log Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/login">Log in</Link></Button>
              <Button asChild size="sm"><Link href="/join">Get Started</Link></Button>
            </>
          )}
          <button className="md:hidden rounded-md p-2 hover:bg-muted" aria-label="Menu" onClick={() => setMobileOpen(v => !v)}>
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="container flex flex-col gap-1 py-3 md:hidden border-t border-border/60">
          {[...PUBLIC_LINKS, user ? { href: '/dashboard', label: 'Workspace' } : { href: '/join', label: 'Join' }].map(l => (
            <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>{l.label}</Link>
          ))}
          <button type="button" onClick={() => { setMobileOpen(false); openNest(); }} className="rounded-md px-3 py-2 text-left text-sm text-[#C8B89A] hover:bg-muted">✦ Ask Nest</button>
        </div>
      )}
    </nav>
  );
}
