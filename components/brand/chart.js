'use client';

// Area trend with a hover tooltip — the second reference dashboard.
//
// recharts is already a dependency, so this adds none. Brand palette only:
// forest for the primary series, sand for the secondary, alert reserved for a
// series that represents a breach (a threshold line, an overdue count).
//
// The component FORMATS, it does not compute. `data` arrives from the server
// with every value already reduced to a number for plotting and a preformatted
// string for display — the same rule the money screens follow, extended to
// counts and dates because they drift the same way (docs/PHASE3_REVIEW.md §D3).

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const SERIES_COLOR = {
  forest: 'hsl(var(--forest))',
  sand: 'hsl(var(--sand))',
  alert: 'hsl(var(--alert))'
};

function BrandTooltip({ active, payload, label, series }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
      <div className="label-mono text-muted-foreground">{label}</div>
      <div className="mt-2 space-y-1">
        {payload.map(p => {
          const s = series.find(x => x.key === p.dataKey);
          return (
            <div key={p.dataKey} className="flex items-center justify-between gap-6 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLOR[s?.tone] || SERIES_COLOR.forest }} />
                <span className="text-muted-foreground">{s?.label || p.dataKey}</span>
              </span>
              {/* The row carries its own formatted string; the chart never formats a value itself. */}
              <span className="data-mono font-medium">{p.payload[`${p.dataKey}Label`] ?? p.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AreaTrend({ data = [], series = [], xKey = 'label', threshold, height = 240, empty = 'No history yet.' }) {
  if (!data.length) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{empty}</div>;
  }
  return (
    // ResponsiveContainer is what makes this work at phone width; the parent
    // only has to give it a width.
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLOR[s.tone] || SERIES_COLOR.forest} stopOpacity={0.28} />
              <stop offset="100%" stopColor={SERIES_COLOR[s.tone] || SERIES_COLOR.forest} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          // Headroom, so the top series is not drawn flush against the frame
          // and a rise in the latest period is still visible.
          domain={[0, (max) => Math.max(1, Math.ceil(max * 1.15))]}
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip content={<BrandTooltip series={series} />} cursor={{ stroke: 'hsl(var(--sand))', strokeDasharray: '4 4' }} />
        {threshold !== undefined && threshold !== null && (
          // A threshold is the one place --alert belongs on a chart: crossing it
          // is a real breach, not a trend.
          <ReferenceLine
            y={threshold.value}
            stroke={SERIES_COLOR.alert}
            strokeDasharray="5 4"
            label={{ value: threshold.label, position: 'insideTopRight', fontSize: 10, fill: SERIES_COLOR.alert }}
          />
        )}
        {series.map(s => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={SERIES_COLOR[s.tone] || SERIES_COLOR.forest}
            strokeWidth={2}
            fill={`url(#fill-${s.key})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default AreaTrend;
