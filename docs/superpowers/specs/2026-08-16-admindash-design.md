# `/admindash` — private multi-project aggregator

**Status:** design v4 — corrected after Codex re-review of v3, awaiting second re-review
**Date:** 2026-08-16
**Repo:** creativoatwork (Vite + React + TS + Tailwind 4, Firebase Hosting, Cloudflare Worker)

A private dashboard for tracking the studio's projects — hosting, stack, status, notes — added
to this repository as a second, isolated application surface.

## Revision history

**v1** proposed the dashboard plus a `/inspect` endpoint on the existing Cloudflare Worker that
would fetch arbitrary third-party domains to infer their hosting and stack.

**v2** was a rewrite after Codex rejected v1, hardening the Firestore rules, the JWT contract,
and the SSRF controls.

**v3 deletes the `/inspect` endpoint entirely.** Eight of Codex's fifteen HIGH findings existed
only because of it. What it bought was pre-filling two dropdowns, once per project, across a
dataset of a few dozen projects — against the cost of a JWT verifier, a hardened URL-fetching
surface, and a change to the Worker that serves the live contact form. That trade was wrong, and
the operator was right to challenge it.

**Consequences of the cut:** this feature now touches **no Cloudflare infrastructure at all**.
`worker/`, `wrangler.toml`, and the contact form are entirely out of scope, so the production
email path carries zero risk from this work. The Worker stays as it is — working, deployed, free
— and Wrangler is needed only if the contact form itself changes.

Auto-population is recorded in `backlog.md` as deliberately deferred, to be revisited only if
manual entry proves annoying in real use.

**v4 corrects v3 after a second Codex pass**, which confirmed every `/inspect`-related removal
was genuine but found the spec still not implementable. Fixed: the CSP omitted
`https://apis.google.com` from `script-src` and would have blocked Google sign-in entirely
(§3.2); only the Google provider was being enabled while §4 implements an email/password
fallback (§9.2); `domain` and `repoUrl` were length-capped but not shape-validated (§5); the JSON
export was an undefined blob rather than a recovery plan (§7); CSS/JS isolation was gated on hash
equality, which is the wrong test (§9.4); the rules test matrix under-tested its own constraints
(§9.3); and "quota monitoring" was arithmetic wearing a monitoring label (§10). Six FIX
dispositions in §13 were overclaims and are relabelled honestly.

---

## 1. Rule overrides this feature requires

`.ai/CLAUDE.md` currently forbids four of the things below. Each is overridden by explicit
instruction, and each override is deliberately narrow, so a later session does not read the
feature as a violation and "fix" it.

| Existing rule | Override | Boundary |
|---|---|---|
| "This repository is a marketing site, not an application platform." | Lifted for `/admindash` only. | No admin concern may leak into `src/components/` or `src/App.tsx`. |
| "Do not add Firebase Auth, Firestore, Storage, or Cloud Functions. Firebase is a static host here." | Auth and Firestore are now in use. | Admin entry point only. The marketing bundle must contain zero Firebase code. Storage and Functions remain forbidden. |
| "Do not add a state manager, router, component library, or CSS framework alongside Tailwind." | A router is added. | `react-router-dom`, imported only under `src/admin/`. No state manager, no component library. |
| "The only automated gate is `npm run build`. There are no tests." | A test runner is added. | Vitest, scoped to **Firestore Security Rules only**. Rules are the security boundary and cannot be verified by inspection. This obliges no coverage anywhere else. |

`.ai/CONTEXT.md` states "no Firebase SDK in the client bundle." That stays true of the
*marketing* bundle and becomes false of the *admin* bundle. Both files are updated at
implementation time; the overrides go in `.ai/decisions.md`.

---

## 2. Constraints

1. **The marketing build prerenders.** `scripts/prerender.mjs` injects `renderToString(<App/>)`
   into `dist/index.html` and throws if the result is under 1000 bytes.
2. **Hosting rewrites `**` → `/index.html`,** so a naive `/admindash` route would serve the
   prerendered marketing HTML and hydrate into the admin app.
