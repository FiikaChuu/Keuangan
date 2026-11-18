# Update awareness handoff (not deployed)

Worktree: `Keuangan-update-final`, branch `fix/update-final`, base `93cb38f`.

- Public build ID is a validated Git commit SHA (Vercel commit SHA when present, otherwise local HEAD). It is embedded identically into the UI and `/api/version`; no timestamp, credentials, or financial data.
- Version endpoint is dynamic with browser/CDN no-store headers; the existing worker excludes all `/api/` requests.
- Checks at mount, focus, visible visibilitychange, every five minutes, and controllerchange only after an existing controller. A worker event alone never announces an update. No automatic reload.
- Reload always asks explicit confirmation about loss of unsaved changes, including non-modal planning/login forms. Cancel leaves state intact. No financial storage/session clearing is added.
- Footer displays the running build. Existing 3D RefreshCw asset reused. Backend/lifecycle flags unchanged.
- Commit SHA identity assumes deploys build committed code. Uncommitted local edits share HEAD identity; commit before a real deployment.

## Verified

- RED: `npx tsx --test tests/update-awareness.test.ts` failed before implementation (module missing).
- GREEN: `npm test` — 85 tests passed; `npm run typecheck` passed; `npm run build` passed.
- `QA_BASE_URL=http://localhost:5184 node scripts/settings-visual-qa.mjs update` passed at 375/440/1440px.
- `node scripts/update-awareness-qa.mjs` passed at 375/440/1440px: same build and offline silent; mismatch notice; no automatic navigation; dirty planning value survives cancel; explicit reload; ledger unchanged.
- Build for synthetic remote fixture: `NEXT_PUBLIC_SUPABASE_URL=https://settings-fixture.invalid NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=synthetic-fixture-only npm run build`.
- `SKYWALLET_DEMO=false npm run start -- --port 5185`, then `QA_REMOTE_FIXTURE=true QA_BASE_URL=http://localhost:5185 node scripts/settings-visual-qa.mjs remote-update` passed. All fixture auth/read RPCs intercepted; no live services or credentials.
- Layout asserts actual text span (not MeshIcon), width >=65% row for all five rows: backup, restore, reset, delete, logout fixture. Icons <=19px; no horizontal overflow; disabled dialogs/invalid restore guards/backup download/persistence verified.
- 375px backup row: 335px row / 276px text / 19+16px icons. 440px: 400 / 341 / 19+16. Desktop: 584 / 525.1875 / 19+16.

## Evidence

`artifacts/settings-update/results.json`, `artifacts/settings-remote-update/results.json`, `artifacts/update-awareness/results.json`.
Each settings directory contains 375/440/1440 top/full/account/reset/delete screenshots. Update directory contains notice screenshots at all three widths.

## Limits

No deployment or push performed. No real auth/session, production update rollout, WebKit, or real service-worker upgrade lifecycle was exercised; controllerchange handling is code-guarded and all notices still require remote build mismatch. Existing build emits a Tailwind content warning. Full-page screenshots include the existing fixed mobile nav at its viewport position; no navigation restyle attempted.
