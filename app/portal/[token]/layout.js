// SECURITY_HARDENING.md A2 — a guessed/leaked token shouldn't also be
// findable through search. The page itself is a client component, so this
// sibling server layout is what actually emits the meta tag.
export const metadata = { robots: 'noindex, nofollow' };

export default function PortalLayout({ children }) {
  return children;
}