3. **Bundle weight is a marketing-site concern.** The public bundle is 168KB / 53KB gzipped.
4. **Client-side authorization is not authorization.** Firestore's REST API is reachable by any
   authenticated user with the public project ID. Security Rules are the gate for client SDK and
   REST access. They do **not** constrain the Admin SDK or any principal holding a
   service-account key or `datastore.user` IAM role. No service-account key is created by this
   work and none may be committed; project IAM should be reviewed for unexpected principals
   before launch.
5. **Firestore is not yet provisioned** — `firestore:databases:list` returns 403, API disabled.
6. **Spark (free) plan.** Firestore and Auth are both available; quota exposure is in §10.
7. **The Cloudflare Worker is out of scope.** No file under `worker/` changes.

---

## 3. Architecture

### 3.1 Two entry points

```
index.html       →  src/main.tsx        marketing   prerendered   no Firebase
admindash.html   →  src/admin/main.tsx  admin       never prerendered
```

`vite.config.ts` gains a second Rollup input. `scripts/prerender.mjs` is untouched — it reads
only `dist/index.html`, and the admin entry emits `dist/admindash.html`.

### 3.2 Hosting

`cleanUrls: true` already serves `/admindash` from `dist/admindash.html`. Only the sub-route
needs a rewrite, placed before the catch-all:

```jsonc
"rewrites": [
  { "source": "/admindash/**", "destination": "/admindash.html" },
  { "source": "**",            "destination": "/index.html" }
]
```

Headers for the admin surface:

```jsonc
{ "source": "/admindash{,/**}", "headers": [
  { "key": "X-Robots-Tag",    "value": "noindex, nofollow" },
  { "key": "Cache-Control",   "value": "no-store" },
  { "key": "X-Frame-Options", "value": "DENY" },
  { "key": "Content-Security-Policy", "value":
    "default-src 'self'; script-src 'self' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com; frame-src https://apis.google.com https://creativoatwork-54e65.firebaseapp.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" }
]}
```

**`script-src` must include `https://apis.google.com`.** Firebase's browser popup resolver
dynamically loads `https://apis.google.com/js/api.js` before opening the auth iframe, so
`script-src 'self'` blocks sign-in outright — `frame-src` alone is not sufficient. This was
wrong in v3 and would have shipped a dashboard nobody could log into. `style-src` and `font-src`
cover Google Fonts because `admindash.html` uses the same Geist stack as the marketing page.

**Verification precedes production, not follows it.** The CSP is validated on a Firebase Hosting
**preview channel** (`firebase hosting:channel:deploy admindash-csp`, available on Spark) with a
full sign-in round trip and a clean console, before any promotion to live. v3 deployed the
header in step 5 and only checked it in step 8, which was not verification — it was hoping.

### 3.3 Routing

`react-router-dom`, mounted only in the admin entry, `basename="/admindash"`, `createRoot` (no
hydration — admin HTML is never prerendered).

```
/admindash        → ProjectsPage
/admindash/:id    → ProjectPage
/admindash/*      → redirect to /admindash
```

### 3.4 CSS separation

Tailwind 4 scans automatically, so a single shared `index.css` would emit admin utilities into
the marketing stylesheet.

- `src/theme.css` — the `@theme` token block, extracted and shared, so both surfaces use the
  same colors and type scale.
- `src/index.css` (marketing) — imports Tailwind with explicit scoping that excludes admin
  sources: `@import "tailwindcss" source(none);` plus `@source` for `../index.html`,
  `./components`, `./App.tsx`, `./main.tsx`.
- `src/admin/admin.css` — imports Tailwind scoped to `./` only, plus `src/theme.css`.

**Verification:** by selector-set subset check, not by hash — see §9.4. Extracting `@theme` into
`theme.css` can legitimately change the marketing stylesheet's hash without any admin utility
leaking, so hash equality would fail for the wrong reason and prove nothing when it passed.

### 3.5 File layout

