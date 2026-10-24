// Bento grid — the tile layout from the owner's reference dashboards.
//
// The reference uses a different hue per tile (purple / green / orange / grey).
// PHASE1_BUILD.md §7 says "do not introduce new colors", so the layout is taken
// and the palette is not: a tile's weight comes from its TONE and its SPAN, not
// from a hue picked to look lively. That keeps --alert meaning "something is
// wrong" on a screen whose whole job is showing what is wrong.
//
// Responsive by construction: 2 columns on a phone, 3 on a tablet, 4 up. A tile
// asking for more span than the grid has simply fills the row.

const TONE = {
  // filled: for the one or two tiles that carry the screen
  forest: { fill: 'bg-forest text-cream', label: 'text-cream/70', badge: 'bg-cream/15 text-cream' },
  sand: { fill: 'bg-sand text-forest', label: 'text-forest/70', badge: 'bg-forest/15 text-forest' },
  alert: { fill: 'bg-alert text-cream', label: 'text-cream/80', badge: 'bg-forest/25 text-cream' },
  // quiet: the default, a bordered card
  plain: { fill: 'bg-card text-foreground border border-border', label: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground' }
};

const SPAN = {
  1: 'col-span-1',
  2: 'col-span-2',
  // A tile can be tall as well as wide, which is what makes a bento a bento.
  tall: 'row-span-2'
};

export function BentoGrid({ className = '', children }) {
  return (
    <div className={`grid auto-rows-[minmax(7rem,auto)] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${className}`}>
      {children}
    </div>
  );
}

export function BentoTile({ label, value, badge, foot, tone = 'plain', span = 1, tall = false, href, children }) {
  const t = TONE[tone] || TONE.plain;
  const Tag = href ? 'a' : 'div';
  return (
    <Tag
      {...(href ? { href } : {})}
      className={`flex flex-col justify-between rounded-xl p-4 ${t.fill} ${SPAN[span] || SPAN[1]} ${tall ? SPAN.tall : ''} ${href ? 'transition-opacity hover:opacity-90' : ''}`}
    >
      <div className={`label-mono ${t.label}`}>{label}</div>
      {children || (
        <div className="mt-3">
          <div className="flex items-end gap-2">
            <span className="display-figure text-[2rem] leading-none">{value}</span>
            {badge && <span className={`data-mono rounded-full px-1.5 py-0.5 text-[10px] ${t.badge}`}>{badge}</span>}
          </div>
          {foot && <div className={`mt-1 text-xs ${t.label}`}>{foot}</div>}
        </div>
      )}
    </Tag>
  );
}
