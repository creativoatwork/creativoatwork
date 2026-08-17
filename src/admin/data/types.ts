/**
 * The project record.
 *
 * IMPORTANT: every enum below is duplicated in firestore.rules, which rejects any value not in
 * its list. THE TWO FILES MUST CHANGE TOGETHER — adding a value here alone produces writes the
 * rules silently refuse with permission-denied.
 */

export const HOSTS = [
  'firebase', 'digitalocean', 'lovable', 'vercel', 'netlify',
  'cloudflare', 'aws', 'gcp', 'wordpress-host', 'other', 'unknown',
] as const;

export const FRONTENDS = [
  'react', 'next', 'vue', 'svelte', 'astro', 'wordpress', 'static', 'other', 'unknown',
] as const;

export const DATABASES = [
  'postgres', 'mysql', 'firestore', 'mongo', 'sqlite', 'wordpress-mysql', 'none', 'unknown',
] as const;

export const STATUSES = ['active', 'maintenance', 'archived'] as const;

export type Host = (typeof HOSTS)[number];
export type Frontend = (typeof FRONTENDS)[number];
export type Database = (typeof DATABASES)[number];
export type Status = (typeof STATUSES)[number];

/** Field limits, mirrored exactly in firestore.rules. */
export const LIMITS = {
  name: 200,
  description: 2000,
  repoUrl: 140,
  domain: 253,
  notes: 10_000,
} as const;

export const DOMAIN_RE =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{0,57}[a-z0-9])$/;
export const REPO_RE =
  /^https:\/\/github\.com\/[A-Za-z0-9]+(-[A-Za-z0-9]+)*\/[A-Za-z0-9._-]{1,100}$/;

/**
 * Machine-written enrichment, read from GitHub and DNS.
 *
 * Deliberately loose: the rules validate that this is a map of at most 40 keys and nothing more,
 * so a new signal can be added without a rules deploy. It is owner-written, display-only, and
 * never used for authorization. Rendered as text, never as HTML.
 */
export interface Enrichment {
  /** 'github' | 'dns' contributions merged into one map. */
  repoOwner?: string;
  repoName?: string;
  repoPrivate?: boolean;
  repoArchived?: boolean;
  repoPushedAt?: string;
  repoLicense?: string;
  repoTopics?: string[];
  /** Byte-share language breakdown, biggest first, e.g. ["TypeScript 78%", "CSS 21%"]. */
  languages?: string[];
  /** Frameworks and libraries detected from the dependency manifest, not guessed. */
  stackFrontend?: string[];
  stackBackend?: string[];
  /** Manifest and marker files found at the repo root. */
  markers?: string[];
  lastCommitAuthor?: string;
  lastCommitDate?: string;
  lastCommitMessage?: string;
  /** Resolved A/AAAA addresses for the domain. */
  serverIps?: string[];
  /** Reverse-DNS name for the first address, when one is published. */
  serverHostname?: string;
  /** 'cloudflare' | 'route53' | 'google' | 'other' | 'none' */
  dnsProvider?: string;
  nameservers?: string[];
  hostingHint?: string;
  mailProvider?: string;
  /** Set when a source could not be read, so a blank panel is never mistaken for a clean result. */
  errors?: string[];
  /**
   * Values the gatherer believes the classification fields should hold, derived from the
   * evidence above. Suggestions only — never applied automatically. The operator may know
   * something the evidence cannot show (an origin behind Cloudflare, a database the manifest
   * does not name), so overwriting their choice would be wrong.
   *
   * `status` is only ever suggested from GitHub's `archived` flag. Active vs maintenance is a
   * judgement about intent that no repository fact can settle.
   */
  suggestedHost?: string;
  suggestedFrontend?: string;
  suggestedDatabase?: string;
  suggestedStatus?: string;
  /** Which run wrote this: 'browser' or 'cli'. */
  source?: string;
}

/** The editable fields — what a form produces and what the rules validate. */
export interface ProjectFields {
  name: string;
  description: string;
  repoUrl: string;
  domain: string;
  host: Host;
  frontend: Frontend;
  database: Database;
  status: Status;
  notes: string;
}

/**
 * A stored project: the editable fields, plus data nobody types.
 *
 * `enrichment` and `enrichedAt` are deliberately NOT in ProjectFields. They are written by the
 * gatherer, not by the form, and keeping them out of the form's value is what stops a stale copy
 * in component state from being written back over freshly gathered data on the next Save.
 */
export interface Project extends ProjectFields {
  id: string;
  enrichment: Enrichment;
  enrichedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export const EMPTY_PROJECT: ProjectFields = {
  name: '',
  description: '',
  repoUrl: '',
  domain: '',
  host: 'unknown',
  frontend: 'unknown',
  database: 'unknown',
  status: 'active',
  notes: '',
};

const label = (v: string) =>
  v === 'unknown' ? '—' : v.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const LABELS = {
  host: Object.fromEntries(HOSTS.map((h) => [h, label(h)])) as Record<Host, string>,
  frontend: Object.fromEntries(FRONTENDS.map((f) => [f, label(f)])) as Record<Frontend, string>,
  database: Object.fromEntries(DATABASES.map((d) => [d, label(d)])) as Record<Database, string>,
  status: Object.fromEntries(STATUSES.map((s) => [s, label(s)])) as Record<Status, string>,
};

/**
 * Client-side validation, matched to what the rules enforce. This exists to give a useful
 * message before a write, not to protect anything — the rules are what refuse bad data.
 * Returns a map of field -> error, empty when valid.
 */
export function validate(f: ProjectFields): Partial<Record<keyof ProjectFields, string>> {
  const e: Partial<Record<keyof ProjectFields, string>> = {};
  const name = f.name.trim();
  if (!name) e.name = 'Required.';
  else if (name.length > LIMITS.name) e.name = `Too long (max ${LIMITS.name}).`;

  const domain = f.domain.trim().toLowerCase().replace(/\.$/, '');
  const repoPresent = f.repoUrl.trim().length > 0;
  if (!domain && !repoPresent) {
    // A project with neither identifies nothing. Either alone is fine: a repo may have no live
    // site yet, and a site may have no repository.
    e.domain = 'Give a domain or a GitHub repo.';
  } else if (domain) {
    if (domain.length > LIMITS.domain) e.domain = `Too long (max ${LIMITS.domain}).`;
    else if (!DOMAIN_RE.test(domain)) e.domain = 'Must be a hostname, e.g. goodai.news — no https://, no path.';
  }

  const repo = f.repoUrl.trim();
  if (repo) {
    if (repo.length > LIMITS.repoUrl) e.repoUrl = `Too long (max ${LIMITS.repoUrl}).`;
    else if (!REPO_RE.test(repo)) e.repoUrl = 'Must be https://github.com/owner/repo, or empty.';
  }

  if (f.description.length > LIMITS.description) e.description = `Too long (max ${LIMITS.description}).`;
  if (f.notes.length > LIMITS.notes) e.notes = `Too long (max ${LIMITS.notes}).`;
  return e;
}

/** Normalisation applied before every write, so the rules' strict form is always satisfied. */
export function normalize(f: ProjectFields): ProjectFields {
  return {
    ...f,
    name: f.name.trim(),
    description: f.description.trim(),
    repoUrl: f.repoUrl.trim(),
    domain: f.domain.trim().toLowerCase().replace(/\.$/, ''),
    notes: f.notes.trim(),
  };
}
