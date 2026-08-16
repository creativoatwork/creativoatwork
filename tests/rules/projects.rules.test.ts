import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, expect, test } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, deleteDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';

/**
 * These tests are the only thing that proves the access control works. Everything else in the
 * dashboard is a convenience on top of them.
 *
 * The rules file ships with placeholder UIDs so a first deployment is deny-all. The suite
 * substitutes a real test UID into the same allowlist shape, so what is exercised is the
 * production rule text, not a rewritten copy.
 */

const ADMIN = 'admin-uid-under-test';
const OTHER = 'some-other-signed-in-user';

const rules = readFileSync('firestore.rules', 'utf8')
  .replace("'UID_PLACEHOLDER_1'", `'${ADMIN}'`);

let env: RulesTestEnvironment;

const validDoc = (over: Record<string, unknown> = {}) => ({
  name: 'Good AI News',
  description: 'A news site.',
  repoUrl: 'https://github.com/creativoatwork/goodai',
  domain: 'goodai.news',
  host: 'vercel',
  frontend: 'next',
  database: 'postgres',
  status: 'active',
  notes: 'Notes.',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...over,
});

const adminDb = () => env.authenticatedContext(ADMIN).firestore();
const otherDb = () => env.authenticatedContext(OTHER).firestore();
const anonDb = () => env.unauthenticatedContext().firestore();

