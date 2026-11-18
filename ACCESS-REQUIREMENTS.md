# Release access requirements — gates closed

This branch combines lifecycle hardening with update-awareness already in `origin/main` at `3de16d805729ee0b352fbc099447a0a97931ea15`. It is not a production activation or proof of hosted reset/delete or receipt inference. Do not deploy production from this handoff.

## Environment names (never send values in chat)

| Name | Purpose / boundary |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL used by browser and API routes. Use isolated staging for acceptance. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public browser key; also used by receipt route to verify caller access. |
| `SUPABASE_SERVICE_ROLE_KEY` | Lifecycle route administrative secret. Configure only through secure server-side Vercel environment settings; never a public variable, browser bundle, repository, chat or log. |
| `GEMINI_API_KEY` | Server-only receipt inference credential. Configure through secure Vercel environment settings, never in client code/chat/logs. |
| `NEXT_PUBLIC_ACCOUNT_LIFECYCLE_ENABLED` | Keep unset or `false` for production and this release. Only separately authorized isolated staging acceptance may use `true`. Both lifecycle routes reject while closed. |
| `VERCEL_GIT_COMMIT_SHA` | Provider-supplied build revision; validated by build configuration. `NEXT_PUBLIC_BUILD_ID` is generated from it (or local Git SHA), not a secret or activation gate. |
| `SKYWALLET_DEMO` | Local synthetic QA only; never enable as production verification. |

No additional scanner model-name environment variable is read by the receipt route.

## Access still required

- An isolated Supabase staging reference, migration/object inventory, backup/restore plan and administrator permission to apply reviewed SQL and inspect RLS/grants. Known project branch discovery returned no staging branch; project enumeration returned 403. Do not infer migration state from this.
- Vercel project/team access to configure server-only staging secrets and inspect a staging deployment. Project enumeration for the known team scope returned 403. No authorization endpoint was available through the connected tools.
- Administrator-created disposable test identities (including a household pair) and approved secure vault entry for reauthentication. Keep public signup closed independently of the UI flag.
- Complete all live acceptance items in `LIFECYCLE-STAGING.md`, including real Auth revocation/deletion, stale JWTs, concurrency over separate database connections, retry ambiguity and real scanner inference. No owner's ledger or production Auth writes.

## Local verification (synthetic, not live acceptance)

- `npm test`: 97 passed, 0 failed; includes PGlite migrations/RLS, lifecycle limiter and reset/delete mock-Auth flows, scanner and update-awareness unit tests.
- `npm run typecheck`: passed.
- Local preview requests to `DELETE /api/account` and `POST /api/account/reset`: both returned HTTP 503 with `PREVIEW_DISABLED` while the lifecycle gate was false.
- Credential-free optimized build with dummy public URL/key, lifecycle flag `false`, synthetic demo data: passed. Existing Tailwind content warning remains.
- `scripts/update-awareness-qa.mjs`: passed at 375/440/1440px: same-build/offline silence, mismatch notice, no automatic reload, dirty-form cancel, explicit refresh, unchanged local ledger.
- Chromium app/PWA/routing tests: 40 passed across desktop and iPhone-size. Wallet-delete browser tests failed in both sizes because the existing exact `Hapus dompet Berisi` control was not found.
- Broader Chromium runs also exposed existing satin-background expectation and exact `Catat transaksi baru` selector failures in lifecycle-preview/orb/refinement fixtures. Those UI/test files are unchanged from the main baseline; integration does not claim full E2E green. No unrelated UI rewrite was made.
- Default browser suite was blocked by absent `/usr/bin/chromium` and WebKit runtime. Retried Chromium using the existing executable through `CHROMIUM_PATH`, without changing Playwright configuration. WebKit remains unverified.

No hosted schema/Auth changes, credential reads, production push, or production deployment were performed. Secrets, dependency symlink, build output and QA artifacts must remain untracked.
