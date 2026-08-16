/**
 * The project record.
 *
 * IMPORTANT: every enum below is duplicated in firestore.rules, which rejects any value not in
 * its list. THE TWO FILES MUST CHANGE TOGETHER — adding a value here alone produces writes the
 * rules silently refuse with permission-denied.
 */

export const HOSTS = [
  'firebase', 'digitalocean', 'lovable', 'vercel', 'netlify',
  'cloudflare', 'aws', 'wordpress-host', 'other', 'unknown',
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

export interface Project extends ProjectFields {
  id: string;
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
  if (!domain) e.domain = 'Required.';
  else if (domain.length > LIMITS.domain) e.domain = `Too long (max ${LIMITS.domain}).`;
  else if (!DOMAIN_RE.test(domain)) e.domain = 'Must be a hostname, e.g. goodai.news — no https://, no path.';

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
