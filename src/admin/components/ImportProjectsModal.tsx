import { useMemo, useRef, useState, useEffect } from 'react';
import { Modal } from './Modal';
import { createProject, saveEnrichmentById } from '../data/projects';
import { enrichProject } from '../data/enrich';
import { classifyRows, parseImport, type ImportRow } from '../data/importParse';
import type { Project } from '../data/types';

/**
 * Bulk import: paste a list, look at what the parser made of it, then write.
 *
 * The preview is the whole safety mechanism. Fields are classified by shape rather than by column
 * position (see importParse.ts), which makes the parser order-independent but also means a
 * misclassification is possible — so every row's parse result is shown, and nothing is written
 * until the operator has had the chance to see it.
 *
 * Rows are validated with `validate()` from types.ts, the same function the single-project form
 * uses and the same constraints firestore.rules enforces. An invalid row is skipped, never
 * attempted, and never blocks the valid rows around it.
 */

const PLACEHOLDER = `AfricaDailyAI, goodai.news, https://github.com/creativoatwork/goodai
example.com, https://github.com/owner/repo
another-site.org`;

/** GitHub allows 60 unauthenticated requests/hour per IP; a gather spends about four. */
const ENRICH_BUDGET = 15;
/** Small gap between gathers. Not rate-limit protection — politeness, and a readable progress. */
const ENRICH_DELAY_MS = 1200;

type Phase = 'edit' | 'running' | 'done';

interface Outcome {
  created: number;
  skipped: number;
  failures: Array<{ line: number; label: string; message: string }>;
  enriched: number;
}

const STATUS_STYLE: Record<ImportRow['status'], string> = {
  ok: 'text-[var(--color-ink-2)]',
  duplicate: 'text-[var(--color-ink-3)]',
  invalid: 'text-[var(--color-accent)]',
};

