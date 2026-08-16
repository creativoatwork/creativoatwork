#!/usr/bin/env node
/**
 * Enrich every project from GitHub and DNS, using the `gh` CLI's existing credentials.
 *
 * Why this exists alongside the in-browser Refresh button:
 *
 *   - Private repos return 404 to unauthenticated callers, and a token cannot go in the browser
 *     bundle — that bundle is publicly downloadable.
 *   - Unauthenticated GitHub allows 60 requests/hour; with `gh`'s token it is 5,000.
 *
 * The token is read from `gh auth token` at runtime. It is never written to disk, never passed
 * as an argument, and never stored in Firestore.
 *
 * Usage:
 *   npm run enrich:projects              # only projects never enriched, or stale (> 7 days)
 *   npm run enrich:projects -- --all     # re-read everything
 *   npm run enrich:projects -- --dry-run # show what would change, write nothing
 */

import { execFileSync } from 'node:child_process';
import { ask, askHidden } from './prompt.mjs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, collection, getDocs, doc, updateDoc, Timestamp, serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBMIDZfE0ko2Z7BKoTMNS4KeEfFxjUmx60',
  authDomain: 'creativoatwork-54e65.firebaseapp.com',
  projectId: 'creativoatwork-54e65',
  storageBucket: 'creativoatwork-54e65.firebasestorage.app',
  messagingSenderId: '296799029021',
  appId: '1:296799029021:web:a1335ba62a710499ab43f4',
};

const COLLECTION = 'projects';
const STALE_DAYS = 7;

const args = process.argv.slice(2);
const all = args.includes('--all');
const dryRun = args.includes('--dry-run');

const die = (m) => { console.error(`\nenrich: ${m}`); process.exit(1); };

// ---------------------------------------------------------------- token

let token;
try {
  token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
} catch {
  die('could not get a token from `gh auth token`. Run `gh auth login` first.');
}
if (!token) die('`gh auth token` returned nothing.');

// ---------------------------------------------------------------- shared detection logic
// Mirrors src/admin/data/enrich.ts. Kept as a copy rather than imported because that module is
// TypeScript compiled for the browser; if the detection tables change, change both.

const FRONTEND_DEPS = {
  react: 'React', vue: 'Vue', svelte: 'Svelte', '@angular/core': 'Angular',
  next: 'Next.js', nuxt: 'Nuxt', astro: 'Astro', '@remix-run/react': 'Remix',
  gatsby: 'Gatsby', vite: 'Vite', tailwindcss: 'Tailwind', '@sveltejs/kit': 'SvelteKit',
  'styled-components': 'styled-components', '@mui/material': 'MUI', bootstrap: 'Bootstrap',
};
const BACKEND_DEPS = {
  express: 'Express', fastify: 'Fastify', koa: 'Koa', '@nestjs/core': 'NestJS',
  'firebase-admin': 'Firebase Admin', firebase: 'Firebase', '@supabase/supabase-js': 'Supabase',
  '@prisma/client': 'Prisma', 'drizzle-orm': 'Drizzle', mongoose: 'Mongoose', pg: 'PostgreSQL',
  mysql2: 'MySQL', sequelize: 'Sequelize', typeorm: 'TypeORM', redis: 'Redis',
  stripe: 'Stripe', resend: 'Resend', nodemailer: 'Nodemailer', '@aws-sdk/client-s3': 'AWS S3',
  wrangler: 'Cloudflare Workers', hono: 'Hono',
};
const MARKER_FILES = {
  'composer.json': 'PHP / Composer', 'wp-config.php': 'WordPress', 'go.mod': 'Go',
  Gemfile: 'Ruby', 'requirements.txt': 'Python', 'pyproject.toml': 'Python',
  'Cargo.toml': 'Rust', Dockerfile: 'Docker', 'docker-compose.yml': 'Docker Compose',
  'wrangler.toml': 'Cloudflare Workers', 'firebase.json': 'Firebase Hosting',
  'vercel.json': 'Vercel', 'netlify.toml': 'Netlify', 'nuxt.config.ts': 'Nuxt',
  'next.config.js': 'Next.js', 'next.config.mjs': 'Next.js', 'astro.config.mjs': 'Astro',
  '.github': 'GitHub Actions',
};

const parseRepo = (u) => {
  const m = (u ?? '').trim().match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], name: m[2] } : null;
};

const gh = async (path, raw = false) => {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'User-Agent': 'creativoatwork-admindash',
    },
  });
  return r;
};

const doh = async (name, type) => {
  const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
  if (!r.ok) return [];
  const d = await r.json();
  return (d.Answer ?? []).map((a) => (a.data ?? '').replace(/\.$/, '')).filter(Boolean);
};

