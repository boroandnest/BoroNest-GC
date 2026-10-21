// Change-order status chip. --alert is NOT used here: an unsigned CO is a normal state, not a problem.
const LABEL = { draft: 'Draft', pending_signature: 'Awaiting signature', signed: 'Signed', void: 'Void' };
const STYLE = {
  draft: 'border-border text-muted-foreground',
  pending_signature: 'border-[#C8B89A]/60 text-[#C8B89A]',
  signed: 'border-emerald-500/40 text-emerald-400',
  void: 'border-border text-muted-foreground line-through'
};

export default function CoStatus({ status }) {
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[1.5px] ${STYLE[status] || STYLE.draft}`}>{LABEL[status] || status}</span>;
}
