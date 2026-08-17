import { Link } from 'react-router-dom';
import { LABELS, type Project } from '../data/types';

const fmt = (d: Date | null) =>
  d ? d.toISOString().slice(0, 10) : '—';

const statusTone: Record<string, string> = {
  active: 'border-[var(--color-accent)] text-[var(--color-accent)]',
  maintenance: 'border-[var(--color-rule-strong)] text-[var(--color-ink-2)]',
  archived: 'border-[var(--color-rule)] text-[var(--color-ink-3)]',
};

export type SortKey = 'name' | 'host' | 'frontend' | 'database' | 'status' | 'updatedAt';

export function ProjectTable({
  projects, sort, dir, onSort,
}: {
  projects: Project[];
  sort: SortKey;
  dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
}) {
  const Th = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => {
    const active = sort === k;
    return (
      // aria-sort belongs on the header CELL, not on the button inside it. On a <button> it is
      // not a valid attribute and assistive technology reports no sort state at all.
      <th
        scope="col"
        aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`sticky top-0 z-10 bg-[var(--color-paper)] px-3 py-2 text-left font-mono text-xs font-medium uppercase tracking-wide ${className}`}
      >
        <button
          type="button"
          onClick={() => onSort(k)}
          className={`hover:text-[var(--color-ink)] ${active ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-3)]'}`}
        >
          {children}
          <span aria-hidden="true">{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
        </button>
      </th>
    );
  };

  return (
    <div className="overflow-x-auto border border-[var(--color-rule)]">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Projects</caption>
        <thead>
          <tr className="border-b border-[var(--color-rule)]">
            <Th k="name">Project</Th>
            <Th k="host" className="hidden md:table-cell">Host</Th>
            <Th k="frontend" className="hidden lg:table-cell">Frontend</Th>
            <Th k="database" className="hidden lg:table-cell">Database</Th>
            <Th k="status">Status</Th>
            <Th k="updatedAt" className="hidden sm:table-cell">Updated</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-rule)]">
          {projects.map((p) => (
            <tr key={p.id} className="hover:bg-[var(--color-paper-2)]">
              <td className="px-3 py-2">
                <Link to={`/${p.id}`} className="block focus-visible:underline">
                  <span className="block max-w-[28ch] truncate text-[var(--color-ink)]" title={p.name}>
                    {p.name || '(untitled)'}
                  </span>
                  <span className="block max-w-[28ch] truncate font-mono text-xs text-[var(--color-ink-3)]" title={p.domain}>
                    {p.domain}
                  </span>
                </Link>
              </td>
              <td className="hidden px-3 py-2 text-[var(--color-ink-2)] md:table-cell">{LABELS.host[p.host]}</td>
              <td className="hidden px-3 py-2 text-[var(--color-ink-2)] lg:table-cell">{LABELS.frontend[p.frontend]}</td>
              <td className="hidden px-3 py-2 text-[var(--color-ink-2)] lg:table-cell">{LABELS.database[p.database]}</td>
              <td className="px-3 py-2">
                <span className={`border px-2 py-0.5 font-mono text-xs ${statusTone[p.status]}`}>
                  {LABELS.status[p.status]}
                </span>
              </td>
              <td className="hidden px-3 py-2 font-mono text-xs tabular-nums text-[var(--color-ink-3)] sm:table-cell">
                {fmt(p.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
