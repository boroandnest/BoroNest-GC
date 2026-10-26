// Redesign Direction D · BORO_NEST_REDESIGN_BUILD_SPEC.md §1.
// Real type, not a procedural-alphabet component — those draw a-z only and
// silently drop the ampersand. "Boro&Nest" is one word; the & is Newsreader
// italic in --d-brick-lo inside its own span. The visually-hidden text node
// is what screen readers and copy-paste get: "Boro & Nest" with spaces.
export default function Wordmark({ as: Tag = 'span', className = '' }) {
  return (
    <Tag className={className}>
      <span aria-hidden="true" style={{ fontFamily: 'var(--font-archivo)' }}>
        Boro
        <span className="amp" style={{ fontFamily: 'var(--font-newsreader)', fontStyle: 'italic', color: 'var(--d-brick-lo)' }}>&amp;</span>
        Nest
      </span>
      <span className="sr-only">Boro &amp; Nest</span>
    </Tag>
  );
}