export function ImportProjectsModal({
  existing, onClose,
}: { existing: Project[]; onClose: () => void }) {
  const [text, setText] = useState('');
  const [names, setNames] = useState<Record<number, string>>({});
  const [include, setInclude] = useState<Record<number, boolean>>({});
  const [enrich, setEnrich] = useState(false);
  const [phase, setPhase] = useState<Phase>('edit');
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // Set when the modal unmounts mid-run, so a long enrichment loop stops instead of writing on
  // behalf of a dialog that is gone.
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);

  const existingDomains = useMemo(() => existing.map((p) => p.domain), [existing]);

  const rows = useMemo(() => {
    const base = parseImport(text).map((r) =>
      names[r.line] === undefined
        ? r
        : { ...r, fields: { ...r.fields, name: names[r.line] }, derivedName: false },
    );
    return classifyRows(base, existingDomains);
  }, [text, names, existingDomains]);

  // Valid rows are in by default, duplicates are out, invalid rows cannot be turned on.
  const isIncluded = (r: ImportRow) =>
    r.status === 'invalid' ? false : (include[r.line] ?? r.status === 'ok');

  const chosen = rows.filter(isIncluded);
  const counts = {
    ok: rows.filter((r) => r.status === 'ok').length,
    duplicate: rows.filter((r) => r.status === 'duplicate').length,
    invalid: rows.filter((r) => r.status === 'invalid').length,
  };

  const run = async () => {
    setPhase('running');
    const failures: Outcome['failures'] = [];
    const created: Array<{ id: string; row: ImportRow }> = [];

    for (const [i, row] of chosen.entries()) {
      if (cancelled.current) return;
      setProgress({ label: 'Creating', done: i, total: chosen.length });
      try {
        const id = await createProject(row.fields);
        created.push({ id, row });
      } catch (err) {
        const code = (err as { code?: string }).code ?? 'unknown';
        failures.push({
          line: row.line,
          label: row.fields.domain || row.raw,
          message: code === 'permission-denied'
            ? 'Firestore refused the write (permission-denied).'
            : `Could not create (${code}).`,
        });
      }
    }

    let enriched = 0;
    if (enrich && created.length > 0) {
      for (const [i, { id, row }] of created.entries()) {
        if (cancelled.current) return;
        setProgress({ label: 'Gathering tech stack', done: i, total: created.length });
        try {
          const e = await enrichProject(
            { repoUrl: row.fields.repoUrl, domain: row.fields.domain, source: 'browser' },
            fetch as never,
          );
          await saveEnrichmentById(id, e, new Date());
          enriched += 1;
        } catch (err) {
          failures.push({
            line: row.line,
            label: row.fields.domain,
            message: `Created, but the tech stack could not be gathered: ${(err as Error).message}`,
          });
        }
        if (i < created.length - 1) {
          await new Promise((r) => setTimeout(r, ENRICH_DELAY_MS));
        }
      }
    }

    if (cancelled.current) return;
    setProgress(null);
    setOutcome({
      created: created.length,
      skipped: rows.length - chosen.length,
      failures,
      enriched,
    });
    setPhase('done');
  };

  return (
    <Modal title="Import projects" size="lg" onClose={onClose}>
      {phase === 'edit' && (
        <>
          <label
            htmlFor="import-paste"
            className="font-mono text-xs uppercase tracking-wide text-[var(--color-ink-3)]"
          >
            One project per line
          </label>
          <textarea
            id="import-paste"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            autoCapitalize="none"
            placeholder={PLACEHOLDER}
            className="mt-1 w-full border border-[var(--color-rule-strong)] bg-[var(--color-paper)] px-3 py-2 font-mono text-xs text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-ink)]"
          />
          <p className="mt-1 text-xs text-[var(--color-ink-3)]">
            Name, domain and GitHub URL, in any order, separated by commas, tabs or two spaces.
            Fields are recognised by shape, not by position — check the parsed columns below before
            importing. A missing name is derived from the domain. Lines starting with # are ignored.
          </p>

          {rows.length > 0 && (
            <>
              <p className="mt-4 font-mono text-xs uppercase tracking-wide text-[var(--color-ink-3)]">
                Preview — {counts.ok} ready, {counts.duplicate} duplicate, {counts.invalid} invalid
              </p>
              <div className="mt-2 max-h-[45vh] overflow-auto border border-[var(--color-rule)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-[var(--color-paper-2)]">
                    <tr className="font-mono text-xs uppercase tracking-wide text-[var(--color-ink-3)]">
                      <th scope="col" className="px-2 py-2 font-normal">Import</th>
                      <th scope="col" className="px-2 py-2 font-normal">Line</th>
                      <th scope="col" className="px-2 py-2 font-normal">Domain</th>
                      <th scope="col" className="px-2 py-2 font-normal">Repo</th>
                      <th scope="col" className="px-2 py-2 font-normal">Name</th>
                      <th scope="col" className="px-2 py-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-rule)]">
                    {rows.map((r) => (
                      <tr key={r.line} data-line={r.line} className="align-top">
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={isIncluded(r)}
                            disabled={r.status === 'invalid'}
                            onChange={(e) =>
                              setInclude((prev) => ({ ...prev, [r.line]: e.target.checked }))
                            }
                            aria-label={`Import line ${r.line}${r.fields.domain ? `, ${r.fields.domain}` : ''}`}
                          />
                        </td>
                        <td className="px-2 py-2 font-mono text-xs tabular-nums text-[var(--color-ink-3)]">
                          {r.line}
                        </td>
                        <td className="px-2 py-2 font-mono text-xs text-[var(--color-ink)]">
                          {r.fields.domain || <span className="text-[var(--color-ink-3)]">—</span>}
                        </td>
                        <td className="max-w-[16rem] truncate px-2 py-2 font-mono text-xs text-[var(--color-ink-2)]" title={r.fields.repoUrl}>
                          {r.fields.repoUrl.replace(/^https:\/\/github\.com\//, '') || (
                            <span className="text-[var(--color-ink-3)]">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={r.fields.name}
                            onChange={(e) =>
                              setNames((prev) => ({ ...prev, [r.line]: e.target.value }))
                            }
                            aria-label={`Project name for line ${r.line}`}
                            className="w-40 border border-[var(--color-rule)] bg-[var(--color-paper)] px-2 py-1 text-sm text-[var(--color-ink)] focus:border-[var(--color-ink)]"
                          />
                          {r.derivedName && (
                            <span className="mt-0.5 block text-xs text-[var(--color-ink-3)]">
                              from the domain
                            </span>
                          )}
                        </td>
                        <td className={`px-2 py-2 text-xs ${STATUS_STYLE[r.status]}`}>
                          <span className="font-mono uppercase">{r.status}</span>
                          {r.reason && <span className="mt-0.5 block">{r.reason}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-start gap-2">
                <input
                  id="import-enrich"
                  type="checkbox"
                  checked={enrich}
                  onChange={(e) => setEnrich(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="import-enrich" className="text-sm text-[var(--color-ink)]">
                  Gather tech stack after import
                  <span className="mt-0.5 block text-xs text-[var(--color-ink-3)]">
                    Runs one project at a time. GitHub allows 60 unauthenticated requests an hour —
                    roughly {ENRICH_BUDGET} projects — after which gathers start failing. For more
                    than that, import without this and run <code>npm run enrich:projects</code>,
                    which uses the gh CLI token.
                    {chosen.length > ENRICH_BUDGET && (
                      <strong className="mt-0.5 block text-[var(--color-accent)]">
                        {chosen.length} projects selected — past roughly {ENRICH_BUDGET}, expect the
                        rest to hit the GitHub rate limit.
                      </strong>
                    )}
                  </span>
                </label>
              </div>
            </>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void run()}
              disabled={chosen.length === 0}
              className="border border-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] disabled:opacity-50"
            >
              Import {chosen.length} {chosen.length === 1 ? 'project' : 'projects'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border border-[var(--color-rule-strong)] px-4 py-2 text-sm hover:border-[var(--color-ink)]"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {phase === 'running' && (
        <p role="status" className="py-8 text-center text-sm text-[var(--color-ink)]">
          {progress
            ? `${progress.label} — ${progress.done + 1} of ${progress.total}…`
            : 'Working…'}
        </p>
      )}

      {phase === 'done' && outcome && (
        <div className="py-2">
          <p role="status" className="text-sm text-[var(--color-ink)]">
            Created {outcome.created} · Skipped {outcome.skipped} · Failed{' '}
            {outcome.failures.length}
            {enrich && ` · Tech stack gathered for ${outcome.enriched}`}
          </p>
          {outcome.failures.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-[var(--color-rule)] pt-3 text-sm text-[var(--color-accent)]">
              {outcome.failures.map((f, i) => (
                <li key={`${f.line}-${i}`}>
                  <span className="font-mono text-xs text-[var(--color-ink-3)]">line {f.line}</span>{' '}
                  {f.label} — {f.message}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-6 border border-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
