// Redesign Direction D §8 — console token swap, same as app/admin/layout.js.
// The project room is /projects/[id] and its sub-routes (billing, changes,
// insurance); this layout wraps all of them since Next.js layouts apply to
// every nested route under the same segment.
export default function ProjectRoomLayout({ children }) {
  return <div className="d-console">{children}</div>;
}
