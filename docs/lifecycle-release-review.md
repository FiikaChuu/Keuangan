# Local lifecycle release review

## Local integration

- Settings has separate `PersonalReset` and `AccountDeletion` dialogs (`src/AccountDeletion.tsx`), password reauthentication, exact confirmation, no request on cancel, and no secret persistence. Existing Orb appearance/navigation is unchanged.
- `src/lifecycle-client.ts` requires explicit server completion flags, not just HTTP 200. Delete endpoint returns `deleted: true` only after Auth admin delete succeeds. Reset endpoint additionally checks the RPC's `reset: true` result.
- `src/use-finance.ts` pauses refresh/realtime scheduling and rejects mutations during a lifecycle request. It refuses to start while a write/read is in flight. Ambiguous responses retain the same reset request UUID/revision and keep mutations fenced until retry resolves. No automatic retry or synthetic success. Keep the dialog open on ambiguous outcomes; a browser reload loses its in-memory request identity, so resolve uncertain requests before reloading.
- Confirmed success disconnects Realtime/listeners/polling, drops pending mutation ID/revision and the loaded store, aborts scanning, and replaces the workspace with a sign-out screen. A failed local sign-out can be retried without resubmitting a destructive action.
- Pending account deletion remains fail-closed if global revoke or Auth delete fails. The finance-load error screen exposes the same password-verified deletion retry. A new login can still authenticate with Auth (the tombstone gates finance, not password Auth); it lands on that retry screen. Never automatically clear pending. If Auth deletion succeeded but its response was lost, the old token may no longer authenticate: do not claim success; administrator verifies Auth state and resolves the tombstone. Storage-owned objects or other Auth dependencies require administrator handling.

## Security findings and changes

- SQL04: identity is server verified; no target ID accepted from the client; provisioning ignores user metadata. Pending is checked through RLS helpers and privileged finance wrappers under finance lock `740261519`. Prepare is service-role-only; dependency checks run before marking pending. No shared-ledger cascade was introduced.
- SQL05: reset checks caller identity, service-issued identity-bound ticket, original revision, and stale JWT epoch under the same lock. Cross-boundary personal/shared transaction edges reject the whole transaction. Ledger reversal bypass uses a private, inaccessible marker, not a client flag. The reproduced net-delta trigger matches the original behavior outside reset; tests exercise reset with spent income and shared rejection.
- Fixed SQL05's reset-request Auth foreign key to `ON DELETE CASCADE`: completed reset receipts otherwise prevented later legitimate deletion of the now-empty Auth account. These are private idempotency receipts, not ledger history; they remain for the lifetime of the Auth identity and are only removed with that identity.
- Reset epoch deliberately fences writes/bootstrap, not all reads. Auth refresh sessions are retained; reset is not account deletion or global logout. MFA is unsupported and rejected. Ingress rate limiting remains a release prerequisite.

## Verification and release checklist

Local evidence: `npm test` (72 passing tests), `npm run typecheck`, isolated credential-free Next production build. PGlite runs real SQL against synthetic accounts; HTTP tests use Auth mocks. No real user deletion/reset, hosted SQL, credential read, commit, push, or deployment was performed. No authenticated browser lifecycle test has been claimed.

Before activation:

1. Review/backup the target database and confirm existing migration state. Apply 04 then 05 after existing 01/03; never replay 01 against an established database. Use a disposable staging project first and obtain explicit approval for its test data operations.
2. Audit grants/RLS and run Supabase security advisors; keep `private` out of exposed Data API schemas. Verify public privileged functions are service-only or authenticated as intended and refresh PostgREST schema cache.
3. Configure server-only service role key and URL through approved secrets management. Verify missing configuration returns 503; do not expose service credentials in browser builds.
4. Configure email confirmation, signup policy/password minimum, redirect URLs, SMTP, Auth abuse protection, and endpoint/password-attempt ingress limits. No Auth configuration was activated here.
5. Verify staging Auth password identity matching, MFA rejection, session revoke/delete failure retry, storage ownership failure, lost-success response handling, pending-login retry UI, and local sign-out failure UX. Use isolated, disposable accounts only after approval.
6. Verify actual PostgreSQL concurrent sessions (reset vs commit/bootstrap, reset vs reset), stale JWT fencing, exact-revision rejection, cross-user/shared atomic rejection, and replay without wiping post-reset data. PGlite serial tests do not prove concurrent scheduler behavior.
7. Add authenticated browser tests for cancel/no request, double-submit prevention, ambiguous same-ID retry, shared rejection without logout, success cleanup and sign-in-after-next-second. Current client protocol tests are not end-to-end browser evidence.

Production release remains blocked on the staging/Auth/concurrency/browser gates above. No production activation is implied by local tests/build.
