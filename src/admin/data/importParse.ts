import {
  DOMAIN_RE, EMPTY_PROJECT, LIMITS, REPO_RE, normalize, validate, type ProjectFields,
} from './types';

/**
 * Parses a pasted list of projects into rows the preview table can show and `createProject` can
 * write.
 *
 * Two rules govern everything here.
 *
 * 1. **Fields are classified by shape, never by column position.** The operator pastes from
 *    several sources, and the failure mode of positional parsing — silently swapping name and
 *    domain — is invisible until it is in the database. A GitHub URL is recognisable, a hostname
 *    is recognisable, and whatever is left is the name.
 * 2. **Validation is `validate()` from types.ts, not a second looser copy.** That function mirrors
 *    firestore.rules. A row the rules would reject is marked invalid here rather than attempted,
 *    so an import never produces a wall of permission-denied.
 */

export type RowStatus = 'ok' | 'duplicate' | 'invalid';

export interface ImportRow {
  /** 1-based line number in the pasted text, so a reported problem can be found again. */
  line: number;
  raw: string;
  fields: ProjectFields;
  /** True when the name was derived from the domain rather than supplied on the line. */
  derivedName: boolean;
  status: RowStatus;
  /** Why, for `duplicate` and `invalid`. Always set when status is not 'ok'. */
  reason?: string;
}

/**
 * Splits one line into fields.
 *
 * Comma and tab win when present, so a spreadsheet paste works untouched and a name may contain
 * single spaces. Failing those, two-or-more spaces separate columns; a single space is treated as
 * part of a name unless it is the only thing that could be separating two fields.
 */
export function splitFields(line: string): string[] {
  const parts = /[,\t]/.test(line) ? splitDelimited(line) : line.split(/\s{2,}/);
  const cleaned = parts.map(unquote).filter(Boolean);
  if (cleaned.length > 1) return cleaned;
  // One field so far: a single-space-separated "domain repo" line still has to work.
  return line.trim().split(/\s+/).map(unquote).filter(Boolean);
}

/**
 * Comma/tab split that respects double quotes, so a spreadsheet's `"New York, Partners"` stays
 * one field instead of silently becoming two.
 */
function splitDelimited(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') { quoted = !quoted; cur += ch; }
    else if (!quoted && (ch === ',' || ch === '\t')) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Spreadsheet exports quote fields. Strip one matching pair, not characters inside the value. */
function unquote(s: string): string {
  const t = s.trim();
  const m = t.match(/^"(.*)"$/s) ?? t.match(/^'(.*)'$/s);
  return (m ? m[1] : t).trim();
}

/** Lowercase, drop scheme, path, query, port and trailing dot. Does not validate. */
export function normalizeDomain(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

const looksLikeRepo = (s: string) => /(^|\/\/|@)(www\.)?github\.com[/:]/i.test(s.trim());

/**
 * Reduces any GitHub reference to the canonical `https://github.com/owner/repo`, or null when
 * the result would not satisfy REPO_RE — which is the exact string firestore.rules accepts.
 */
export function canonicalRepo(s: string): string | null {
  const path = s
    .trim()
    .replace(/^git@github\.com:/i, 'https://github.com/')
    .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '');
  const [owner, repoRaw] = path.split(/[/?#]/);
  if (!owner || !repoRaw) return null;
  const repo = repoRaw.replace(/\.git$/i, '');
  const url = `https://github.com/${owner}/${repo}`;
  return url.length <= LIMITS.repoUrl && REPO_RE.test(url) ? url : null;
}

const looksLikeDomain = (s: string) => {
  const d = normalizeDomain(s);
  return d.length > 0 && d.length <= LIMITS.domain && DOMAIN_RE.test(d);
};

/** `goodai.news` -> `Goodai`. First label only; the TLD is never part of a studio's project name. */
/**
 * A readable name from whatever identifies the project.
 *
 * The domain's first label when there is one, otherwise the repository name — a repo-only row
 * would otherwise arrive with no name at all and be rejected as invalid, which is most of a
 * list of repositories.
 */
export function defaultName(domain: string, repoUrl = ''): string {
  const source = domain
    ? domain.replace(/^www\./, '').split('.')[0] ?? ''
    : (repoUrl.split('/').pop() ?? '').replace(/\.git$/, '');
  return source
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/** Parses the text into one row per non-blank, non-comment line. Status is not set here. */
export function parseImport(text: string): Array<Omit<ImportRow, 'status' | 'reason'>> {
  const out: Array<Omit<ImportRow, 'status' | 'reason'>> = [];

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    // A comment, or a line carrying nothing but separators — a CSV export's empty row is `,,`
    // and is not a project.
    if (!line || line.startsWith('#') || !/[a-z0-9]/i.test(line)) return;

    const parts = splitFields(line);
    const repos: string[] = [];
    const domains: string[] = [];
    const names: string[] = [];
    for (const p of parts) {
      if (looksLikeRepo(p)) repos.push(p);
      else if (looksLikeDomain(p)) domains.push(p);
      else names.push(p);
    }

    const domain = domains[0] ? normalizeDomain(domains[0]) : '';
    const repoUrl = repos[0] ? (canonicalRepo(repos[0]) ?? repos[0].trim()) : '';
    const supplied = names.join(' ').trim();
    const derivedName = supplied === '' && (domain !== '' || repoUrl !== '');

    const fields: ProjectFields = {
      ...EMPTY_PROJECT,
      domain,
      repoUrl,
      // A supplied name always wins; the domain, then the repo, are fallbacks.
      name: supplied || defaultName(domain, repoUrl),
    };

    out.push({ line: i + 1, raw: line, fields: normalize(fields), derivedName });
  });

  return out;
}

/**
 * Assigns a status to every row: valid, a duplicate of something already stored or of an earlier
 * row in the same paste, or invalid with the reason `validate()` gave.
 *
 * Duplicates are detected on the normalised domain when there is one, and on the repo URL when
 * there is not — a project may legitimately have only one of the two, and either identifies it.
 * Two records for one project is the mistake this exists to prevent.
 */
export function classifyRows(
  rows: Array<Omit<ImportRow, 'status' | 'reason'>>,
  existingKeys: Iterable<string>,
): ImportRow[] {
  const existing = new Set(
    Array.from(existingKeys, (k) => (k.includes('github.com') ? k.toLowerCase() : normalizeDomain(k)))
      .filter(Boolean),
  );
  const seen = new Map<string, number>();

  return rows.map((row) => {
    const errors = validate(row.fields);
    const keys = Object.keys(errors) as Array<keyof ProjectFields>;
    if (keys.length > 0) {
      const reason = !row.fields.domain && !row.fields.repoUrl
        ? 'Neither a domain nor a GitHub repo on this line.'
        : keys.map((k) => `${k}: ${errors[k]}`).join(' ');
      return { ...row, status: 'invalid' as const, reason };
    }

    // Identity is the domain when present, otherwise the repo.
    const key = row.fields.domain || row.fields.repoUrl.toLowerCase();
    const label = row.fields.domain ? 'domain' : 'repo';
    if (existing.has(key)) {
      return { ...row, status: 'duplicate' as const, reason: 'Already in the collection.' };
    }
    const earlier = seen.get(key);
    if (earlier !== undefined) {
      return { ...row, status: 'duplicate' as const, reason: `Same ${label} as line ${earlier}.` };
    }
    seen.set(key, row.line);
    return { ...row, status: 'ok' as const };
  });
}
