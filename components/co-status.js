import Pill from './brand/pill';

// Change-order status chip. --alert is NOT used here: an unsigned CO is a
// normal state, not a problem.
const LABEL = { draft: 'Draft', pending_signature: 'Awaiting signature', signed: 'Signed', void: 'Void' };
const TONE = { draft: 'neutral', pending_signature: 'warn', signed: 'ok', void: 'neutral' };

export default function CoStatus({ status }) {
  return (
    <Pill tone={TONE[status] || 'neutral'} variant="outline" className={status === 'void' ? 'line-through' : ''}>
      {LABEL[status] || status}
    </Pill>
  );
}
