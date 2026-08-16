import type { Enrichment } from './types';

/**
 * Reads what a project actually is, from two sources that both allow browser calls:
 *
 *   api.github.com  — `access-control-allow-origin: *`
 *   dns.google      — `access-control-allow-origin: *`
 *
 * Both hosts are hardcoded. This is deliberately NOT the general URL-fetching endpoint that was
 * designed and cut earlier: there is no user-supplied host, so there is no SSRF surface, no
 * token to verify, and no server involved.
 *
 * The cost is GitHub's unauthenticated ceiling of 60 requests/hour per IP — roughly 15 projects.
 * `scripts/enrich-projects.mjs` uses the `gh` CLI's token for 5,000/hour and private repos.
 */

const GH = 'https://api.github.com';
const DOH = 'https://dns.google/resolve';

export interface FetchLike {
  (url: string, init?: { headers?: Record<string, string> }): Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
  }>;
}

export function parseRepo(repoUrl: string): { owner: string; name: string } | null {
  const m = repoUrl.trim().match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], name: m[2] } : null;
}

/** Dependency name -> what it tells you. Only entries that are actually diagnostic. */
const FRONTEND_DEPS: Record<string, string> = {
  react: 'React', vue: 'Vue', svelte: 'Svelte', '@angular/core': 'Angular',
  next: 'Next.js', nuxt: 'Nuxt', astro: 'Astro', '@remix-run/react': 'Remix',
  gatsby: 'Gatsby', vite: 'Vite', tailwindcss: 'Tailwind', '@sveltejs/kit': 'SvelteKit',
  'styled-components': 'styled-components', '@mui/material': 'MUI', bootstrap: 'Bootstrap',
};

const BACKEND_DEPS: Record<string, string> = {
  express: 'Express', fastify: 'Fastify', koa: 'Koa', '@nestjs/core': 'NestJS',
  'firebase-admin': 'Firebase Admin', firebase: 'Firebase', '@supabase/supabase-js': 'Supabase',
  '@prisma/client': 'Prisma', 'drizzle-orm': 'Drizzle', mongoose: 'Mongoose', pg: 'PostgreSQL',
  mysql2: 'MySQL', sequelize: 'Sequelize', typeorm: 'TypeORM', redis: 'Redis',
  stripe: 'Stripe', resend: 'Resend', nodemailer: 'Nodemailer', '@aws-sdk/client-s3': 'AWS S3',
  wrangler: 'Cloudflare Workers', 'hono': 'Hono',
};

/** Root files that identify a stack without needing a manifest parsed. */
const MARKER_FILES: Record<string, string> = {
  'composer.json': 'PHP / Composer',
  'wp-config.php': 'WordPress',
  'go.mod': 'Go',
  'Gemfile': 'Ruby',
  'requirements.txt': 'Python',
  'pyproject.toml': 'Python',
  'Cargo.toml': 'Rust',
  'Dockerfile': 'Docker',
  'docker-compose.yml': 'Docker Compose',
  'wrangler.toml': 'Cloudflare Workers',
  'firebase.json': 'Firebase Hosting',
  'vercel.json': 'Vercel',
  'netlify.toml': 'Netlify',
  'nuxt.config.ts': 'Nuxt',
  'next.config.js': 'Next.js',
  'next.config.mjs': 'Next.js',
  'astro.config.mjs': 'Astro',
  '.github': 'GitHub Actions',
};

function pct(languages: Record<string, number>): string[] {
  const total = Object.values(languages).reduce((a, b) => a + b, 0);
  if (!total) return [];
  return Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, bytes]) => `${name} ${Math.round((bytes / total) * 100)}%`);
}

function classifyNameservers(ns: string[]): string {
  const j = ns.join(' ').toLowerCase();
  if (j.includes('cloudflare')) return 'cloudflare';
  if (j.includes('awsdns')) return 'route53';
  if (j.includes('googledomains') || j.includes('google.com')) return 'google';
  if (j.includes('azure-dns')) return 'azure';
  if (j.includes('domaincontrol')) return 'godaddy';
  if (j.includes('nsone')) return 'ns1';
  if (j.includes('registrar-servers')) return 'namecheap';
  return ns.length ? 'other' : 'none';
}

function classifyHosting(cname: string[], a: string[]): string | undefined {
  const j = [...cname, ...a].join(' ').toLowerCase();
  if (j.includes('vercel')) return 'Vercel';
  if (j.includes('netlify')) return 'Netlify';
  if (j.includes('github.io')) return 'GitHub Pages';
  if (j.includes('firebase') || j.includes('web.app')) return 'Firebase Hosting';
  if (j.includes('shopify')) return 'Shopify';
  if (j.includes('wpengine')) return 'WP Engine';
  return undefined;
}