function classifyNs(ns) {
  const j = ns.join(' ').toLowerCase();
  if (j.includes('cloudflare')) return 'cloudflare';
  if (j.includes('awsdns')) return 'route53';
  if (j.includes('googledomains') || j.includes('google.com')) return 'google';
  if (j.includes('azure-dns')) return 'azure';
  if (j.includes('domaincontrol')) return 'godaddy';
  if (j.includes('nsone')) return 'ns1';
  if (j.includes('registrar-servers')) return 'namecheap';
  if (j.includes('porkbun')) return 'porkbun';
  if (j.includes('dnsimple')) return 'dnsimple';
  if (j.includes('vercel-dns')) return 'vercel';
  if (j.includes('digitalocean')) return 'digitalocean';
  if (j.includes('googledomains') || j.includes('google-domains')) return 'google';
  return ns.length ? 'other' : 'none';
}
function classifyHosting(list) {
  const j = list.join(' ').toLowerCase();
  if (j.includes('vercel')) return 'Vercel';
  if (j.includes('netlify')) return 'Netlify';
  if (j.includes('github.io')) return 'GitHub Pages';
  if (j.includes('firebase') || j.includes('web.app')) return 'Firebase Hosting';
  if (j.includes('shopify')) return 'Shopify';
  if (j.includes('wpengine')) return 'WP Engine';
  if (j.includes('googleusercontent') || j.includes('googlehosted')) return 'Google Cloud';
  return undefined;
}
function classifyMail(mx) {
  const j = mx.join(' ').toLowerCase();
  if (j.includes('google')) return 'Google Workspace';
  if (j.includes('outlook') || j.includes('microsoft')) return 'Microsoft 365';
  if (j.includes('zoho')) return 'Zoho';
  if (j.includes('proton')) return 'Proton';
  if (j.includes('improvmx')) return 'ImprovMX';
  return mx.length ? 'other' : undefined;
}

async function enrichOne(p) {
  const out = { source: 'cli' };
  const errors = [];

  const repo = parseRepo(p.repoUrl);
  if (repo) {
    out.repoOwner = repo.owner;
    out.repoName = repo.name;
    const base = `/repos/${repo.owner}/${repo.name}`;
    try {
      const meta = await gh(base);
      if (meta.status === 404) {
        errors.push('repo: 404 even with a token — repo missing, renamed, or outside this account');
      } else if (!meta.ok) {
        errors.push(`repo: HTTP ${meta.status}`);
      } else {
        const m = await meta.json();
        out.repoPrivate = !!m.private;
        out.repoArchived = !!m.archived;
        if (m.pushed_at) out.repoPushedAt = m.pushed_at;
        if (m.license?.spdx_id && m.license.spdx_id !== 'NOASSERTION') out.repoLicense = m.license.spdx_id;
        if (m.topics?.length) out.repoTopics = m.topics.slice(0, 10);

        const [langs, commits, contents] = await Promise.all([
          gh(`${base}/languages`), gh(`${base}/commits?per_page=1`), gh(`${base}/contents`),
        ]);

        if (langs.ok) {
          const l = await langs.json();
          const total = Object.values(l).reduce((a, b) => a + b, 0);
          if (total) {
            out.languages = Object.entries(l).sort((a, b) => b[1] - a[1]).slice(0, 5)
              .map(([n, b]) => `${n} ${Math.round((b / total) * 100)}%`);
          }
        }
        if (commits.ok) {
          const c = (await commits.json())[0];
          if (c) {
            out.lastCommitAuthor = c.author?.login || c.commit?.author?.name || 'unknown';
            out.lastCommitDate = c.commit?.author?.date;
            out.lastCommitMessage = String(c.commit?.message ?? '').split('\n')[0].slice(0, 140);
          }
        }
        let hasPkg = false;
        if (contents.ok) {
          const names = (await contents.json()).map((x) => x.name);
          hasPkg = names.includes('package.json');
          const markers = [...new Set(names.filter((n) => MARKER_FILES[n]).map((n) => MARKER_FILES[n]))];
          if (markers.length) out.markers = markers;
        }
        if (hasPkg) {
          const pkgRes = await gh(`${base}/contents/package.json`, true);
          if (pkgRes.ok) {
            try {
              const pkg = JSON.parse(await pkgRes.text());
              const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
              const fe = [...new Set(Object.keys(deps).filter((d) => FRONTEND_DEPS[d]).map((d) => FRONTEND_DEPS[d]))];
              const be = [...new Set(Object.keys(deps).filter((d) => BACKEND_DEPS[d]).map((d) => BACKEND_DEPS[d]))];
              if (fe.length) out.stackFrontend = fe;
              if (be.length) out.stackBackend = be;
            } catch { errors.push('repo: package.json could not be parsed'); }
          }
        }
      }
    } catch (e) { errors.push(`repo: ${e.message}`); }
  } else if (p.repoUrl) {
    errors.push('repo: not a github.com/owner/repo URL');
  }

  if (p.domain) {
    try {
      const [ns, cname, a, mx] = await Promise.all([
        doh(p.domain, 'NS'), doh(p.domain, 'CNAME'), doh(p.domain, 'A'), doh(p.domain, 'MX'),
      ]);
      const nameservers = ns.length ? ns : await doh(p.domain.split('.').slice(-2).join('.'), 'NS');
      out.nameservers = nameservers.slice(0, 6);
      out.dnsProvider = classifyNs(nameservers);
      const ips = a.filter((v) => /^[0-9.]+$/.test(v) || v.includes(':'));
      if (ips.length) {
        out.serverIps = ips.slice(0, 6);
        const ptr = await doh(`${ips[0].split('.').reverse().join('.')}.in-addr.arpa`, 'PTR');
        if (ptr.length) out.serverHostname = ptr[0];
      }
      const h = classifyHosting([...cname, ...a, out.serverHostname ?? '']); if (h) out.hostingHint = h;
      const m = classifyMail(mx); if (m) out.mailProvider = m;
    } catch (e) { errors.push(`dns: ${e.message}`); }
  }

  // Suggestions, mirroring suggest() in src/admin/data/enrich.ts. Change both together.
  const fe = out.stackFrontend ?? [], be = out.stackBackend ?? [], mk = out.markers ?? [];
  if (mk.includes('WordPress')) out.suggestedFrontend = 'wordpress';
  else if (fe.includes('Next.js')) out.suggestedFrontend = 'next';
  else if (fe.includes('Nuxt') || fe.includes('Vue')) out.suggestedFrontend = 'vue';
  else if (fe.includes('SvelteKit') || fe.includes('Svelte')) out.suggestedFrontend = 'svelte';
  else if (fe.includes('Astro')) out.suggestedFrontend = 'astro';
  else if (fe.includes('React')) out.suggestedFrontend = 'react';
  else if (out.languages?.length && !fe.length) out.suggestedFrontend = 'static';

  if (mk.includes('WordPress')) out.suggestedDatabase = 'wordpress-mysql';
  else if (be.includes('PostgreSQL') || be.includes('Supabase')) out.suggestedDatabase = 'postgres';
  else if (be.includes('MySQL')) out.suggestedDatabase = 'mysql';
  else if (be.includes('Mongoose')) out.suggestedDatabase = 'mongo';
  else if (be.includes('Firebase') || be.includes('Firebase Admin')) out.suggestedDatabase = 'firestore';

  if (mk.includes('Firebase Hosting')) out.suggestedHost = 'firebase';
  else if (mk.includes('Vercel')) out.suggestedHost = 'vercel';
  else if (mk.includes('Netlify')) out.suggestedHost = 'netlify';
  else if (mk.includes('Cloudflare Workers')) out.suggestedHost = 'cloudflare';
  else if (out.hostingHint === 'Vercel') out.suggestedHost = 'vercel';
  else if (out.hostingHint === 'Netlify') out.suggestedHost = 'netlify';
  else if (out.hostingHint === 'Firebase Hosting') out.suggestedHost = 'firebase';
  else if (out.hostingHint === 'Google Cloud') out.suggestedHost = 'gcp';

  if (out.repoArchived) out.suggestedStatus = 'archived';

  if (errors.length) out.errors = errors;
  return out;
}

