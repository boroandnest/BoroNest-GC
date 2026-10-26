// Redesign Direction D · BORO_NEST_REDESIGN_BUILD_SPEC.md §1.
// Real type, not a procedural-alphabet component — those draw a-z only and
// silently drop the ampersand. "Boro&Nest" is one word; the & is Newsreader
// italic in --d-brick-lo inside its own span. The visually-hidden text node
// is what screen readers and copy-paste get: "Boro & Nest" with spaces.
// `stroke`: the footer's giant outline treatment — fill goes transparent,
// -webkit-text-stroke draws the letterforms, and the ampersand gets its own
// brick-tinted stroke color rather than inheriting ivory.
export default function Wordmark({ as: Tag = 'span', className = '', style, stroke = false, ...rest }) {
  const base = { fontFamily: 'var(--font-archivo)' };
  const wordStyle = stroke ? { ...base, color: 'transparent', WebkitTextStroke: style?.WebkitTextStroke || '1px var(--d-ivory)' } : base;
  const ampStyle = {
    fontFamily: 'var(--font-newsreader)',
    fontStyle: 'italic',
    ...(stroke
      ? { color: 'transparent', WebkitTextStroke: style?.WebkitTextStroke?.replace('var(--d-ivory)', 'var(--d-brick-lo)') || '1px var(--d-brick-lo)' }
      : { color: 'var(--d-brick-lo)' })
  };

  return (
    <Tag className={className} style={style} {...rest}>
      <span aria-hidden="true" style={wordStyle}>
        Boro
        <span className="amp" style={ampStyle}>&amp;</span>
        Nest
      </span>
      <span className="sr-only">Boro &amp; Nest</span>
    </Tag>
  );
}
