import { HOSTS, FRONTENDS, DATABASES, STATUSES, LABELS } from '../data/types';

export interface Filters {
  q: string; host: string; frontend: string; database: string; status: string;
}

export const EMPTY_FILTERS: Filters = { q: '', host: '', frontend: '', database: '', status: '' };

const sel =
  'border border-[var(--color-rule-strong)] bg-[var(--color-paper)] px-2 py-1.5 text-sm text-[var(--color-ink)]';

/** Filter state lives in the URL query string, so a filtered view is linkable and survives reload. */
export function FilterBar({
  filters, onChange, total, shown,
}: { filters: Filters; onChange: (f: Filters) => void; total: number; shown: number }) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const activeCount = Object.entries(filters).filter(([, v]) => v !== '').length;

  const Dropdown = <T extends string>({
    label, value, options, labels, onPick,
  }: { label: string; value: string; options: readonly T[]; labels: Record<T, string>; onPick: (v: string) => void }) => (
    <label className="flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onPick(e.target.value)} className={sel} aria-label={label}>
        <option value="">{label}: any</option>
        {options.map((o) => <option key={o} value={o}>{labels[o]}</option>)}
      </select>
    </label>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex-1 min-w-[16rem]">
        <span className="sr-only">Search projects</span>
        <input
          type="search"
          value={filters.q}
          onChange={(e) => set('q', e.target.value)}
          placeholder="Search name, domain, description, notes…"
          className="w-full border border-[var(--color-rule-strong)] bg-[var(--color-paper)] px-3 py-1.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)]"
        />
      </label>

      <Dropdown label="Host" value={filters.host} options={HOSTS} labels={LABELS.host} onPick={(v) => set('host', v)} />
      <Dropdown label="Frontend" value={filters.frontend} options={FRONTENDS} labels={LABELS.frontend} onPick={(v) => set('frontend', v)} />
      <Dropdown label="Database" value={filters.database} options={DATABASES} labels={LABELS.database} onPick={(v) => set('database', v)} />
      <Dropdown label="Status" value={filters.status} options={STATUSES} labels={LABELS.status} onPick={(v) => set('status', v)} />

      <span className="font-mono text-xs text-[var(--color-ink-3)]">
        {shown === total ? `${total}` : `${shown} / ${total}`}
      </span>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="border border-[var(--color-rule-strong)] px-2 py-1 text-xs hover:border-[var(--color-ink)]"
        >
          Clear {activeCount}
        </button>
      )}
    </div>
  );
}
