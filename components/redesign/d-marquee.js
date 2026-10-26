'use client';

// Redesign Direction D · BORO_NEST_REDESIGN_BUILD_SPEC.md §2/§3.
// Content is duplicated exactly once and translated -50% — a seamless loop
// without a visible seam or a third render of the content. Pauses on
// hover AND focus-within (a keyboard user tabbing through it shouldn't
// have to fight motion either). Under prefers-reduced-motion the track
// renders once, statically, no animation.
import { useEffect, useRef, useState } from 'react';

export default function DMarquee({ children, speed = 24, reverse = false, className = '' }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (reduced) {
    return <div className={`flex ${className}`}>{children}</div>;
  }

  return (
    <div className={`d-marquee-track flex w-max ${reverse ? 'd-marquee-reverse' : ''} ${className}`} style={{ '--d-marquee-speed': `${speed}s` }}>
      <div className="flex shrink-0">{children}</div>
      <div aria-hidden="true" className="flex shrink-0">{children}</div>
      <style jsx>{`
        .d-marquee-track {
          animation: d-marquee var(--d-marquee-speed) linear infinite;
        }
        .d-marquee-reverse {
          animation-name: d-marquee-rev;
        }
        .d-marquee-track:hover,
        .d-marquee-track:focus-within {
          animation-play-state: paused;
        }
        @keyframes d-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes d-marquee-rev {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
