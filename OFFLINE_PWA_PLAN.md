# Offline / PWA Feature — Full Plan

Branch: `feature/offline-pwa` (see `BRANCH_STRATEGY.md` for branching rules)

This document is the master plan. Each phase gets its own branch off
`feature/offline-pwa`, is tested independently, then merged back into
`feature/offline-pwa` before starting the next phase.

Copy the prompt under each phase into Claude Code when you're ready to
start that phase.

---

## Phase 1 — Installability

**Goal:** App can be installed to home screen. No offline data yet — still
requires internet to function, but is now a proper installable PWA with
static-asset caching.

**Branch:** `feature/offline-phase1`

### Prompt

```
Read BRANCH_STRATEGY.md at the root of this branch (feature/offline-pwa) first —
it documents how this branch relates to main and how phase branches should be
created and merged. Follow that strategy for this work.

We're starting Phase 1 of the offline/PWA effort now. Create a new branch called
feature/offline-phase1 off of feature/offline-pwa (confirm we're on
feature/offline-pwa before branching), and do the following work on it.

Also read SPEC.md and VENDOR_PAYMENT_SPEC_v2.md for context on the data model
(Sites, Tasks, Invoices, Bills, Vendor balances) and roles (Admin, Vendor, Accountant).

## Phase 1 — Make the app installable

1. Install Serwist (`serwist` + `@serwist/turbopack`) in /frontend — chosen over
   the originally-planned `@ducanh2912/next-pwa` because that package's Workbox
   tooling doesn't support Turbopack, which this project's build uses; Serwist
   is the actively-maintained, Turbopack-compatible successor in the same
   lineage
2. Configure next.config.ts to wrap with withSerwist from @serwist/turbopack,
   and add a service worker entry point at app/sw.ts
3. Create manifest.json using the existing SiteLedger icons already in
   /frontend/public/icons/ (icon-512x512.png, icon-192x192.png,
   apple-touch-icon-180x180.png, favicon-32x32.png) — reference design-tokens.ts
   for theme_color/background_color values (navy #1B3A5C, paper #F6F5F1)
4. Add the manifest link + meta tags to the root layout
5. Configure Serwist's runtime caching strategy for static assets (JS/CSS/fonts)
   as cache-first, and API GET requests as network-first with cache fallback
6. Add a custom "Install App" button using the beforeinstallprompt event —
   don't rely on the default browser install prompt

## Scope for this phase only

Do NOT implement Dexie, local data caching, or offline invoice creation in this
branch — that's Phase 2 and later, each getting its own branch off
feature/offline-pwa per BRANCH_STRATEGY.md. This phase is installability only.

## Before writing code

Show me the manifest.json content and the next.config.ts changes so I can review
before you implement the rest.

## When done

Confirm the build succeeds with npm run build (not just npm run dev), since
service worker behavior can differ between dev and production builds. Then stop
and let me test it on a real device before this gets merged back into
feature/offline-pwa.
```

### Manual test before merging to `feature/offline-pwa`
- [ ] Deployed to a preview URL (not just localhost)
- [ ] Install prompt/icon appears correctly on a real phone
- [x] `npm run build` succeeds cleanly (verified 2026-10-29)
- [ ] No console errors on fresh load
- [ ] Existing online flows (login, create invoice, approve, etc.) still work unchanged

---

## Phase 2 — Local Read Cache (Offline Viewing)

**Goal:** Vendor/Admin/Accountant can view their previously-loaded Sites,
Tasks, Invoices, and Bills while offline. Still read-only offline — no
creating/editing without connectivity yet.

**Branch:** `feature/offline-phase2`

### Prompt

