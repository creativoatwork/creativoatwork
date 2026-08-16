#!/usr/bin/env node
/**
 * Restore the `projects` collection from a JSON export produced by the dashboard's
 * "Download JSON" action.
 *
 * Runs entirely under the production Security Rules. No temporary rule relaxation, no service
 * account, no Admin SDK — an earlier design did relax rules for the duration of a restore, which
 * meant a failure mid-run could leave production validation switched off.
 *
 * Three phases, in this order and for this reason:
 *
 *   1. VALIDATE the whole file before touching anything. Nothing is deleted until the source is
 *      proven complete and well-formed.
 *   2. CLEAR the collection.
 *   3. CREATE every document by its original ID.
 *
 * Phase 2 exists because of a rules detail that is easy to get wrong: setDoc against an
 * EXISTING document is an *update*, and the update rule requires `updatedAt == request.time`.
 * Replaying a backup's historical updatedAt over a live document is therefore refused. Writing
 * into an empty collection makes every write a *create*, which accepts historical timestamps —
 * so the original createdAt and updatedAt survive the round trip.
 *
 * That ordering is also what makes a re-run converge: phase 2 removes whatever a half-finished
 * phase 3 left behind.
 *
 * Usage:
 *   npm run restore:projects -- <file.json> [--force] [--emulator]
 */

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, collection, doc, getDocs,
  writeBatch, Timestamp,
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
const BATCH_LIMIT = 500;

const HOSTS = ['firebase','digitalocean','lovable','vercel','netlify','cloudflare','aws','wordpress-host','other','unknown'];
const FRONTENDS = ['react','next','vue','svelte','astro','wordpress','static','other','unknown'];
const DATABASES = ['postgres','mysql','firestore','mongo','sqlite','wordpress-mysql','none','unknown'];
const STATUSES = ['active','maintenance','archived'];
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{0,57}[a-z0-9])$/;
const REPO_RE = /^https:\/\/github\.com\/[A-Za-z0-9]+(-[A-Za-z0-9]+)*\/[A-Za-z0-9._-]{1,100}$/;

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const force = args.includes('--force');
const useEmulator = args.includes('--emulator');

const die = (msg) => { console.error(`\nrestore: ${msg}`); process.exit(1); };

if (!file) die('usage: npm run restore:projects -- <file.json> [--force] [--emulator]');

// ---------------------------------------------------------------- phase 1: validate

let backup;
try {
  backup = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  die(`could not read or parse ${file}: ${e.message}`);
}

if (backup.schemaVersion !== 1) die(`unsupported schemaVersion ${backup.schemaVersion}; expected 1`);
if (!Array.isArray(backup.projects)) die('malformed backup: "projects" is not an array');
if (backup.projectCount !== backup.projects.length) {
  die(`truncated backup: projectCount ${backup.projectCount} but ${backup.projects.length} documents present`);
}

const problems = [];
const ids = new Set();
const str = (v) => typeof v === 'string';

backup.projects.forEach((p, i) => {
  const at = `projects[${i}]${p?.id ? ` (${p.id})` : ''}`;
  if (!str(p?.id) || !p.id) return problems.push(`${at}: missing id`);
  if (ids.has(p.id)) problems.push(`${at}: duplicate id`);
  ids.add(p.id);
  if (!str(p.name) || !p.name.length || p.name.length > 200) problems.push(`${at}: name must be 1-200 chars`);
  if (!str(p.description) || p.description.length > 2000) problems.push(`${at}: description too long`);
  if (!str(p.notes) || p.notes.length > 10000) problems.push(`${at}: notes too long`);
  if (!str(p.domain) || !DOMAIN_RE.test(p.domain)) problems.push(`${at}: domain "${p.domain}" is not a valid hostname`);
  if (!str(p.repoUrl) || (p.repoUrl !== '' && (!REPO_RE.test(p.repoUrl) || p.repoUrl.length > 140))) {
    problems.push(`${at}: repoUrl must be empty or a GitHub URL`);
  }
  if (!HOSTS.includes(p.host)) problems.push(`${at}: invalid host "${p.host}"`);
  if (!FRONTENDS.includes(p.frontend)) problems.push(`${at}: invalid frontend "${p.frontend}"`);
  if (!DATABASES.includes(p.database)) problems.push(`${at}: invalid database "${p.database}"`);
  if (!STATUSES.includes(p.status)) problems.push(`${at}: invalid status "${p.status}"`);
  if (p.enrichment !== undefined && (typeof p.enrichment !== 'object' || p.enrichment === null || Array.isArray(p.enrichment))) {
    problems.push(`${at}: enrichment must be an object when present`);
  } else if (p.enrichment && Object.keys(p.enrichment).length > 25) {
    problems.push(`${at}: enrichment has more than 25 keys; the rules will refuse it`);
  }
  if (p.enrichedAt != null && Number.isNaN(Date.parse(p.enrichedAt))) {
    problems.push(`${at}: enrichedAt must be an ISO timestamp or null`);
  }
  for (const k of ['createdAt', 'updatedAt']) {
    const t = Date.parse(p[k]);
    if (Number.isNaN(t)) problems.push(`${at}: ${k} is not an ISO timestamp`);
    else if (t > Date.now()) problems.push(`${at}: ${k} is in the future; the rules will refuse it`);
  }
});

