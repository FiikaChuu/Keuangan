# Preview lifecycle gates

The lifecycle UI is inspectable in Settings, including the local demo. Account signup, personal reset, account deletion, and wallet deletion are not activated by default. `NEXT_PUBLIC_ACCOUNT_LIFECYCLE_ENABLED` must be exactly `true` to activate the new operations; it has not been configured in this work. Disabled operations show **Belum diaktifkan pada preview**. Account DELETE and reset POST routes independently return 503 before reading backend configuration or calling Auth/database services when disabled.

Do not activate against production as part of a UI preview. Required separate gates: review SQL 04/05; apply only to an authorized staging database; verify real Auth signup/email flows and legacy tenant mapping; verify old-JWT pending/deletion fencing, password reauthentication, reset all-or-none cross-shared dependencies and retries, wallet deletion dependencies, session cleanup and deletion retry recovery. Local PGlite/mocked endpoint tests are not hosted Auth verification.

No hosted migration, credentials, environment files, or production data were read or changed during integration. Existing password-recovery behavior is retained; the new personal-data reset is a separate gated operation.

Integration QA: TypeScript passed, unit/local SQL tests passed (72/72), production build passed. Browser E2E and screenshot QA of this combined lifecycle integration remain pending. Satin background has not yet been integrated in this work. Do not describe this branch as fully visually verified or production-ready.
