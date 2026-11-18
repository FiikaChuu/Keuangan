# Local receipt scanner audit (2026-11-18)

## Evidence and limits

No `.env`, credentials, live auth/database/model requests, private receipt images, production configuration, commit or deployment were accessed/performed. Tests use synthetic PNG signatures and fetch interception at the actual Supabase/Google SDK HTTP boundary. These are contract tests, **not OCR quality tests**; passing them does not prove a live nota is readable.

The live failure's root cause is **not established** without the sanitized failed response. Source inspection confirms that all of these formerly collapsed into `SCAN_UNREADABLE`: blocked/empty response, non-STOP completion, invalid JSON, zero total and invalid schema. The route now retains that public code/status (422) but includes a static `diagnostic.reason` to distinguish them. No raw exception, model text, receipt field, block message, token or image is returned/logged.

## Model lifecycle finding requiring owner attention

The route still explicitly uses `gemini-2.5-flash`, temperature 0, JSON response schema, 1,600 output tokens and `thinkingBudget: 0`; the SDK HTTP timeout is 25,000 milliseconds with one attempt. No speculative prompt, model or configuration change was made.

Google's model page states Gemini 2.5 Flash is deprecated, access is limited to existing API users until 2026-12-01, and requests will automatically route to 3.5 Flash-Lite effective that date. It also warns of migration changes, including `thinking_level` replacing `thinking_budget` and removed sampling parameters. Thus changing only the model string is not a verified repair. Owner must validate model access and migration against current docs before adopting a replacement. A mocked upstream 404 now returns 503 / `SCAN_MODEL_UNAVAILABLE`, with `diagnostic: { reason: 'MODEL_UNAVAILABLE', upstreamStatus: 404 }`. A 404 alone establishes unavailable endpoint/access, not definitively deprecation.

Sources inspected:

- https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash
- https://ai.google.dev/gemini-api/docs/deprecations (rendered extraction truncated its deprecated-model table; model-specific page supplied the lifecycle evidence)
- https://googleapis.github.io/js-genai/release_docs/interfaces/types.HttpOptions.html (`timeout` is milliseconds; retry options are supported)

## Collecting safe evidence from the next authorized scan

Use browser developer tools → Network → `/api/scan-receipt` → Response. Share only the HTTP status, `code` and `diagnostic` object. **Do not export a HAR, copy request headers/body, screenshot receipt content or share tokens.** This audit did not initiate such a scan.

`src/share.ts` currently discards `code` and `diagnostic` at its error boundary, displaying only `json.error`. UI owner may append a strictly allowlisted code/reason if desired; the API works without a UI change. Example restricted display logic:

```ts
const codes = new Set([
  'SCAN_UNREADABLE',
  'SCAN_MODEL_UNAVAILABLE',
  'SCAN_UPSTREAM_AUTH',
  'SCAN_UPSTREAM_QUOTA',
  'SCAN_TIMEOUT',
  'SCAN_NETWORK',
  'SCAN_UPSTREAM',
]);
const reasons = new Set([
  'MODEL_UNAVAILABLE',
  'BLOCKED',
  'EMPTY_RESPONSE',
  'INCOMPLETE_OUTPUT',
  'INVALID_JSON',
  'AMOUNT_UNREADABLE',
  'INVALID_SCHEMA',
]);
const code = codes.has(json.code) ? json.code : '';
const reason = reasons.has(json.diagnostic?.reason) ? json.diagnostic.reason : '';
if (!response.ok)
  throw new Error(
    `${json.error || 'Nota belum dapat dibaca.'}${code ? ` [${code}${reason ? `/${reason}` : ''}]` : ''}`,
  );
```

Interpretation:

- `BLOCKED`: provider blocked response; not necessarily poor image quality.
- `EMPTY_RESPONSE`: no candidate/text returned.
- `INCOMPLETE_OUTPUT`: finish reason was not STOP; valid-looking partial JSON is still rejected.
- `INVALID_JSON`: completed output did not parse.
- `AMOUNT_UNREADABLE`: model explicitly returned zero (also required for unpaid/ambiguous evidence).
- `INVALID_SCHEMA`: completed JSON violated existing strict financial contract.
- Auth/quota/network/timeout errors retain their existing separate public codes.

Existing payment/ownership/admin-fee prompt rules and strict result schema remain unchanged. Non-transfer bank fields must still be null, and zero/invalid financial results never become records.

## Reproduction

```sh
npx tsx --test tests/scan-diagnostics.test.ts tests/api.test.ts
npm test
npm run typecheck
```

New regression initially failed because upstream 404 returned generic 502. After the bounded diagnostics change the scanner-specific tests passed (10 tests), with successful TypeScript checking. Final full-suite run passed: 66 tests, 0 failures; `npm run typecheck` also passed.
