# Scanner verification — local patch, not live-provider proof

## Findings

The client previously replaced every HTTP error with “Nota belum dapat dibaca”, even when the server correctly returned a provider authentication, quota, timeout or model-availability code. Uncoded session/access failures lost their HTTP status, and a proxy HTML error raised a JSON parser error instead of an actionable scanner message. The client now uses only static messages and allowlisted codes/reasons, with an HTTP-status fallback. Raw server error strings/bodies are never displayed.

The exact production scan failure remains unknown. The server already distinguishes blocked, empty, unfinished, invalid JSON, zero/unreadable amount and invalid-schema output. Its SDK request uses MIME sniffing, inline uncompressed file bytes, structured JSON, 1600 output tokens, zero thinking budget and one SDK attempt within a 25-second timeout. It rejects non-STOP completions rather than treating partial JSON as a transaction. No model, prompt, financial validation, paid/nonfinal rule, database, or credentials were changed.

## Model documentation checked

- https://aistudio.google.com/docs/models/gemini-2.5-flash
- https://ai.google.dev/gemini-api/docs/deprecations

The current official model page says 2.5 Flash API access is limited to existing users until December 1, 2026, then requests automatically route to 3.5 Flash-Lite. It warns of breaking changes including thinking configuration and sampling parameters. This is a deployment risk, NOT evidence that this project's key/model access caused the reported failure. Do not randomly replace the model string while retaining incompatible settings; verify the actual response class first, then independently test a migration.

## Safe live check for the coordinating operator

1. Open the actual deployed SkyWallet URL, sign in normally, choose the scanner upload path, and upload one user-approved readable paid receipt. Obtain permission before any private receipt is sent to an external provider; prefer a clearly synthetic paid receipt for initial diagnosis.
2. In browser DevTools Network, select the POST `/api/scan-receipt`. Record only its HTTP status and response `code` / `diagnostic.reason` (if present). In the patched UI the same safe code/reason appears in brackets. Do not copy Authorization headers, cookies, image/request payloads, response success financial details, HARs, or raw provider errors.
3. Ask the user only for: status (e.g. 422), code (e.g. SCAN_UNREADABLE), reason (e.g. AMOUNT_UNREADABLE), and approximate attempt time. If there is no code, status alone is sufficient initially.
4. Interpret: 401 means sign-in/session; 403 means access reservation; 429 means rate/quota; SCAN_MODEL_UNAVAILABLE means provider 404/model access; SCAN_UPSTREAM_AUTH means provider credentials/access; SCAN_TIMEOUT/SCAN_NETWORK means provider connection; SCAN_UNREADABLE requires its reason to distinguish extraction from truncation/schema rejection. HTTP 503 with no code can be missing deployment configuration; inspect presence only, never reveal values.
5. Successful inference must open a review draft, not save a ledger record automatically. Confirm the displayed total/status and explicitly approve saving only if authorized. Re-upload must not debit twice. Native OS share-sheet availability requires a separate installed-PWA check.

## Deterministic checks

`npm test` runs synthetic client and real-SDK HTTP mock tests, plus existing domain/database contracts. These never prove live credentials, quota, model availability or OCR quality. `npm run typecheck` and `npm run build` check compilation. No deployment is included in this patch. Browser visual/retry/draft flow and authenticated live inference remain unverified.