if (problems.length) {
  console.error(`restore: refusing to run — ${problems.length} problem(s) in ${file}:`);
  for (const p of problems.slice(0, 20)) console.error(`  - ${p}`);
  if (problems.length > 20) console.error(`  … and ${problems.length - 20} more`);
  process.exit(1);
}

console.log(`restore: ${file} validated — ${backup.projects.length} documents, exported ${backup.exportedAt}`);

// ---------------------------------------------------------------- connect

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
if (useEmulator) connectFirestoreEmulator(db, '127.0.0.1', 8080);

const rl = createInterface({ input: stdin, output: stdout });
const email = await rl.question('Admin email: ');
// Node has no hidden-input primitive in readline; the password is not echoed to a file or the
// repo, and is never stored. It exists only for the lifetime of this process.
const password = await rl.question('Password (input is visible): ');
rl.close();

try {
  await signInWithEmailAndPassword(auth, email.trim(), password);
} catch (e) {
  die(`sign-in failed (${e.code ?? 'unknown'}). The Email/Password provider must be enabled and this account must be on the rules allowlist.`);
}
console.log(`restore: signed in as ${auth.currentUser?.email} (${auth.currentUser?.uid})`);

// ---------------------------------------------------------------- phase 2: clear

const col = collection(db, COLLECTION);
const existing = await getDocs(col);

if (!existing.empty && !force) {
  die(`${COLLECTION} already holds ${existing.size} document(s). Re-run with --force to replace them.`);
}

if (!existing.empty) {
  console.log(`restore: clearing ${existing.size} existing document(s)…`);
  const docs = existing.docs;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + BATCH_LIMIT)) batch.delete(d.ref);
    await batch.commit();
  }
}

// ---------------------------------------------------------------- phase 3: create

console.log(`restore: writing ${backup.projects.length} document(s)…`);
for (let i = 0; i < backup.projects.length; i += BATCH_LIMIT) {
  const chunk = backup.projects.slice(i, i + BATCH_LIMIT);
  const batch = writeBatch(db);
  for (const p of chunk) {
    batch.set(doc(db, COLLECTION, p.id), {
      name: p.name,
      description: p.description,
      repoUrl: p.repoUrl,
      domain: p.domain,
      host: p.host,
      frontend: p.frontend,
      database: p.database,
      status: p.status,
      notes: p.notes,
      enrichment: p.enrichment ?? {},
      enrichedAt: p.enrichedAt ? Timestamp.fromDate(new Date(p.enrichedAt)) : null,
      createdAt: Timestamp.fromDate(new Date(p.createdAt)),
      updatedAt: Timestamp.fromDate(new Date(p.updatedAt)),
    });
  }
  try {
    await batch.commit();
  } catch (e) {
    die(`batch starting at index ${i} failed (${e.code ?? 'unknown'}). Nothing is lost — re-run the same command with --force and it will clear and rewrite from scratch.`);
  }
}

// ------------------------------------------------- verify by content, not just by count

const after = await getDocs(col);
const stored = new Map(after.docs.map((d) => [d.id, d.data()]));
const mismatches = [];

if (stored.size !== backup.projects.length) {
  mismatches.push(`collection holds ${stored.size} documents, expected ${backup.projects.length}`);
}
for (const p of backup.projects) {
  const s = stored.get(p.id);
  if (!s) { mismatches.push(`${p.id}: missing after restore`); continue; }
  for (const k of ['name','description','repoUrl','domain','host','frontend','database','status','notes']) {
    if (s[k] !== p[k]) mismatches.push(`${p.id}.${k}: stored "${s[k]}" != file "${p[k]}"`);
  }
  if (JSON.stringify(s.enrichment ?? {}) !== JSON.stringify(p.enrichment ?? {})) {
    mismatches.push(`${p.id}.enrichment: does not match the file`);
  }
  for (const k of ['createdAt','updatedAt']) {
    const got = s[k] instanceof Timestamp ? s[k].toDate().toISOString() : String(s[k]);
    if (got !== new Date(p[k]).toISOString()) mismatches.push(`${p.id}.${k}: stored ${got} != file ${p[k]}`);
  }
}
for (const id of stored.keys()) {
  if (!ids.has(id)) mismatches.push(`${id}: present in the collection but not in the backup`);
}

if (mismatches.length) {
  console.error(`restore: FAILED verification — ${mismatches.length} mismatch(es):`);
  for (const m of mismatches.slice(0, 20)) console.error(`  - ${m}`);
  process.exit(1);
}

console.log(`restore: verified ${stored.size} document(s) match ${file} exactly.`);
process.exit(0);