/** Seed a document bypassing rules, so update/delete cases start from a real stored doc. */
async function seed(id: string, data: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'projects', id), {
      ...validDoc(),
      createdAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
      updatedAt: Timestamp.fromDate(new Date('2026-01-02T00:00:00Z')),
      ...data,
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-admindash',
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

describe('identity', () => {
  test('unauthenticated cannot read', async () => {
    await seed('a');
    await assertFails(getDoc(doc(anonDb(), 'projects', 'a')));
  });

  test('unauthenticated cannot write', async () => {
    await assertFails(setDoc(doc(anonDb(), 'projects', 'a'), validDoc()));
  });

  test('a signed-in non-allowlisted user is refused every operation', async () => {
    await seed('a');
    await assertFails(getDoc(doc(otherDb(), 'projects', 'a')));
    await assertFails(setDoc(doc(otherDb(), 'projects', 'b'), validDoc()));
    await assertFails(deleteDoc(doc(otherDb(), 'projects', 'a')));
  });

  test('admin can read, create and delete', async () => {
    await assertSucceeds(setDoc(doc(adminDb(), 'projects', 'a'), validDoc()));
    await assertSucceeds(getDoc(doc(adminDb(), 'projects', 'a')));
    await assertSucceeds(deleteDoc(doc(adminDb(), 'projects', 'a')));
  });
});

describe('shape', () => {
  test('missing a required field is refused', async () => {
    const d = validDoc() as Record<string, unknown>;
    delete d.notes;
    await assertFails(setDoc(doc(adminDb(), 'projects', 'a'), d));
  });

  test('an unknown extra field is refused', async () => {
    await assertFails(setDoc(doc(adminDb(), 'projects', 'a'), validDoc({ secret: 'x' })));
  });

  test.each([
    ['host', 'heroku'], ['frontend', 'ember'], ['database', 'oracle'], ['status', 'paused'],
  ])('an invalid %s value is refused', async (field, value) => {
    await assertFails(setDoc(doc(adminDb(), 'projects', 'a'), validDoc({ [field]: value })));
  });

  test.each([
    ['name', 123], ['description', null], ['notes', ['a']], ['domain', 5], ['status', true],
  ])('a wrong-typed %s is refused', async (field, value) => {
    await assertFails(setDoc(doc(adminDb(), 'projects', 'a'), validDoc({ [field]: value })));
  });

  test('empty name is refused, 200 chars allowed, 201 refused', async () => {
    await assertFails(setDoc(doc(adminDb(), 'projects', 'a'), validDoc({ name: '' })));
    await assertSucceeds(setDoc(doc(adminDb(), 'projects', 'b'), validDoc({ name: 'x'.repeat(200) })));
    await assertFails(setDoc(doc(adminDb(), 'projects', 'c'), validDoc({ name: 'x'.repeat(201) })));
  });

  test('length ceilings hold exactly', async () => {
    await assertSucceeds(setDoc(doc(adminDb(), 'projects', 'ok1'), validDoc({ description: 'x'.repeat(2000) })));
    await assertFails(setDoc(doc(adminDb(), 'projects', 'no1'), validDoc({ description: 'x'.repeat(2001) })));
    await assertSucceeds(setDoc(doc(adminDb(), 'projects', 'ok2'), validDoc({ notes: 'x'.repeat(10000) })));
    await assertFails(setDoc(doc(adminDb(), 'projects', 'no2'), validDoc({ notes: 'x'.repeat(10001) })));
  });
});

describe('domain', () => {
  test.each(['goodai.news', 'sub.domain.example.co.uk', 'xn--80ak6aa92e.com', 'a-b.io'])(
    'accepts %s', async (domain) => {
      await assertSucceeds(setDoc(doc(adminDb(), 'projects', 'd'), validDoc({ domain })));
    });

  test.each([
    '', 'Example.com', 'example.com.', 'localhost', 'https://example.com',
    'example .com', '-bad.com', 'bad-.com', `${'a'.repeat(64)}.com`,
  ])('refuses %s', async (domain) => {
    await assertFails(setDoc(doc(adminDb(), 'projects', 'd'), validDoc({ domain })));
  });
});

describe('repoUrl', () => {
  test('empty is allowed', async () => {
    await assertSucceeds(setDoc(doc(adminDb(), 'projects', 'r'), validDoc({ repoUrl: '' })));
  });

  test.each([
    'http://github.com/a/b',
    'https://github.com/a/b/',
    'https://gitlab.com/a/b',
    'https://github.com/-bad/repo',
    'https://github.com/bad-/repo',
    `https://github.com/owner/${'r'.repeat(101)}`,
  ])('refuses %s', async (repoUrl) => {
    await assertFails(setDoc(doc(adminDb(), 'projects', 'r'), validDoc({ repoUrl })));
  });
});

describe('timestamps', () => {
  test('server timestamps are accepted on create', async () => {
    await assertSucceeds(setDoc(doc(adminDb(), 'projects', 't'), validDoc()));
  });

  test('historical timestamps are accepted on create — this is the restore path', async () => {
    await assertSucceeds(setDoc(doc(adminDb(), 'projects', 't'), validDoc({
      createdAt: Timestamp.fromDate(new Date('2024-03-01T00:00:00Z')),
      updatedAt: Timestamp.fromDate(new Date('2024-04-01T00:00:00Z')),
    })));
  });

  test('a future createdAt or updatedAt is refused', async () => {
    const future = Timestamp.fromDate(new Date(Date.now() + 60 * 60 * 1000));
    await assertFails(setDoc(doc(adminDb(), 'projects', 'f1'), validDoc({ createdAt: future })));
    await assertFails(setDoc(doc(adminDb(), 'projects', 'f2'), validDoc({ updatedAt: future })));
  });

  test('a missing timestamp is refused', async () => {
    const d = validDoc() as Record<string, unknown>;
    delete d.createdAt;
    await assertFails(setDoc(doc(adminDb(), 'projects', 'm'), d));
  });

  test('a string in place of a timestamp is refused', async () => {
    await assertFails(setDoc(doc(adminDb(), 'projects', 's'), validDoc({ createdAt: '2026-01-01' })));
  });
});

describe('update', () => {
  test('a valid update succeeds', async () => {
    await seed('u');
    await assertSucceeds(setDoc(doc(adminDb(), 'projects', 'u'), validDoc({
      name: 'Renamed',
      createdAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
      updatedAt: serverTimestamp(),
    })));
  });

  test('changing createdAt is refused', async () => {
    await seed('u');
    await assertFails(setDoc(doc(adminDb(), 'projects', 'u'), validDoc({
      createdAt: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')),
      updatedAt: serverTimestamp(),
    })));
  });

  test('a stale updatedAt is refused — restore must clear before writing, not overwrite', async () => {
    await seed('u');
    await assertFails(setDoc(doc(adminDb(), 'projects', 'u'), validDoc({
      createdAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
      updatedAt: Timestamp.fromDate(new Date('2026-01-02T00:00:00Z')),
    })));
  });

  test('an update dropping a field is refused', async () => {
    await seed('u');
    const d = validDoc({
      createdAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
      updatedAt: serverTimestamp(),
    }) as Record<string, unknown>;
    delete d.notes;
    await assertFails(setDoc(doc(adminDb(), 'projects', 'u'), d));
  });
});

describe('other collections', () => {
  test('every other collection is denied, even for an admin', async () => {
    await assertFails(setDoc(doc(adminDb(), 'secrets', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(adminDb(), 'secrets', 'x')));
    await assertFails(setDoc(doc(adminDb(), 'projects_backup', 'x'), validDoc()));
  });
});
