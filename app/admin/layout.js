// Redesign Direction D §8 — console token swap. The `.d-console` class
// (app/globals.css) remaps the existing shadcn variable names to the §1
// palette; every admin component already reads those same variable names,
// so nothing here needs a new layout, new components, or marketing motion.
export default function AdminLayout({ children }) {
  return <div className="d-console">{children}</div>;
}