```
admindash.html
src/theme.css                     shared @theme tokens only
src/admin/
  main.tsx                        React root, router, AuthProvider
  admin.css                       Tailwind scoped to src/admin
  firebase.ts                     app init, auth + db, explicit persistence, dev emulator
  config.ts                       public Firebase web config, admin email allowlist
  auth/  AuthProvider.tsx  SignInCard.tsx  RequireAuth.tsx
  data/  projects.ts  types.ts  export.ts
  pages/ ProjectsPage.tsx  ProjectPage.tsx
  components/ ProjectTable.tsx  FilterBar.tsx  AddProjectModal.tsx
              ProjectForm.tsx  Field.tsx  States.tsx  DeleteDialog.tsx
firestore.rules
firestore.indexes.json
tests/rules/projects.rules.test.ts
vitest.config.ts
```

`projects.ts` is the only module importing `firebase/firestore`; pages never touch the SDK.

---

## 4. Authentication

Google sign-in via `signInWithPopup`. Signed-out state is a single card — no marketing chrome,
no navigation.

Permitted identities: `creativoatwork@gmail.com` and `simone@creativoatwork.com`. Whether the
second is a Google identity is unconfirmed; the allowlist holds one or two UIDs either way.

**Email/password fallback is implemented, not hypothetical.** `SignInCard` carries a "Sign in
with email instead" disclosure with an email/password form calling
`signInWithEmailAndPassword`. There is no sign-up path and no in-app password reset — accounts
are created by hand in the console. If the second address turns out to be a Google identity, the
disclosure stays and goes unused.

**Persistence is explicit:** `setPersistence(auth, browserLocalPersistence)` before any sign-in
call, stated rather than inherited from the SDK default. A Sign out control is always visible
when signed in.

**The UI email check is a convenience, not the gate.** `RequireAuth` compares the signed-in email
to the allowlist and renders the sign-in card on mismatch. That prevents an accidental
wrong-account session and nothing more; the code says so in a comment.

**Bootstrap** — Auth does not depend on Firestore, so there is no cycle: sign in → the card
displays the UID → paste into `firestore.rules` → deploy → reload.

---

## 5. Security Rules

