# Lifecycle handoff — NOT production evidence

Local implementation only, integrated with update-awareness on the non-production release branch. No hosted DB/Auth writes, credential reads or deployments were performed during release integration. PGlite uses a synthetic Auth schema; API tests use mocked Auth clients. These do not prove hosted Auth deletion/revocation or multiple Postgres connections.

## Migration paths (administrator)

- Inspect applied objects first; these numbered SQL files are SQL-editor scripts, not Supabase CLI timestamped migration history. Never blindly replay 01/04/05.
- Fresh schema: 01 → optional site allowlist 02 → 03 → revised 04 → revised 05 → 06 → 07. Keep site-specific allowlist values private and preserve existing household UUIDs.
- Original 04/05 already installed: apply 06 and 07 only. 07 replaces the two functions and adds the closed signup control without modifying existing account mappings, completed receipts or financial rows. 06 is one-time (not replayable).
- 04/07 default `private.lifecycle_controls.signup_enabled=false`. Missing control row also denies new non-allowlisted users. Active legacy allowlisted inserts remain allowed. Tombstoned/inactive emails remain denied even when signup is opened.
- Do not open public signup as a side effect of enabling reset/delete. Only an explicit DBA action may change signup_enabled. Service-role and browser roles cannot write it.
- 06 requires auth.users, private schema, service_role/anon/authenticated roles. Only service_role can execute acquire/release; no direct table grants. Existing API clients without 06 fail closed before password verification.

## Minimum parent/admin requirements for disposable live tests

1. Confirm isolated staging project/ref and disposable-user-only destructive scope, backup/restore point, and current migration inventory. No real-user reset/delete.
2. Administrator capable of applying reviewed SQL and inspecting grants/RLS; a server-side service-role key delivered through the approved secret mechanism (never chat/logs/client build), staging URL and publishable key.
3. Two confirmed disposable email/password identities, one disposable household pair, and a disposable MFA identity if MFA testing is available. Administrator can confirm email/create users while keeping public signup closed. Secret entry via approved vault only.
4. Staging deployment with route/UI lifecycle flag explicitly enabled only there; production remains disabled until separately released. Reachable HTTPS preview and logs with password/token/body redaction. No third-party limiter service or purchase required.

## Exact acceptance checklist before release

- [ ] Verify closed gate rejects a brand-new email at Auth signup; active legacy mapping still logs in with unchanged household; inactive mapping stays denied. Verify anonymous/authenticated/service-role cannot update the control.
- [ ] Check execute grants: anon/authenticated denied acquire/release/authorize/prepare; only service role allowed. Check private tables RLS and no browser table grants. Run staging security advisors.
- [ ] Real password mismatch, invalid JWT, victim userId extra field, MFA account: no reset/delete occurs. Inspect Auth traffic: limiter denial/error/missing RPC happens before signInWithPassword.
- [ ] Across TWO server instances/connections: same verified identity simultaneously admits one password call, fifth attempt exhausts shared reset+delete 15-minute budget, sixth returns 429; another user unaffected. DB outage/revoked service grant returns 503 without password call. Wait real window/lease expiration; verify recovery. API uses no forwarded IP as identity.
- [ ] Stream >8192 bytes without Content-Length and stalled body: bounded rejection before Auth (3-second body deadline). Auth/REST network calls have 10-second abort deadlines; DB lease lasts 2 minutes if release fails. Platform request timeout must exceed the normal route sequence; verify cold-start timings and aborted-request behavior.
- [ ] Reset personal wallets/transactions/goals/plan only; identity/password and shared ledger unchanged. Linked shared/private-other-user transfer rejects atomically. Stale revision rejects atomically. Existing pre-reset JWT cannot bootstrap/write after reset.
- [ ] Capture an incomplete reset request, let ticket expire >5 minutes, reauthenticate using SAME request ID: new ticket executes once; old ticket fails. Completed receipt after >5 minutes must retain exact ticket/time/revision; retry returns replayed and does NOT delete newly created personal data.
- [ ] Race reset renewal/execution/mutations on separate DB connections: finance advisory lock serializes; no partial delete, stale capability, or repeated completed reset. PGlite cannot prove multi-connection scheduling.
- [ ] Delete empty disposable identity: prepare pending → global revoke → hard Auth delete; old JWT denied in DB. Reset receipts and limiter FK rows must not block Auth delete. Financial dependencies intentionally block account deletion rather than cascading.
- [ ] Induce revoke/delete failure on disposable account: pending remains; retry with password reachable from finance-load failure UI. Never infer success from token expiry or clear pending automatically.
- [ ] Verify reset requires new sign-in and same original request ID survives uncertain transport outcome; UI gate still blocks production. Confirm success bodies, no-store headers and no secret/financial payload logging.

Local commands: `npm test`, `npm run typecheck`. Build only with dummy/no credential environment; do not copy production .env into this worktree. A successful build is not staging acceptance.
