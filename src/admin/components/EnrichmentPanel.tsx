import { useState } from 'react';
import type { Enrichment } from '../data/types';
import { enrichProject } from '../data/enrich';

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <>
    <dt className="font-mono text-xs uppercase tracking-wide text-[var(--color-ink-3)]">{label}</dt>
    <dd className="text-sm text-[var(--color-ink)]">{children}</dd>
  </>
);

const Chips = ({ items }: { items: string[] }) => (
  <span className="flex flex-wrap gap-1">
    {items.map((v) => (
      <span key={v} className="border border-[var(--color-rule)] px-1.5 py-0.5 font-mono text-xs">
        {v}
      </span>
    ))}
  </span>
);

const dnsLabel: Record<string, string> = {
  cloudflare: 'Cloudflare', route53: 'AWS Route 53', google: 'Google Domains',
  azure: 'Azure DNS', godaddy: 'GoDaddy', ns1: 'NS1', namecheap: 'Namecheap',
  other: 'Other / registrar default', none: 'No NS records found',
};

/**
 * Read-only view of machine-gathered facts, with a manual refresh.
 *
 * Everything here is rendered as text. The values come from third-party APIs and are never
 * trusted as markup, and never used for any authorization decision.
 */
export function EnrichmentPanel({
  repoUrl, domain, enrichment, enrichedAt, onSave,
}: {
  repoUrl: string;
  domain: string;
  enrichment: Enrichment;
  enrichedAt: Date | null;
  onSave: (e: Enrichment, at: Date) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await enrichProject({ repoUrl, domain, source: 'browser' }, fetch as never);
      await onSave(next, new Date());
    } catch (e) {
      setError(`Could not refresh: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const e = enrichment ?? {};
  const empty = Object.keys(e).filter((k) => k !== 'source').length === 0;

  return (
    <section className="mt-8 border-t border-[var(--color-rule)] pt-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--color-ink-3)]">
          Gathered
        </h2>
        <div className="flex items-center gap-3">
          {enrichedAt && (
            <span className="font-mono text-xs text-[var(--color-ink-3)]">
              {enrichedAt.toISOString().slice(0, 16).replace('T', ' ')} · {e.source ?? '—'}
            </span>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={busy || (!repoUrl && !domain)}
            className="border border-[var(--color-rule-strong)] px-3 py-1 text-xs hover:border-[var(--color-ink)] disabled:opacity-40"
          >
            {busy ? 'Reading…' : enrichedAt ? 'Refresh' : 'Gather'}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mb-3 text-sm text-[var(--color-accent)]">{error}</p>}

      {empty && !busy && (
        <p className="text-sm text-[var(--color-ink-3)]">
          Nothing gathered yet. Reads the GitHub repo and the domain's DNS — both public, no
          credentials involved.
        </p>
      )}

      {!empty && (
        <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2">
          {e.languages?.length ? <Row label="Languages"><Chips items={e.languages} /></Row> : null}
          {e.stackFrontend?.length ? <Row label="Frontend"><Chips items={e.stackFrontend} /></Row> : null}
          {e.stackBackend?.length ? <Row label="Backend"><Chips items={e.stackBackend} /></Row> : null}
          {e.markers?.length ? <Row label="Markers"><Chips items={e.markers} /></Row> : null}
          {e.dnsProvider ? (
            <Row label="DNS">
              {dnsLabel[e.dnsProvider] ?? e.dnsProvider}
              {e.nameservers?.length ? (
                <span className="ml-2 font-mono text-xs text-[var(--color-ink-3)]">
                  {e.nameservers.join(', ')}
                </span>
              ) : null}
            </Row>
          ) : null}
          {e.hostingHint ? <Row label="Hosting (DNS)">{e.hostingHint}</Row> : null}
          {e.mailProvider ? <Row label="Mail">{e.mailProvider}</Row> : null}
          {e.lastCommitAuthor ? (
            <Row label="Last commit">
              <span className="font-mono text-xs">{e.lastCommitAuthor}</span>
              {e.lastCommitDate && (
                <span className="ml-2 font-mono text-xs tabular-nums text-[var(--color-ink-3)]">
                  {e.lastCommitDate.slice(0, 10)}
                </span>
              )}
              {e.lastCommitMessage && (
                <span className="mt-0.5 block text-[var(--color-ink-2)]">{e.lastCommitMessage}</span>
              )}
            </Row>
          ) : null}
          {e.repoPushedAt ? <Row label="Repo pushed"><span className="font-mono text-xs tabular-nums">{e.repoPushedAt.slice(0, 10)}</span></Row> : null}
          {e.repoPrivate ? <Row label="Repo">Private</Row> : null}
          {e.repoArchived ? <Row label="Repo">Archived</Row> : null}
          {e.repoLicense ? <Row label="License">{e.repoLicense}</Row> : null}
          {e.repoTopics?.length ? <Row label="Topics"><Chips items={e.repoTopics} /></Row> : null}
          {e.errors?.length ? (
            <Row label="Could not read">
              <ul className="space-y-1 text-sm text-[var(--color-accent)]">
                {e.errors.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </Row>
          ) : null}
        </dl>
      )}
    </section>
  );
}
