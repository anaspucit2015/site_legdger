# Offline/PWA Branch Strategy

## Structure

- `feature/offline-pwa` is the long-lived integration branch for all offline/PWA work.
  It is **NOT** merged into `main` until the offline effort (or a shippable subset of
  it) is complete and tested.
- Each phase of the offline roadmap gets its own short-lived feature branch, branched
  **FROM** `feature/offline-pwa`, and merged back **INTO** `feature/offline-pwa`
  (never directly into `main`):
  - `feature/offline-phase1` (installability — manifest, service worker, PWA install prompt)
  - `feature/offline-phase2` (local read cache — Dexie, offline viewing)
  - `feature/offline-phase3` (offline invoice creation — pending sync queue)
  - `feature/offline-phase4` (backend delta sync endpoint)

## Keeping feature/offline-pwa in sync with main

Whenever `main` receives new work (features, fixes, schema changes) from anywhere
else in the project, `feature/offline-pwa` must be updated immediately — not just
once at the end. This is a hard rule, not optional:

```
git checkout feature/offline-pwa
git pull
git merge main
# resolve any conflicts immediately, while they're small
git push
```

Do this every time `main` changes. Small frequent syncs are much easier than one
large sync at the end of the whole effort.

## Merge direction rules

- Phase branches → merge into `feature/offline-pwa` (via PR, reviewed)
- `main` → merge INTO `feature/offline-pwa` regularly (keeps it fresh)
- `feature/offline-pwa` → `main` ONLY when the offline effort (or a complete, working
  subset of phases) is ready to ship
- Never merge a phase branch directly into `main`

## Merge strategy

Use merge commits (not rebase) when syncing `main` into `feature/offline-pwa`, since
rebase risks force-push conflicts if more than one person is working on the branch.
Rebase is not required for this workflow.

## Reassessment checkpoint

If `feature/offline-pwa` has been open for more than 3-4 weeks without merging into
`main`, stop and reassess: consider shipping whatever phases are complete and stable
(e.g. Phase 1+2) into `main` even if later phases aren't ready yet, rather than
letting the branch grow indefinitely.

## Schema sync reminder (Dexie vs Prisma)

Any Prisma schema change affecting `Invoice`, `Task`, `Site`, `Bill`, or `Vendor`
models must be checked against `frontend/lib/db/offlineDb.ts` and updated together.
Additive changes (new fields) are low-risk and self-heal on next sync. Breaking
changes (renamed/removed fields, changed indexes) require an explicit Dexie
`.version()` bump with a migration — see Dexie docs. Do not skip this when merging
`main` into `feature/offline-pwa` if the incoming changes touch these models.
