// T31 · Builds a deck's content from live data. Pure — it takes what the route
// loaded and returns what the public page renders.
//
// Content is projected at VIEW time, never stored on the presentation. A deck
// is a view of current records, so a corrected violation count or a superseded
// quote shows through instead of living on inside a snapshot somebody shared
// three weeks ago.

import { SECTIONS, sectionsFor, scrub } from './sections.js';
import { figure, allLabelled, mixSummary, SavingsError } from '../savings.js';
import { formatMoney } from '../format.js';

const money = (v) => formatMoney(v);

export function buildDeck({ presentation, project = null, scopeLines = [], variance = null, density = null, portfolio = null }) {
  const kind = presentation.kind;
  const allowed = new Set(sectionsFor(kind));
  // A section the audience may not see is never built. Dropping it here rather
  // than hiding it in the page means there is no payload to leak.
  const keys = (presentation.sections || []).filter(k => allowed.has(k));

  const manual = (presentation.manualFigures || []).map(f => figure(f));
  const figures = [];
  const sections = [];

  for (const key of keys) {
    const def = SECTIONS[key];
    const body = buildSection(key, { project, scopeLines, variance, density, portfolio, manual });
    if (!body) continue;
    if (body.figures) figures.push(...body.figures);
    sections.push({ key, title: def.title, ...body });
  }

  return scrub({
    kind,
    title: presentation.title,
    // An owner deck names the project; a partner deck must not.
    subject: kind === 'owner' && project ? { code: project.code || null, name: project.name } : null,
    sections,
    // One line at the top of every deck, so a reader cannot take a total as cash.
    claimSummary: mixSummary(figures),
    notes: presentation.notes || null,
    generatedAt: new Date().toISOString()
  });
}

function buildSection(key, ctx) {
  const { project, scopeLines, variance, density, portfolio, manual } = ctx;
  const pick = (...labels) => manual.filter(f => labels.includes(f.caption));

  switch (key) {
    case 'scope_of_work': {
      if (!scopeLines.length) return null;
      // Titles and trades only. No unit costs: a deck is not a bid sheet, and
      // a sub's pricing is not the owner's to circulate.
      const byTrade = new Map();
      for (const l of scopeLines) {
        if (!byTrade.has(l.trade)) byTrade.set(l.trade, []);
        byTrade.get(l.trade).push(l.title);
      }
      return { trades: [...byTrade.entries()].map(([trade, items]) => ({ trade, items })) };
    }

    case 'cost_position': {
      if (!variance?.vsRevised) return null;
      const v = variance.vsRevised;
      // Measured against what was agreed, from our own records.
      const f = figure({
        amount: v.abs,
        label: 'observed',
        caption: v.over ? 'Over the agreed baseline' : 'Under the agreed baseline'
      });
      return {
        baseline: money(v.baseline),
        live: money(v.live),
        over: v.over,
        intent: v.intent,
        pct: v.pct,
        quotedAt: variance.quote?.quotedAt || null,
        figures: [f],
        lines: [
          `Quoted ${money(variance.quote?.amount)} after the site visit${variance.quote?.quotedAt ? ` on ${variance.quote.quotedAt}` : ''}.`,
          variance.ceilingAdjustments !== '0.00'
            ? `${money(variance.ceilingAdjustments)} of signed change orders you approved raised the agreed figure to ${money(v.baseline)}.`
            : 'No signed change orders have moved that figure.',
          `Spent to date ${money(v.live)} — ${v.over ? 'over' : 'under'} by ${money(v.abs)}.`
        ]
      };
    }

    case 'time_and_money_saved': {
      // Anything comparing us to a competitor is supplied, not measured: we do
      // not hold their numbers. It stays whatever label staff gave it, and the
      // basis is mandatory.
      const supplied = pick('Versus a conventional GC', 'Time saved', 'Money saved');
      const out = [];
      if (variance?.vsRevised && !variance.vsRevised.over) {
        out.push(figure({ amount: variance.vsRevised.abs, label: 'observed', caption: 'Under the agreed baseline' }));
      }
      if (variance?.schedule?.known && variance.schedule.deltaDays < 0) {
        out.push({ days: variance.schedule.absDays, label: 'observed', labelText: 'Observed', caption: 'Days ahead of the agreed schedule', verified: true, tone: 'ok' });
      }
      out.push(...supplied);
      if (!out.length) return null;
      return { figures: out.filter(f => f.amount), items: out };
    }

    case 'arv': {
      const items = manual.filter(f => /ARV|value|rent/i.test(f.caption || ''));
      if (!items.length) return null;
      return { figures: items, items };
    }

    case 'fines_avoided': {
      const items = manual.filter(f => /fine|penalty|violation|enforcement/i.test(f.caption || ''));
      if (!items.length && !density) return null;
      return {
        figures: items,
        items,
        density: density
          ? {
              openViolations: density.openViolations,
              awaitingClosure: density.awaitingClosure,
              density: density.density,
              aepStatus: density.aepStatus
            }
          : null
      };
    }

    case 'compliance_posture': {
      if (!density) return null;
      return {
        density: density.density,
        aepStatus: density.aepStatus,
        openViolations: density.openViolations,
        awaitingClosure: density.awaitingClosure,
        note: density.aepStatus === 'unknown'
          ? 'No unit count on file, so no density is claimed.'
          : `${density.awaitingClosure} violations are fixed and waiting on HPD to close them. Those still count against the building until the agency closes them.`
      };
    }

    // ---- partner sections: shape, never a client ----------------------------
    case 'track_record': {
      if (!portfolio) return null;
      return {
        projects: portfolio.projects,
        buildings: portfolio.buildings,
        boroughs: portfolio.boroughs,
        note: 'Counts only. Individual projects, clients and figures are not shown.'
      };
    }

    case 'capability':
      return { items: [
        'Guaranteed Maximum Price contracts with the ceiling fixed before work starts',
        'Insurance compliance held per building, per unit, with assignment blocked until a certificate verifies',
        'HPD and FISP violation tracking through to agency closure, not just work completion',
        'Milestone payments released to trades against verified work'
      ] };

    case 'how_we_price':
      return { items: [
        'A number after the site visit, recorded and frozen.',
        'A GMP worksheet built from parametric templates, priced line by line.',
        'Change orders signed before the work they cover starts.',
        'Every figure traceable to the record that produced it.'
      ] };

    default:
      return null;
  }
}

export { SavingsError, allLabelled };
