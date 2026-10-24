'use client';

// Monthly obligation calendar — the "heatmap calendar" from the reference set,
// rebuilt around what this business actually tracks: dated obligations.
//
// A heatmap of activity would be decoration here. What a PM needs to see is
// which days carry a deadline and how bad it is, so a cell's tone is the worst
// severity falling on that day, not a count gradient. Severity comes from the
// server (lib/admin/console.js) — the calendar never decides that a thing is
// a problem, the same rule the attention list follows.

import { useState } from 'react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const CELL = {
  problem: 'bg-alert/85 text-cream hover:bg-alert',
  warn: 'bg-sand text-forest hover:bg-sand/80',
  ok: 'bg-forest/15 text-forest hover:bg-forest/25',
  none: 'bg-transparent text-muted-foreground hover:bg-muted'
};
const RANK = { problem: 3, warn: 2, ok: 1, none: 0 };

// Dates are plain 'YYYY-MM-DD' strings throughout the app; parsing them with
// `new Date(s)` would shift them by the viewer's timezone and silently move a
// deadline a day. Split instead.
const parts = (iso) => iso.split('-').map(Number);

export function MonthlyObligations({ month, days = [], onSelect }) {
  const [open, setOpen] = useState(null);
  const [y, m] = parts(`${month}-01`);

  // Monday-first grid.
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDate = new Map(days.map(d => [d.date, d]));

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);

  const selected = open ? byDate.get(open) : null;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <div className="label-mono text-muted-foreground">{MONTHS[m - 1]} {y}</div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-alert/85" /> Overdue</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-sand" /> Due</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-forest/15" /> Scheduled</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DOW.map((d, i) => <div key={i} className="label-mono pb-1 text-center text-muted-foreground">{d}</div>)}
        {cells.map((iso, i) => {
          if (!iso) return <div key={`pad-${i}`} />;
          const day = byDate.get(iso);
          const tone = day ? day.items.reduce((a, it) => (RANK[it.severity] > RANK[a] ? it.severity : a), 'ok') : 'none';
          const n = day?.items.length || 0;
          return (
            <button
              key={iso}
              type="button"
              disabled={!n}
              onClick={() => { setOpen(open === iso ? null : iso); onSelect?.(iso, day); }}
              aria-label={n ? `${iso}: ${n} item${n === 1 ? '' : 's'}` : iso}
              className={`relative aspect-square rounded-md text-xs transition-colors ${CELL[tone]} ${open === iso ? 'ring-2 ring-forest' : ''} ${n ? 'cursor-pointer font-medium' : 'cursor-default'}`}
            >
              <span className="data-mono">{Number(iso.slice(-2))}</span>
              {n > 1 && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] opacity-80">{n}</span>}
            </button>
          );
        })}
      </div>

      {selected && (
        <ul className="mt-4 space-y-2 border-t border-border pt-3">
          {selected.items.map((it, i) => (
            <li key={i} className="flex items-start justify-between gap-3 text-sm">
              <span>
                <span className={it.severity === 'problem' ? 'text-alert-ink' : it.severity === 'warn' ? 'text-sand-ink' : 'text-forest'}>●</span>{' '}
                {it.title}
              </span>
              {it.href && <a href={it.href} className="shrink-0 text-xs text-muted-foreground underline">Open</a>}
            </li>
          ))}
        </ul>
      )}
      {!days.length && <div className="mt-4 text-sm text-muted-foreground">Nothing dated this month.</div>}
    </div>
  );
}

export default MonthlyObligations;