```
Read BRANCH_STRATEGY.md and OFFLINE_PWA_PLAN.md at the root of this branch
(feature/offline-pwa) first. Phase 1 (installability) is already merged into
feature/offline-pwa. We're starting Phase 2 now.

Create a new branch called feature/offline-phase2 off of feature/offline-pwa
(confirm we're on feature/offline-pwa, pulled latest, before branching).

Also read SPEC.md and VENDOR_PAYMENT_SPEC_v2.md for data model context.

## Phase 2 — Local read cache

1. Install dexie and dexie-react-hooks in /frontend
2. Create a Dexie database (lib/db/offlineDb.ts) with tables mirroring what a
   user needs to see offline:
   - sites
   - tasks (including rate history)
   - invoices
   - bills
   Do NOT include vendor ledger/payment data — that's office-based accountant
   work, not needed offline for the on-site vendor use case.

3. Set an explicit Dexie schema version from the start (db.version(1).stores({...}))
   so future schema changes have a clean upgrade path — see the "Schema sync
   reminder" section in BRANCH_STRATEGY.md.

4. Hook into the existing RTK Query API slices (invoicesApi.ts, tasksApi.ts,
   sitesApi.ts) using a single shared mechanism (e.g. a syncMiddleware.ts) —
   not duplicated per-slice logic — so that every successful GET response
   writes/updates the matching rows into Dexie.

5. Update the key list/detail views (vendor's my-invoices, site invoices,
   admin's invoice list) to read from Dexie via useLiveQuery first, rendering
   instantly from local data, and refetch from the network in the background
   when online to keep Dexie current.

6. Add a simple online/offline indicator in the UI (navigator.onLine +
   online/offline browser events).

7. Handle the empty-cache case gracefully — first-ever app load with no
   connectivity should show a clear "connect to load your data" state, not
   a blank screen or error.

## Scope for this phase only

Read-only. Do NOT implement offline invoice creation, pending sync queues, or
write operations while offline — that's Phase 3.

## Before writing code

Show me the Dexie schema design (table structure, indexes, version number) and
the plan for wiring it into the RTK Query slices, so I can review before you
implement.

## When done

Confirm npm run build succeeds. Then stop for manual testing before merging
back into feature/offline-pwa.
```

### Manual test before merging to `feature/offline-pwa`
- [ ] Load app online, browse a few invoices/sites (populates cache)
- [ ] Turn on airplane mode, reload app — data still renders from cache
- [ ] Turn airplane mode off — app refetches and updates cache silently
- [ ] Clear browser storage, load with no connectivity — shows a sensible empty state, not a crash
- [ ] Existing online-only flows still work (create/approve/pay unaffected)

---

## Phase 3 — Offline Invoice Creation (Write Support)

**Goal:** A vendor with no signal on-site can create a new invoice. It saves
locally, shows immediately in their list as "pending sync," and
automatically syncs to the server the moment connectivity returns.

**Branch:** `feature/offline-phase3`

### Prompt

```
Read BRANCH_STRATEGY.md and OFFLINE_PWA_PLAN.md at the root of this branch
(feature/offline-pwa) first. Phases 1 and 2 are already merged into
feature/offline-pwa. We're starting Phase 3 now.

Create a new branch called feature/offline-phase3 off of feature/offline-pwa
(confirm we're on feature/offline-pwa, pulled latest, before branching).

Also read SPEC.md and VENDOR_PAYMENT_SPEC_v2.md for data model context,
specifically the Invoice creation flow (predefined task vs. custom task,
locked amount calculation).

## Phase 3 — Offline invoice creation

1. Add a pendingActions table to the existing Dexie database (bump the schema
   version deliberately, per BRANCH_STRATEGY.md's schema sync rules):
   { id, type: 'create_invoice' | 'create_custom_task', payload, createdAt,
     status: 'pending' | 'syncing' | 'synced' | 'failed' }

2. When a vendor submits a new invoice while offline:
   - Write it into Dexie's invoices table immediately (optimistic, so it
     shows in their list right away) with a local temporary ID and a
     "pending sync" visual indicator
   - Also queue the create action in pendingActions
   - If it's a custom task (not predefined), queue a create_custom_task
     action too, and make sure the invoice's queued payload references the
     task by a way that resolves correctly once the task syncs first
     (ordering matters — the custom task must sync before its invoice)

3. Listen for the browser's online event. When it fires:
   - Process pendingActions in order, oldest first
   - For each: call the real API endpoint, and on success replace the local
     temporary record with the real server response (real ID, real data)
   - On failure, mark that action as 'failed' and surface it in the UI
     rather than silently retrying forever — the vendor or an admin needs
     to know if something didn't sync

4. Add a small "pending sync" indicator/badge in the UI so vendors can see
   how many of their submissions haven't synced yet, and a manual "retry
   sync" action for failed items.

## Scope for this phase only

Only invoice creation (predefined + custom task). Do NOT implement offline
edit or offline delete-request in this phase — evaluate those as a follow-up
once creation sync is proven stable.

## Before writing code

Show me the pendingActions schema and the ordering/dependency logic for
custom-task-before-invoice sync, so I can review before you implement.

## When done

Confirm npm run build succeeds. Then stop for manual testing before merging
back into feature/offline-pwa.
```

