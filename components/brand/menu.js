'use client';

// Vertical section menu, and the empty state the reference set builds from its
// invite-member card. Both brand-native, both responsive: the menu is a
// horizontal scroller on a phone and a rail from `md` up, because a fixed
// vertical rail eats half a phone screen.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Pill from './pill';

export function VerticalMenu({ items = [], orientation = 'vertical', className = '' }) {
  const pathname = usePathname();
  return (
    <nav className={`-mx-1 flex gap-1 overflow-x-auto pb-2 ${
      orientation === 'vertical' ? 'md:mx-0 md:flex-col md:overflow-visible md:pb-0' : 'md:mx-0'
    } ${className}`}>
      {items.map(it => {
        const active = pathname === it.href || (it.href !== '/admin' && pathname?.startsWith(it.href));
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors md:shrink ${
              active ? 'bg-forest text-cream' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span className="whitespace-nowrap">{it.label}</span>
            {/* A count only earns a tone when the server says it is a problem. */}
            {it.count ? (
              <Pill tone={it.tone || 'neutral'} variant={active ? 'solid' : 'tint'}>{it.count}</Pill>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

// Empty state. The reference stacks member avatars; here the media slot takes
// whatever the surface has — avatars, an icon, nothing.
export function EmptyState({ media, title, description, action, className = '' }) {
  return (
    <div className={`flex min-h-48 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border p-8 text-center ${className}`}>
      {media && <div className="flex items-center justify-center">{media}</div>}
      <div className="max-w-sm">
        <div className="text-base font-medium">{title}</div>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {action}
    </div>
  );
}

// Overlapping avatar stack, as in the reference's invite card.
export function AvatarStack({ people = [], max = 4 }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((p, i) => (
        <span
          key={i}
          title={p.name || p.email}
          className="grid h-10 w-10 place-items-center rounded-full border-2 border-card bg-forest text-xs font-semibold text-cream"
        >
          {(p.name || p.email || '?').trim()[0].toUpperCase()}
        </span>
      ))}
      {rest > 0 && (
        <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-card bg-muted text-xs font-medium text-muted-foreground">
          +{rest}
        </span>
      )}
    </div>
  );
}