function classifyMail(mx: string[]): string | undefined {
  const j = mx.join(' ').toLowerCase();
  if (j.includes('google')) return 'Google Workspace';
  if (j.includes('outlook') || j.includes('microsoft')) return 'Microsoft 365';
  if (j.includes('zoho')) return 'Zoho';
  if (j.includes('protonmail') || j.includes('proton.me')) return 'Proton';
  if (j.includes('improvmx')) return 'ImprovMX';
  return mx.length ? 'other' : undefined;
}

async function dnsAnswers(f: FetchLike, name: string, type: string): Promise<string[]> {
  const r = await f(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`);
  if (!r.ok) return [];
  const d = (await r.json()) as { Answer?: Array<{ data?: string; type?: number }> };
  return (d.Answer ?? []).map((a) => (a.data ?? '').replace(/\.$/, '')).filter(Boolean);
}

/** DNS half. Never throws — a failed lookup becomes an entry in `errors`. */
export async function enrichFromDns(domain: string, f: FetchLike): Promise<Enrichment> {
  const out: Enrichment = {};
  const errors: string[] = [];
  try {
    const [ns, cname, a, mx] = await Promise.all([
      dnsAnswers(f, domain, 'NS'),
      dnsAnswers(f, domain, 'CNAME'),
      dnsAnswers(f, domain, 'A'),
      dnsAnswers(f, domain, 'MX'),
    ]);
    // NS is often only served for the registrable domain, so retry one level up for www.x.y
    const nameservers = ns.length ? ns : await dnsAnswers(f, domain.split('.').slice(-2).join('.'), 'NS');
    out.nameservers = nameservers.slice(0, 6);
    out.dnsProvider = classifyNameservers(nameservers);

    // A/AAAA are the addresses actually serving the domain. Behind a proxy these are the
    // proxy's, not the origin's — Cloudflare in particular. Reported as fact, not as "the
    // server", because a proxied address is genuinely what the internet resolves to.
    const ips = a.filter((v) => /^[0-9.]+$/.test(v) || v.includes(':'));
    if (ips.length) {
      out.serverIps = ips.slice(0, 6);
      const ptr = await dnsAnswers(f, `${ips[0].split('.').reverse().join('.')}.in-addr.arpa`, 'PTR');
      if (ptr.length) out.serverHostname = ptr[0];
    }

    const hosting = classifyHosting(cname, a);
    if (hosting) out.hostingHint = hosting;
    const mail = classifyMail(mx);
    if (mail) out.mailProvider = mail;
  } catch (e) {
    errors.push(`dns: ${(e as Error).message}`);
  }
  if (errors.length) out.errors = errors;
  return out;
}

/**
 * GitHub half. `token` is optional and is ONLY ever supplied by the CLI script — never by the
 * browser, where it would be compiled into a publicly downloadable bundle.
 */
export async function enrichFromGithub(
  repoUrl: string,
  f: FetchLike,
  token?: string,
): Promise<Enrichment> {
  const out: Enrichment = {};
  const errors: string[] = [];
  const parsed = parseRepo(repoUrl);
  if (!parsed) return repoUrl.trim() ? { errors: ['repo: not a github.com/owner/repo URL'] } : {};

  const { owner, name } = parsed;
  out.repoOwner = owner;
  out.repoName = name;
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const get = async (path: string) => f(`${GH}/repos/${owner}/${name}${path}`, { headers });

  try {
    const meta = await get('');
    if (meta.status === 404) {
      out.repoPrivate = true;
      errors.push(
        token
          ? 'repo: 404 even with a token — check the repo exists and the token has access'
          : 'repo: 404 unauthenticated — private, or renamed. Run npm run enrich:projects to read it.',
      );
      out.errors = errors;
      return out;
    }
    if (meta.status === 403) {
      errors.push('repo: 403 — GitHub rate limit reached (60/hour unauthenticated). Try later or use the CLI script.');
      out.errors = errors;
      return out;
    }
    if (meta.ok) {
      const m = (await meta.json()) as Record<string, any>;
      out.repoPrivate = !!m.private;
      out.repoArchived = !!m.archived;
      if (m.pushed_at) out.repoPushedAt = String(m.pushed_at);
      if (m.license?.spdx_id && m.license.spdx_id !== 'NOASSERTION') out.repoLicense = m.license.spdx_id;
      if (Array.isArray(m.topics) && m.topics.length) out.repoTopics = m.topics.slice(0, 10);
    }

    const [langs, commits, contents] = await Promise.all([
      get('/languages'),
      get('/commits?per_page=1'),
      get('/contents'),
    ]);

    if (langs.ok) out.languages = pct((await langs.json()) as Record<string, number>);

    if (commits.ok) {
      const c = (await commits.json()) as Array<Record<string, any>>;
      const top = c?.[0];
      if (top) {
        out.lastCommitAuthor =
          top.author?.login || top.commit?.author?.name || 'unknown';
        out.lastCommitDate = top.commit?.author?.date ?? undefined;
        out.lastCommitMessage = String(top.commit?.message ?? '').split('\n')[0].slice(0, 140);
      }
    }

    let hasPackageJson = false;
    if (contents.ok) {
      const files = (await contents.json()) as Array<{ name: string }>;
      const names = files.map((x) => x.name);
      hasPackageJson = names.includes('package.json');
      const markers = names
        .filter((n) => n in MARKER_FILES)
        .map((n) => MARKER_FILES[n]);
      if (markers.length) out.markers = [...new Set(markers)];
    }

    if (hasPackageJson) {
      const pkgRes = await f(
        `${GH}/repos/${owner}/${name}/contents/package.json`,
        { headers: { ...headers, Accept: 'application/vnd.github.raw' } },
      );
      if (pkgRes.ok) {
        try {
          const pkg = (await pkgRes.json()) as Record<string, any>;
          const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
          const fe = Object.keys(deps).filter((d) => d in FRONTEND_DEPS).map((d) => FRONTEND_DEPS[d]);
          const be = Object.keys(deps).filter((d) => d in BACKEND_DEPS).map((d) => BACKEND_DEPS[d]);
          if (fe.length) out.stackFrontend = [...new Set(fe)];
          if (be.length) out.stackBackend = [...new Set(be)];
        } catch {
          errors.push('repo: package.json present but could not be parsed');
        }
      }
    }
  } catch (e) {
    errors.push(`repo: ${(e as Error).message}`);
  }

  if (errors.length) out.errors = errors;
  return out;
}

/**
 * Turn evidence into proposed classification values.
 *
 * Only where the evidence actually supports it. Frontend and database are usually decidable from
 * the dependency manifest; host is often masked by a proxy; status is not a repository fact at
 * all, so it is suggested only when GitHub reports the repo archived.
 */
function suggest(e: Enrichment): Enrichment {
  const fe = e.stackFrontend ?? [];
  const be = e.stackBackend ?? [];
  const mk = e.markers ?? [];
  const has = (list: string[], v: string) => list.includes(v);
  const out: Enrichment = {};

  // Frontend — the most specific framework wins over the bundler that ships it.
  if (has(mk, 'WordPress')) out.suggestedFrontend = 'wordpress';
  else if (has(fe, 'Next.js')) out.suggestedFrontend = 'next';
  else if (has(fe, 'Nuxt') || has(fe, 'Vue')) out.suggestedFrontend = 'vue';
  else if (has(fe, 'SvelteKit') || has(fe, 'Svelte')) out.suggestedFrontend = 'svelte';
  else if (has(fe, 'Astro')) out.suggestedFrontend = 'astro';
  else if (has(fe, 'React')) out.suggestedFrontend = 'react';
  else if (e.languages?.length && !fe.length) out.suggestedFrontend = 'static';

  // Database — named dependencies only. Prisma and Drizzle are ORMs and do not name the engine.
  if (has(mk, 'WordPress')) out.suggestedDatabase = 'wordpress-mysql';
  else if (has(be, 'PostgreSQL') || has(be, 'Supabase')) out.suggestedDatabase = 'postgres';
  else if (has(be, 'MySQL')) out.suggestedDatabase = 'mysql';
  else if (has(be, 'Mongoose')) out.suggestedDatabase = 'mongo';
  else if (has(be, 'Firebase') || has(be, 'Firebase Admin')) out.suggestedDatabase = 'firestore';

  // Host — repo markers are stronger evidence than DNS, which a proxy can mask.
  if (has(mk, 'Firebase Hosting')) out.suggestedHost = 'firebase';
  else if (has(mk, 'Vercel')) out.suggestedHost = 'vercel';
  else if (has(mk, 'Netlify')) out.suggestedHost = 'netlify';
  else if (has(mk, 'Cloudflare Workers')) out.suggestedHost = 'cloudflare';
  else if (e.hostingHint === 'Vercel') out.suggestedHost = 'vercel';
  else if (e.hostingHint === 'Netlify') out.suggestedHost = 'netlify';
  else if (e.hostingHint === 'Firebase Hosting') out.suggestedHost = 'firebase';
  else if (e.hostingHint === 'GitHub Pages') out.suggestedHost = 'other';

  // Status — the only defensible inference.
  if (e.repoArchived) out.suggestedStatus = 'archived';

  return out;
}

/** Both halves. Partial results are kept — a DNS failure must not discard a good repo read. */
export async function enrichProject(
  opts: { repoUrl: string; domain: string; source: string; token?: string },
  f: FetchLike,
): Promise<Enrichment> {
  const [gh, dns] = await Promise.all([
    enrichFromGithub(opts.repoUrl, f, opts.token),
    opts.domain ? enrichFromDns(opts.domain, f) : Promise.resolve({} as Enrichment),
  ]);
  const errors = [...(gh.errors ?? []), ...(dns.errors ?? [])];
  const base: Enrichment = { ...gh, ...dns };
  const merged: Enrichment = { ...base, ...suggest(base), source: opts.source };
  if (errors.length) merged.errors = errors;
  else delete merged.errors;
  return merged;
}
