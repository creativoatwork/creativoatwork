import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { subscribeProjects } from '../data/projects';
import { downloadBackup } from '../data/export';
import type { Project } from '../data/types';
import { ProjectTable, type SortKey } from '../components/ProjectTable';
import { FilterBar, type Filters } from '../components/FilterBar';
import { AddProjectModal } from '../components/AddProjectModal';
import { ImportProjectsModal } from '../components/ImportProjectsModal';
import { ErrorBanner, TableSkeleton, EmptyState } from '../components/States';
import { useAuth } from '../auth/AuthProvider';

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  useEffect(() => {
    setError(null);
    return subscribeProjects(
      (p) => { setProjects(p); setError(null); },
      (e) => setError(e),
    );
  }, []);

  // Filter state lives in the URL so a filtered view is linkable and survives reload.
  const filters: Filters = {
    q: params.get('q') ?? '',
    host: params.get('host') ?? '',
    frontend: params.get('frontend') ?? '',
    database: params.get('database') ?? '',
    status: params.get('status') ?? '',
  };
  const setFilters = (f: Filters) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) next.set(k, v);
    const s = params.get('sort'); const d = params.get('dir');
    if (s) next.set('sort', s);
    if (d) next.set('dir', d);
    setParams(next, { replace: true });
  };

  const sort = (params.get('sort') as SortKey) || 'updatedAt';
  const dir = (params.get('dir') as 'asc' | 'desc') || 'desc';
  const onSort = (k: SortKey) => {
    const next = new URLSearchParams(params);
    next.set('sort', k);
    // Clicking a NEW column starts in the direction that column is usually wanted in: A-Z for
    // text, newest-first for a date. Starting every column descending made a first click on
    // "Project" sort Z-A, which reads as broken rather than as a choice.
    const firstDir = k === 'updatedAt' ? 'desc' : 'asc';
    next.set('dir', sort === k ? (dir === 'asc' ? 'desc' : 'asc') : firstDir);
    setParams(next, { replace: true });
  };

  const shown = useMemo(() => {
    if (!projects) return [];
    const q = filters.q.trim().toLowerCase();
    const out = projects.filter((p) => {
      if (filters.host && p.host !== filters.host) return false;
      if (filters.frontend && p.frontend !== filters.frontend) return false;
      if (filters.database && p.database !== filters.database) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (!q) return true;
      return [p.name, p.domain, p.description, p.notes].some((v) => v.toLowerCase().includes(q));
    });
    // Case-insensitive and number-aware, so "landUSup" files under L and "Project 10" sorts
    // after "Project 9" rather than before it.
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
    const cmp = (a: Project, b: Project) => {
      if (sort === 'updatedAt') {
        return (a.updatedAt?.getTime() ?? 0) - (b.updatedAt?.getTime() ?? 0);
      }
      const av = String(a[sort] ?? '');
      const bv = String(b[sort] ?? '');
      // Fall back to name so equal hosts/statuses land in a stable, readable order.
      return collator.compare(av, bv) || collator.compare(a.name, b.name);
    };
    return out.sort((a, b) => (dir === 'asc' ? cmp(a, b) : -cmp(a, b)));
  }, [projects, filters.q, filters.host, filters.frontend, filters.database, filters.status, sort, dir]);

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-mono text-xs uppercase tracking-widest text-[var(--color-ink-3)]">
          admindash
        </h1>
        <div className="flex items-center gap-3 text-xs text-[var(--color-ink-3)]">
          <span className="hidden sm:inline">{user?.email}</span>
          <button
            type="button"
            onClick={() => projects && downloadBackup(projects)}
            disabled={!projects || projects.length === 0}
            className="border border-[var(--color-rule-strong)] px-2 py-1 hover:border-[var(--color-ink)] disabled:opacity-40"
          >
            Download JSON
          </button>
          <button type="button" onClick={() => void signOut()} className="underline underline-offset-4">
            Sign out
          </button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <FilterBar
            filters={filters}
            onChange={setFilters}
            total={projects?.length ?? 0}
            shown={shown.length}
          />
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="border border-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]"
        >
          Add project
        </button>
        <button
          type="button"
          onClick={() => setImporting(true)}
          disabled={!projects}
          className="border border-[var(--color-rule-strong)] px-4 py-1.5 text-sm hover:border-[var(--color-ink)] disabled:opacity-40"
        >
          Import list
        </button>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner
            code={error.code}
            message={
              error.code === 'permission-denied'
                ? `Firestore refused the read. This UID is probably not in firestore.rules yet — ${user?.uid ?? 'unknown UID'}`
                : error.message
            }
          />
        </div>
      )}

      {!projects && !error && <TableSkeleton />}

      {projects && shown.length === 0 && (
        <EmptyState
          title={hasFilters ? 'No projects match these filters.' : 'No projects yet.'}
          hint={hasFilters ? 'Clear the filters to see everything.' : 'Add the first one.'}
        />
      )}

      {projects && shown.length > 0 && (
        <ProjectTable projects={shown} sort={sort} dir={dir} onSort={onSort} />
      )}

      {adding && (
        <AddProjectModal
          onClose={() => setAdding(false)}
          onCreated={(id) => { setAdding(false); navigate(`/${id}`); }}
        />
      )}

      {importing && projects && (
        // The live collection is passed in so duplicate detection compares against what is
        // actually stored, not a stale copy.
        <ImportProjectsModal existing={projects} onClose={() => setImporting(false)} />
      )}
    </div>
  );
}