### Manual test before merging to `feature/offline-pwa`
- [ ] Go offline, create an invoice against a predefined task — appears immediately, marked pending
- [ ] Go offline, create an invoice against a NEW custom task — both appear, marked pending
- [ ] Go back online — both sync automatically, pending badges clear
- [ ] Confirm the custom task actually exists server-side before its invoice does (check ordering)
- [ ] Simulate a sync failure (e.g. stop the backend mid-sync) — failed state shows, retry works
- [ ] Existing online invoice creation still works unaffected

---

## Phase 4 — Backend Delta Sync

**Goal:** Instead of relying only on individual page fetches to populate
Dexie, add a proper sync endpoint so the app can efficiently pull
everything that changed since the last time it synced.

**Branch:** `feature/offline-phase4`

### Prompt

```
Read BRANCH_STRATEGY.md and OFFLINE_PWA_PLAN.md at the root of this branch
(feature/offline-pwa) first. Phases 1-3 are already merged into
feature/offline-pwa. We're starting Phase 4 now.

Create a new branch called feature/offline-phase4 off of feature/offline-pwa
(confirm we're on feature/offline-pwa, pulled latest, before branching).

Also read SPEC.md and VENDOR_PAYMENT_SPEC_v2.md for data model context.

## Phase 4 — Backend delta sync endpoint

1. Add GET /sync/pull?since=<timestamp> to the NestJS backend, scoped by the
   authenticated user's role (a vendor only gets their own + site-wide
   invoices per their access rules in SPEC.md; admin/accountant get their
   full visibility scope).

2. Response should return records (Sites, Tasks, Invoices, Bills) with
   updatedAt greater than the given timestamp, plus a new server timestamp
   to use as the "since" value on the next call.

3. On the frontend, replace ad-hoc per-page fetching of Dexie-cache data with
   a periodic/on-reconnect call to this endpoint, storing the last sync
   timestamp (in Dexie or localStorage) and merging results into the
   existing Dexie tables.

4. Handle the case where a record was deleted server-side since last sync
   (e.g. a delete-request was approved) — the endpoint should communicate
   deletions somehow (e.g. a deletedIds array) so Dexie can remove stale
   local records rather than showing ghost data forever.

## Before writing code

Show me the endpoint's response shape and the frontend sync-trigger logic
(when it runs: on reconnect, on interval, on app open) so I can review
before you implement.

## When done

Confirm npm run build succeeds on both frontend and backend. Then stop for
manual testing before merging back into feature/offline-pwa.
```

### Manual test before merging to `feature/offline-pwa`
- [ ] Delete something server-side (e.g. a vendor's delete request gets approved), confirm it disappears from another device's cache after next sync
- [ ] Confirm sync doesn't re-fetch everything every time — only what changed
- [ ] Confirm sync runs automatically on reconnect, not just on manual refresh

---

## After Phase 4 — Merge to `main`

Once all four phases are merged into `feature/offline-pwa` and each has been
manually tested per its checklist above, do a final full regression pass
(all three roles, full invoice/bill/vendor-payment lifecycle, online and
offline) before opening the `feature/offline-pwa → main` PR.

Per `BRANCH_STRATEGY.md`: if this whole effort is taking longer than 3-4
weeks, reassess whether to ship Phase 1+2 (installable + offline viewing)
into `main` on their own first, rather than waiting for all four phases.