// ---------------------------------------------------------------- run

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let email, password;
try {
  email = await ask('Admin email: ');
  password = await askHidden('Password: ');   // never echoed - see scripts/prompt.mjs
} catch (e) {
  die(`${e.message}. This script needs an interactive terminal — run it directly, not through a wrapper that captures output.`);
}

try {
  await signInWithEmailAndPassword(auth, email.trim(), password);
} catch (e) {
  die(`sign-in failed (${e.code ?? 'unknown'}). The Email/Password provider must be enabled and this account must be on the rules allowlist.`);
}
console.log(`enrich: signed in as ${auth.currentUser?.email}`);

const snap = await getDocs(collection(db, COLLECTION));
const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;

const todo = snap.docs.filter((d) => {
  if (all) return true;
  const at = d.data().enrichedAt;
  return !at || (at instanceof Timestamp && at.toDate().getTime() < cutoff);
});

console.log(`enrich: ${todo.length} of ${snap.size} project(s) to read${dryRun ? ' (dry run)' : ''}`);

let ok = 0, failed = 0;
for (const d of todo) {
  const p = d.data();
  const label = p.name || d.id;
  try {
    const enrichment = await enrichOne(p);
    const notes = [
      enrichment.stackFrontend?.join('/'),
      enrichment.stackBackend?.join('/'),
      enrichment.dnsProvider,
      enrichment.lastCommitAuthor && `last: ${enrichment.lastCommitAuthor}`,
    ].filter(Boolean).join(' · ');
    if (dryRun) {
      console.log(`  would update  ${label}  ${notes}`);
    } else {
      await updateDoc(doc(db, COLLECTION, d.id), {
        enrichment,
        enrichedAt: Timestamp.now(),
        // MUST be a server timestamp: the update rule requires updatedAt == request.time, and a
        // client clock will not match it.
        updatedAt: serverTimestamp(),
      });
      console.log(`  updated  ${label}  ${notes}`);
    }
    if (enrichment.errors?.length) {
      for (const e of enrichment.errors) console.log(`      ! ${e}`);
    }
    ok++;
  } catch (e) {
    console.error(`  FAILED   ${label}: ${e.code ?? e.message}`);
    failed++;
  }
}

console.log(`enrich: ${ok} succeeded, ${failed} failed.`);
process.exit(failed ? 1 : 0);
