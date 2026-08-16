# `/admindash` — private multi-project aggregator

**Status:** design v3 — scope reduced, awaiting Codex re-review
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
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://securetoken.googleapis.com; frame-src https://creativoatwork-54e65.firebaseapp.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" }
]}
```

`frame-src` is required — `signInWithPopup` uses an auth iframe on the authorized domain. The
CSP ships only after the popup flow is confirmed working under it in a browser; a CSP that
breaks sign-in is worse than none.

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

**Verification:** the marketing CSS hash must not move. It is `index-GTZrnxSj.css` today; if it
changes, admin utilities leaked.

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
        && d.repoUrl     is string && d.repoUrl.size() <= 300
        && d.domain      is string && d.domain.size() <= 253
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

Because `updatedAt` is mandatory and pinned, the §6 `orderBy('updatedAt')` cannot silently hide
documents — a document lacking it cannot exist.

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

**Delete** — typed confirmation: the project's name must be entered. Never a bare button. Spark
has no point-in-time recovery, so deletion is unrecoverable (§10).

**Export** — a "Download JSON" action serialising the whole collection. On the free plan this is
the only backup mechanism available, and it is the honest answer to that gap.

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
2. **Enable the Google sign-in provider** in Firebase Auth and add authorized domains
   (`creativoatwork.com`, `creativoatwork-54e65.web.app`, `localhost`). Without this, sign-in
   simply fails.
3. Deploy `firestore.rules` with placeholder UIDs only — no real UID matches, so this is a
   deny-all deployment. Verify with the 403 curl in §9.4.
4. Run the rules test suite against the emulator (§9.3). It must pass before the UI exists.
5. Build and deploy Hosting. Confirm `prerender: injected N bytes` still prints and the marketing
   CSS and JS hashes are unchanged.
6. Sign in at `/admindash`, read the UID(s) off the card.
7. Fill the UIDs into `firestore.rules`, deploy rules, reload.
8. Post-deploy verification (§9.4).

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
| Create with a bad enum value | deny |
| Create with `name` empty or >200 chars | deny |
| Create with a client-chosen `createdAt` | deny |
| Update that changes `createdAt` | deny |
| Update with a stale `updatedAt` | deny |
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
- Marketing CSS hash unchanged (`index-GTZrnxSj.css`)
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

**Firestore on Spark:** 50k reads, 20k writes, 20k deletes per day; 1GiB storage. The unbounded
`orderBy` query costs one read per document per load — at tens of documents and a single user
that is roughly three orders of magnitude inside the daily quota. Revisit alongside the
~500-document threshold in §6.

**Auth on Spark:** unlimited for Google and email/password.

**No backup or PITR without billing.** The JSON export in §7 is the mitigation, and delete is
gated behind typed confirmation. Stated plainly: an accidental delete is permanent.

**Revocation runbook:** to remove access, delete the UID from `firestore.rules` and deploy —
that is the entire gate. Revoking a Google account's refresh tokens additionally requires the
Firebase console. Because `/inspect` is gone, there is no second allowlist to keep in sync.

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
| 1 | Rules validate almost none of the schema | HIGH | **FIX** — §5 validates every field, type, enum, length |
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
| 13 | Shared CSS/JS leaks between apps | HIGH | **FIX** — §3.4 separate entries, shared `@theme` only, CSS hash asserted |
| 14 | Email/password fallback unimplemented | HIGH | **FIX** — §4 implements it |
| 15 | `updatedAt` absent vs `orderBy` | MED | **FIX** — mandatory and pinned in §5 |
| 16 | `/inspect` is not additive | HIGH | **REMOVED** — `worker/` is out of scope |
| 17 | Limiter failure policy must differ by route | HIGH | **REMOVED** |
| 18 | Pre-auth resource consumption | HIGH | **REMOVED** |
| 19 | Deploy order never syncs Worker and Rules UIDs | HIGH | **REMOVED** — one allowlist now |
| 20 | Use GA `[[ratelimits]]` | MED | **REMOVED** from scope. Verified accurate against Cloudflare docs and recorded in `backlog.md` as a standalone cleanup for `worker/wrangler.toml` |
| 21 | Verification happens after risky deploy | MED | **FIX** — §9.2 verifies rules before the UI exists; the risky Worker deploy no longer exists |
| 22 | No rules test plan | HIGH | **FIX** — §9.3 emulator-backed suite |
| 23 | Local dev points at production | HIGH | **FIX** — §8 emulator in dev |
| 24 | No recovery design on Spark | HIGH | **FIX** — §7 typed-confirm delete + JSON export; §10 states deletion is permanent |
| 25 | Auth provider provisioning missing | HIGH | **FIX** — §9.2 step 2 |
| 26 | No Spark quota monitoring | MED | **FIX** — §10 quantified |
| 27 | Worker CPU budget unassessed | MED | **REMOVED** |
| 28 | No CSP / clickjacking policy | MED | **FIX** — §3.2, verified before shipping |
| 29 | No revocation runbook | MED | **FIX** — §10 |

Survived review unchanged and retained in v3: the `request.auth.uid in [...]` membership test,
the ordering of the `/{document=**}` deny, `cleanUrls` serving `/admindash` from
`admindash.html`, the rewrite ordering, `prerender.mjs` being genuinely unaffected, and
`basename="/admindash"` being safe given `createRoot`.