These ship and are verified before any UI is deployed.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function adminUids() {
      return [
        'UID_PLACEHOLDER_1',
        // 'UID_PLACEHOLDER_2',
      ];
    }

    function isAdmin() {
      return request.auth != null && request.auth.uid in adminUids();
    }

    function fields() {
      return ['name','description','repoUrl','domain','host',
              'frontend','database','status','notes','createdAt','updatedAt'];
    }

    function validShape(d) {
      return d.keys().hasAll(fields())
        && d.keys().hasOnly(fields())
        && d.name        is string && d.name.size() > 0 && d.name.size() <= 200
        && d.description is string && d.description.size() <= 2000
        && d.domain      is string && d.domain.size() > 0 && d.domain.size() <= 253
        && d.domain.matches('^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')
        && d.repoUrl     is string && d.repoUrl.size() <= 300
        && (d.repoUrl == '' || d.repoUrl.matches('^https://github\\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/?$'))
        && d.notes       is string && d.notes.size() <= 10000
        && d.host     in ['firebase','digitalocean','lovable','vercel','netlify',
                          'cloudflare','aws','wordpress-host','other','unknown']
        && d.frontend in ['react','next','vue','svelte','astro','wordpress',
                          'static','other','unknown']
        && d.database in ['postgres','mysql','firestore','mongo','sqlite',
                          'wordpress-mysql','none','unknown']
        && d.status   in ['active','maintenance','archived']
        && d.createdAt is timestamp
        && d.updatedAt is timestamp;
    }

    match /projects/{projectId} {
      allow read:   if isAdmin();

      allow create: if isAdmin()
        && validShape(request.resource.data)
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if isAdmin()
        && validShape(request.resource.data)
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.updatedAt == request.time;

      allow delete: if isAdmin();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Four deliberate choices:

- **UID allowlist, not email.** A UID is immutable. `token.email` would additionally require an
  `email_verified` check to be safe.
- **`hasAll` *and* `hasOnly`.** `hasOnly` alone permits *omitting* required fields — a client
  could drop `createdAt` entirely.
- **Timestamps pinned to `request.time`.** The client writes `serverTimestamp()`; anything else
  is rejected. `createdAt` is immutable across updates by direct comparison to `resource.data`,
  which is stronger and simpler here than `diff().affectedKeys()` given every field is validated
  on every write.
- **Global `if false` catch-all.** Adding a collection later requires a deliberate rule.
- **`domain` and `repoUrl` are shape-validated, not merely length-capped.** v3 claimed domain was
  required in the UI while the rules accepted `""` or arbitrary text. The rules are now the
  authority: `domain` must look like a hostname, and `repoUrl` must be empty or a GitHub URL.

Because `updatedAt` is mandatory and pinned, the §6 `orderBy('updatedAt')` cannot silently hide
documents — a document lacking it cannot exist.

**What the rules deliberately do not prevent.** Any UID on the allowlist can delete any document.
That is inherent — these are the owner accounts, and an authorization rule cannot distinguish an
intentional delete from a regretted one. The typed confirmation in §7 is a guard against
*accident*, not an authorization control, and is trivially bypassed via the SDK or REST. Recovery
posture is §10, and it is weak by construction on the free plan.

---

## 6. Data model

Firestore collection `projects`, one document per project, auto-ID. Fields, types, and limits are
exactly those enforced in §5.

Enums are TypeScript union types in `types.ts` with a matching label array driving both the
filter controls and the form selects. **`firestore.rules` and `types.ts` must change together** —
adding an enum value to one alone produces writes the rules reject. Each carries a comment
pointing at the other.

`unknown` is a first-class value, not a null; the table renders it as a muted dash. A project
whose stack has not been established is a normal state.

**Querying.** Single query, `orderBy('updatedAt', 'desc')`, no `limit`. Search and filtering are
client-side: the realistic dataset is tens of documents, server-side filtering across four
dimensions would need composite indexes, and Firestore cannot do substring search at all.
`firestore.indexes.json` ships effectively empty. Revisit past ~500 documents — recorded in
`backlog.md`, not pre-built.

---

## 7. UI

Dense, keyboard-friendly, and visually distinct from the marketing site. It uses the shared
`@theme` tokens so it is coherent without being a pastiche of the studio's brand work.

**Table** — name + domain, host, frontend, database, status pill, updated. Row click navigates.
Sortable headers, sticky header, `tabular-nums` dates, truncation with `title` on overflow.

**Filter bar** — text input across name, domain, description, and notes; three selects (host,
stack, status); an active-filter count with one-click clear. Filter state lives in the URL query
string, so a filtered view is linkable and survives reload.

**Add Project modal** — domain field plus the same form as the detail view. No network call, no
detection. Sensible defaults (`status: active`, everything else `unknown`), full keyboard entry,
tab order following the visual order. Domain is the only required field beyond name; everything
else can be filled in later. Focus trapped, `Esc` closes, focus returns to the trigger, real
`<label>` elements throughout.

**Detail view** — the same form component, populated. Explicit Save, no autosave. Dirty state
blocks navigation with a confirm.

**Delete** — typed confirmation: the project's name must be entered. Never a bare button. This
guards against a misclick, not against intent; see §5. Spark has no point-in-time recovery, so
deletion is unrecoverable (§10).

**Export / restore** — "Download JSON" serialises the whole collection. v3 left the format
undefined, which made it an artifact rather than a recovery plan. Specified:

```jsonc
{ "schemaVersion": 1,
  "exportedAt": "2026-08-16T18:04:11.482Z",   // ISO 8601 UTC
  "projectCount": 34,
  "projects": [
    { "id": "aBc123…",                         // the Firestore document ID, preserved
      "name": "…", "description": "…", "repoUrl": "…", "domain": "…",
      "host": "vercel", "frontend": "next", "database": "postgres",
      "status": "active", "notes": "…",
      "createdAt": "2026-05-02T10:11:12.000Z", // ISO 8601, not Firestore Timestamp objects
      "updatedAt": "2026-08-16T09:00:00.000Z" }
  ] }
```

`projectCount` must equal `projects.length`; the UI refuses to offer a download if it does not,
because a silently truncated backup is worse than none.

**Restore** is `npm run restore:projects -- <file.json>`, a small Node script authenticating as
an allowlisted account and writing each document back **by its original ID** via `setDoc`. It
refuses to run against a non-empty collection unless `--force` is passed. `createdAt` is
restored from the file, so restore is one of the two writes that legitimately needs
`createdAt != request.time` — handled by running the script against a temporarily relaxed rule
set, documented in §10 rather than weakening the production rules.

The restore path is exercised once against the emulator during rollout. An untested backup is
not a backup.

**States** — skeleton rows on first load, not a spinner. The empty state distinguishes "no
projects yet" from "no matches". Errors render an inline banner carrying the Firestore error code
plus a Retry, never a silent failure. Save buttons disable and show progress while writing.

The `PRODUCT.md` accessibility floor applies here too: visible focus rings, keyboard
reachability, real labels, contrast. Being private is not an excuse to drop it.

### Error handling

| Failure | Behavior |
|---|---|
| Not signed in | Sign-in card |
| Signed in, wrong account | Sign-in card + "that account does not have access" + Sign out |
| Firestore `permission-denied` | Banner: rules not configured for this UID, with the UID shown |
| Firestore unavailable | Banner + Retry; cached data stays on screen |
| Write fails | Form stays populated and dirty; nothing is lost |
| Unknown route under `/admindash` | Redirect to `/admindash` |

No `catch {}` that swallows. Every Firestore call surfaces its error code to the UI.

---

## 8. Local development

`npm run dev` for the admin entry points at the **Firestore emulator**, not production —
`firebase.ts` calls `connectFirestoreEmulator` when `import.meta.env.DEV`. Development must not
run destructive CRUD against the live database.

Auth stays against the real project in dev, so the real sign-in path is exercised.

---

## 9. Build, test, deploy

### 9.1 Changed and new files

**Changed:** `vite.config.ts`, `firebase.json`, `public/robots.txt` (`Disallow: /admindash`),
`package.json`, `src/index.css` (scoping only).

**New:** `admindash.html`, `src/theme.css`, `src/admin/**`, `firestore.rules`,
`firestore.indexes.json`, `vitest.config.ts`, `tests/rules/**`.

**Untouched:** `src/App.tsx`, `src/components/*`, `src/main.tsx`, `src/entry-server.tsx`,
`scripts/prerender.mjs`, `public/*.html`, `sitemap.xml`, and **all of `worker/`**.

### 9.2 Deploy order

Rules before UI, and nothing risky deploys unverified.

1. Enable the Firestore API; create the database (Native mode, `nam5`).
2. **Enable both sign-in providers** in Firebase Auth — **Google and Email/Password** — and add
   authorized domains (`creativoatwork.com`, `creativoatwork-54e65.web.app`, the preview-channel
   domain, `localhost`). v3 enabled only Google while §4 implements an email/password fallback;
   that fallback would have failed at the provider, not in the code.
3. Deploy `firestore.rules` with placeholder UIDs only — no real UID matches, so this is a
   deny-all deployment. Verify with the 403 curl in §9.4.
4. Run the rules test suite against the emulator (§9.3). It must pass before the UI exists.
5. Build. Confirm `prerender: injected N bytes` still prints and the marketing-bundle isolation
   checks in §9.4 pass. The CSS baseline for the subset check is captured from the current
   production build **before** any implementation begins.
6. **Deploy to a preview channel** (`firebase hosting:channel:deploy admindash-csp`). Verify the
   CSP against a real sign-in round trip with a clean browser console — both providers. Nothing
   reaches production until this passes.
7. Promote to live.
8. Sign in at `/admindash`, read the UID(s) off the card.
9. Fill the UIDs into `firestore.rules`, deploy rules, reload.
10. Exercise the restore script against the emulator once (§7), then post-deploy verification
    (§9.4).

**Rollback:** Hosting has one-click release rollback in the console, exercised once during
rollout so the runbook is known-good. Rules roll back by redeploying the placeholder version,
which fails closed. Nothing in this feature can break the contact form, because nothing in it
touches the Worker.

### 9.3 Rules tests

Vitest plus `@firebase/rules-unit-testing` against the Firestore emulator. **Requires a JDK
locally** — a genuine new dependency, noted because the emulator fails confusingly without it.

| Case | Expect |
|---|---|
| Unauthenticated read / write | deny |
| Authenticated non-allowlisted UID, every operation | deny |
| Admin read | allow |
| Admin create, valid document | allow |
| Create missing a required field | deny |
| Create with an extra field | deny |
| Create with a bad enum value, for each of the four enum fields | deny |
| Create with a wrong type per field (number/bool/map/array/null where a string is required) | deny |
| Create with `name` empty, and `name` at 201 chars | deny |
| Create at each length ceiling + 1: `description` 2001, `repoUrl` 301, `domain` 254, `notes` 10001 | deny |
| Create at each length ceiling exactly | allow |
| Create with `domain` empty or not hostname-shaped | deny |
| Create with `repoUrl` non-empty and not a GitHub URL | deny |
| Create with `repoUrl` empty | allow |
| Create with `createdAt` or `updatedAt` absent | deny |
| Create with `createdAt`/`updatedAt` a string rather than a timestamp | deny |
| Create with a client-chosen `createdAt` | deny |
| Update that changes `createdAt` | deny |
| Update with a stale `updatedAt` | deny |
| Update that drops a field | deny |
| Update that adds an unknown field | deny |
| Admin update, valid | allow |
| Admin delete | allow |
| Any write to a different collection | deny |

`npm run test:rules` is the entry point. It is **not** wired into `npm run build` — the build
gate stays exactly what it is today.

### 9.4 Verification

Nothing below is claimed as passing until it has actually been run.

- `npm run build` — type-check, both entries, prerender line present
- **Marketing bundle isolation by dependency graph, not filename glob:** parse `dist/index.html`
  for its entry and modulepreload chunks, walk their static imports, and assert no chunk in that
  closure contains `firebase`. Grepping `index-*.js` alone would miss preloaded sibling chunks
  and produce a false pass.
- **Marketing CSS isolation by selector set, not by hash.** v3 required the marketing CSS hash to
  stay at `index-GTZrnxSj.css`, which is the wrong gate: extracting `@theme` into `theme.css` and
  adding a second Vite entry can legitimately reorder or rename chunks without any admin code
  leaking. The correct assertion is a **subset check** — capture the marketing stylesheet's
  selector set before the change as a baseline, and require the post-change set to contain no
  selector absent from that baseline. A size increase beyond ~2% fails the check as a tripwire
  even if the selector diff looks clean. The same reasoning retires the "JS hash unchanged"
  claim; the dependency-graph assertion above is what actually proves JS isolation.
- Unauthenticated Firestore REST read → 403:
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' \
    'https://firestore.googleapis.com/v1/projects/creativoatwork-54e65/databases/(default)/documents/projects'
  ```
- `npm run test:rules` green
- **Contact form still works** — not because this touched it, but because it is the site's only
  conversion path and a Hosting deploy did occur: `OPTIONS /contact` → 204, and one real
  submission end to end.
- Browser: sign in; wrong-account rejection; CSP does not break the popup; create, edit, delete;
  filter; deep-link a filtered URL; reload a detail view directly; keyboard-only pass through the
  modal
- `/admindash` returns `X-Robots-Tag: noindex`

---

## 10. Operational exposure

**Quota headroom — arithmetic, not monitoring.** Firestore on Spark allows 50k reads, 20k writes,
20k deletes per day and 1GiB storage. The unbounded `orderBy` query costs one read per document
per load; at tens of documents and a single user that sits roughly three orders of magnitude
inside the daily ceiling.

Calling this "monitoring" would be a lie, and v3 did. **Spark has no budget alerts** — those
require billing to be enabled — so there is no threshold that can page anyone. What exists is a
manual check of the Firebase console Usage tab, recommended monthly and after any bulk import.
Quota exhaustion on Spark degrades to failed reads, which the §7 error banner surfaces rather
than hides. Revisit alongside the ~500-document threshold in §6.

**Auth on Spark:** unlimited for Google and email/password.

**Recovery posture — weak by construction, and accepted explicitly.** There is no PITR and no
managed backup without billing. What exists is the §7 JSON export with a defined format, a
`projectCount` completeness check, and a restore script exercised against the emulator during
rollout. What does not exist is any automation: nobody is reminded to export, and an export not
taken is not a backup.

The realistic worst case is total collection loss through an authorized or compromised admin UID,
recoverable only as far as the last manual export. **This is the riskiest remaining part of the
design.** Two ways to close it, neither in scope here: enable Blaze and turn on scheduled
Firestore exports to Cloud Storage, or run the export on a cron from a machine that is on
regularly. Recorded in `backlog.md`.

Restore requires writing `createdAt` values that predate `request.time`, which the production
rules correctly refuse. The documented procedure is to deploy a temporary rule set that relaxes
only the `createdAt == request.time` clause on create, run the restore, then immediately redeploy
the production rules and re-run the 403 check. Relaxing rules is a deliberate, logged, reversed
step — never a lingering state.

**Revocation runbook:** to remove access, delete the UID from `firestore.rules` and deploy — that
is the entire gate. Revoking a Google account's refresh tokens additionally requires the Firebase
console. Because `/inspect` is gone, there is no second allowlist to keep in sync.

---

## 11. Out of scope

Multiple users or roles; audit logging; project logos or file upload; pagination or virtual
scrolling; offline persistence; bulk import; automated uptime or dependency checks; **domain
auto-population** (dropped in v3, see revision history); any change to `worker/`; any link
between `projects` and the public Work grid. The Work grid stays a hand-curated array in
`Work.tsx` — coupling it to Firestore would put marketing content behind a database and undo the
prerender guarantee.

## 12. Open items

- Whether `simone@creativoatwork.com` is a Google identity — resolved at bootstrap; the
  email/password path in §4 covers the negative case.
- Both UIDs are placeholders until deploy step 6.
- CSP is verified in a browser before it ships (§3.2).

---

## 13. Codex review dispositions

Adversarial plan review of v1, 2026-08-16. Verdict: rejected as written. Dispositions per
CCOS §18. Findings marked **REMOVED** are obsolete because v3 deleted the `/inspect` endpoint.

| # | Finding | Sev | Disposition |
|---|---|---|---|
| 1 | Rules validate almost none of the schema | HIGH | **FIX (completed in v4)** — v3 validated types/enums/lengths but left `domain` acceptable as `""` and `repoUrl` unvalidated; §5 now shape-validates both |
| 2 | `hasOnly` misrepresented as update protection | HIGH | **FIX** — `hasAll` + `hasOnly`; `createdAt` compared to `resource.data` |
| 3 | SSRF controls incomplete | HIGH | **REMOVED** — no endpoint fetches anything |
| 4 | Token verification underspecified | HIGH | **REMOVED** |
| 5 | Cert cache by `kid` → rotation and DoS path | HIGH | **REMOVED** |
| 6 | Still usable as a scanner | MED | **REMOVED** |
| 7 | 64KB cap not operationally defined | MED | **REMOVED** |
| 8 | Auth persistence implicit | MED | **FIX** — explicit `browserLocalPersistence` (§4) |
| 9 | "Rules are the only gate" ignores IAM/Admin SDK | MED | **FIX** — constraint 4 rewritten; IAM review added |
| 10 | No defined route from client to `/inspect` | HIGH | **REMOVED** |
| 11 | CORS preflight will fail | HIGH | **REMOVED** — Worker CORS untouched |
| 12 | Bundle check is a false-negative test | HIGH | **FIX** — §9.4 walks the dependency graph |
| 13 | Shared CSS/JS leaks between apps | HIGH | **FIX (verification corrected in v4)** — §3.4 isolation was sound; the hash-equality gate was wrong and is replaced by a selector-subset check in §9.4 |
| 14 | Email/password fallback unimplemented | HIGH | **FIX (completed in v4)** — §4 implemented it, but the provider was never enabled; §9.2 step 2 now enables Email/Password |
| 15 | `updatedAt` absent vs `orderBy` | MED | **FIX** — mandatory and pinned in §5 |
| 16 | `/inspect` is not additive | HIGH | **REMOVED** — `worker/` is out of scope |
| 17 | Limiter failure policy must differ by route | HIGH | **REMOVED** |
| 18 | Pre-auth resource consumption | HIGH | **REMOVED** |
| 19 | Deploy order never syncs Worker and Rules UIDs | HIGH | **REMOVED** — one allowlist now |
| 20 | Use GA `[[ratelimits]]` | MED | **REMOVED** from scope. Verified accurate against Cloudflare docs and recorded in `backlog.md` as a standalone cleanup for `worker/wrangler.toml` |
| 21 | Verification happens after risky deploy | MED | **FIX** — §9.2 verifies rules before the UI exists; the risky Worker deploy no longer exists |
| 22 | No rules test plan | HIGH | **FIX** — §9.3 emulator-backed suite |
| 23 | Local dev points at production | HIGH | **FIX** — §8 emulator in dev |
| 24 | No recovery design on Spark | HIGH | **PARTIAL FIX, residual accepted** — v3 offered an undefined blob. §7 now defines the export format, IDs, timestamp encoding, completeness check, and a restore script exercised on the emulator. Recovery remains manual and unautomated; §10 states this as the riskiest remaining part |
| 25 | Auth provider provisioning missing | HIGH | **FIX (completed in v4)** — v3 enabled only Google; step 2 now enables both providers and the preview-channel domain |
| 26 | No Spark quota monitoring | MED | **WON'T-FIX, relabelled** — Spark cannot have budget alerts without billing. v3 called arithmetic "monitoring"; §10 now says so plainly and defines a manual check instead |
| 27 | Worker CPU budget unassessed | MED | **REMOVED** |
| 28 | No CSP / clickjacking policy | MED | **FIX (corrected in v4)** — v3's CSP would have blocked sign-in by omitting `https://apis.google.com` from `script-src`, and verified after deploying. §3.2 fixes the policy; §9.2 verifies on a preview channel before production |
| 29 | No revocation runbook | MED | **FIX** — §10 |

Survived review unchanged and retained in v3: the `request.auth.uid in [...]` membership test,
the ordering of the `/{document=**}` deny, `cleanUrls` serving `/admindash` from
`admindash.html`, the rewrite ordering, `prerender.mjs` being genuinely unaffected, and
`basename="/admindash"` being safe given `createRoot`.

### Second pass — re-review of v3

Codex confirmed all thirteen `/inspect` removals genuinely obsolete, with no risk surviving in
another form, and validated the Firestore rules semantics: `in` against a function-returned list
works; `hasAll`/`hasOnly` accept function-returned lists; `size()` counts characters, not bytes;
`serverTimestamp()` does resolve equal to `request.time`, so the create-time pin holds; comparing
`createdAt` to `resource.data.createdAt` correctly preserves it on update; and an absent-field
access errors into a deny rather than failing open — with `hasAll` rejecting that case first
anyway. Real Auth tokens against the Firestore emulator was also confirmed a supported
combination.

| # | Finding | Sev | Disposition |
|---|---|---|---|
| v3-1 | CSP blocks Firebase popup auth; verification sequenced after deploy | HIGH | **FIX** — §3.2 adds `https://apis.google.com`; §9.2 verifies on a preview channel first |
| v3-2 | `domain` required only in prose; `repoUrl` unvalidated; delete unrestricted | MED | **FIX** for the field validation (§5). Unrestricted delete for an allowlisted UID is **WON'T-FIX** and now stated as inherent, with the typed confirmation labelled a UX guard rather than an authorization control |
| v3-3 | Email/password designed but provider never enabled | MED | **FIX** — §9.2 step 2 |
| v3-4 | JSON export is an artifact, not a recovery design | MED | **FIX** — §7 defines format, IDs, encoding, completeness check, restore script, and emulator rehearsal. Residual manual cadence accepted in §10 |
| v3-5 | Hash equality is the wrong isolation gate | MED | **FIX** — §9.4 selector-subset check plus dependency-graph traversal |
| v3-6 | Rules test matrix under-tests its constraints | LOW | **FIX** — §9.3 expanded to wrong types, every length boundary, missing timestamps, and update field-set violations |
| v3-7 | "Quota monitoring" is arithmetic, not monitoring | LOW | **WON'T-FIX, relabelled** — Spark cannot have budget alerts; §10 says so and defines a manual check |

Codex's stated verdict on v3: *"reject as written until the CSP and Auth provider provisioning
are corrected. Once fixed, it is implementable if the team explicitly accepts the weak recovery
posture."* Both corrections are in v4, and §10 makes that acceptance explicit rather than
implicit.
