// T31 · What a deck is allowed to contain, and for whom. Pure.
//
// The whole design turns on one fact: a presentation goes to someone with NO
// ACCOUNT. There is no session to check, no role to project against. So the
// audience is fixed when the deck is made, and a section that is not on that
// audience's list cannot be rendered at all — it is not filtered late, it is
// never built.
//
// An OWNER deck is about one project, sent to that project's owner. It may
// carry their own money, because it is theirs.
//
// A PARTNER deck goes to someone evaluating B&N, often a competitor's client
// or an investor who will talk to one. It must never identify a client, an
// address, a resident, or any single project's money. Portfolio shape only.

export const SECTIONS = {
  scope_of_work: {
    title: 'Scope of work',
    audiences: ['owner'],
    needs: ['project', 'scopeLines']
  },
  cost_position: {
    title: 'Where the money stands',
    audiences: ['owner'],
    needs: ['variance']
  },
  time_and_money_saved: {
    title: 'Time and money saved',
    audiences: ['owner'],
    needs: ['variance', 'manualFigures']
  },
  arv: {
    title: 'Value after renovation',
    audiences: ['owner'],
    needs: ['manualFigures']
  },
  fines_avoided: {
    title: 'Enforcement exposure avoided',
    audiences: ['owner'],
    needs: ['compliance', 'manualFigures']
  },
  compliance_posture: {
    title: 'Compliance position',
    audiences: ['owner'],
    needs: ['compliance']
  },
  // Partner-facing. Counts and capability, never a client or a figure tied to
  // one.
  track_record: {
    title: 'Track record',
    audiences: ['partner'],
    needs: ['portfolio']
  },
  capability: {
    title: 'What we do',
    audiences: ['partner'],
    needs: []
  },
  how_we_price: {
    title: 'How we price',
    audiences: ['partner'],
    needs: []
  }
};

export const SECTION_KEYS = Object.keys(SECTIONS);

export const sectionsFor = (kind) => SECTION_KEYS.filter(k => SECTIONS[k].audiences.includes(kind));

// Fields that must never appear in any rendered deck payload, at any audience.
// A deck has no viewer identity to gate on, so these are stripped structurally
// rather than trusted to a projection.
export const NEVER_IN_A_DECK = [
  'clientEmail', 'unitContext', 'residentName', 'resident_name', 'resident_phone',
  'shareToken', 'passwordHash', 'tokenHash', 'payeeEmail', 'signatureIp',
  'stripeAccountId', 'stripeTransferId', 'invitedByEmail', 'userEmail'
];

// Belt and braces: walk the built payload and drop anything on the list, so a
// future section that forgets cannot leak by accident.
export function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (NEVER_IN_A_DECK.includes(k)) continue;
      out[k] = scrub(v);
    }
    return out;
  }
  return value;
}
