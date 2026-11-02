# SkyWallet

A calm, local-first personal finance app for the web and iPhone. Built with React, TypeScript, and Vite, with Indonesian copy, rupiah amounts, and a responsive layout. Start with irregular personal income and keep shared funds in a separate space.

## Run

Use **Node.js 24 LTS** and npm. From this checkout:

```sh
npm ci --cache /tmp/skysave-npm-cache
npm run dev -- --port 5173
```

The postinstall script copies OCR language data, WASM, and PDF workers from the integrity-checked npm dependencies into ignored public asset directories. No API key, database service, or bank credentials are needed. Noto Sans WOFF2 files and their license are tracked in `src/assets/fonts/` and loaded through `src/fonts.css`. Document-processing assets are served locally. The font does not require an npm package or an external font service.

```sh
npm test                 # 27 financial, analytics, calendar, currency and document-parsing tests
npm run build            # strict TypeScript check + production build
npm run preview -- --port 4173
npm run test:e2e         # desktop + iPhone-size Chromium + iPhone WebKit; run build first
```

Browser tests use `/usr/bin/chromium` plus Playwright WebKit. Set `CHROMIUM_PATH` if Chromium is installed elsewhere. Install WebKit and its system dependencies with `npx playwright install --with-deps webkit` on a machine where package installation is permitted; `WEBKIT_EXECUTABLE_PATH` can select an existing WebKit launcher. Run only the Chromium projects with `npm run test:e2e -- --project=desktop --project=iphone-size` when WebKit is unavailable. The full suite contains 14 scenarios across all three projects. It exercises real OCR, persistence, financial flows, proof-preserving backup/restore, offline startup, report filters, insight preferences, and 375/393/430 px plus landscape layouts against the production build. WebKit emulation is not physical iPhone/Safari certification.

## What works

- A clearly labeled demo with an explicit **Mulai dengan data saya** reset flow.
- Separate bank/e-wallet wallets, opening balances, optional last four digits, personal/shared classification, and derived balances.
- Manual income with its source, categorized expenses, dated history, notes, transfer fees, and transfers between owned or shared accounts.
- Cash withdrawals count as expenses; there is no cash wallet. Internal transfers are excluded from income/expense totals, while their fees count as expenses.
- Receipt uploads: PNG, JPG, WEBP, or PDF (10 MB, up to 5 pages). Tesseract reads image text locally. PDF.js extracts text or renders scanned pages for OCR. Detection suggests amount, date, category, reference, and source bank when explicit and unambiguous. Confirmation remains required; the app never treats a bank logo alone as proof of the sending account.
- Quick edit and confirmed deletion from transaction cards. Editing recalculates both sides of a transfer, keeps existing proof, and rejects changes that would create a negative balance or duplicate another record.
- Original proof stored in IndexedDB and accessible from transaction details. SHA-256 proof fingerprint and account/reference checks prevent duplicates.
- Search by title, category, account, reference, or income source; combine transaction kind, category, account, month, and min/max amount filters; sort and export the filtered result as CSV.
- Flexible allocation from **existing personal balance minus unpaid obligations**, excluding shared wallets. Adjustable percentages always sum to 100%. A shortfall is surfaced before allocating optional spending. This is a transparent rules-based assistant, not a prediction of irregular future income or a bank-product recommendation engine.
- Goals tied to dedicated wallets, one goal per wallet, with progress from recorded balances. Recording a proposed transfer still requires explicit confirmation.
- Shared-account balances, goals, and transfer history. This release is a single-device record, not shared login or collaborative editing.
- JSON backup and confirmed restore of accounts, transactions, goals, planning, and available original proofs. Backups contain sensitive financial information and should be kept private.
- iPhone-first layout adapted from the supplied design exports: reference-based Noto Sans typography, navy, warm neutral grouped surfaces, rounded cards, four destinations and a central capture action, category/account bottom sheets, and light/dark/system appearance. Dashboard period controls update three charts and a five-category breakdown. Sky Insights shows only the personal-fund plan, largest spending category, and shared-account balance. Preferences for these three cards persist across reloads. See [the mobile design notes](docs/mobile-design.md).
- Complete mobile-first UI based on all pages of the supplied [Framer site](https://miracle-startup-935285.framer.app): one shared bottom navigation, fixed capture action, consistent cards and sheets, safe areas, compact amounts, and dark mode. History and reports share the Transactions destination. Deep links, reload and browser back preserve navigation. See the [17-screen iPhone gallery](docs/ui-preview.html).
- Full-page reports with weekly/monthly/yearly periods, a validated end date, transaction-kind filters, six actual summary values, CSV export, and browser printing / Save as PDF. The print layout includes filtered transaction details and income sources.
- Installable PWA manifest and production service worker. The application shell is precached. OCR/PDF supporting public assets are cached on use; first-time OCR requires the app server to be reachable.

## Data and financial boundaries

**There is no bank connection, automatic bank synchronization, or money movement.** All balances are calculated from opening balances and confirmed records. Compare with actual bank balances periodically and record omitted charges, interest, or income.

Metadata is stored in localStorage; proofs are stored in IndexedDB. Data is scoped to the browser and origin, is not encrypted by the application, and does not automatically appear on another device. Clearing browser/site storage can erase it. Download a backup before changing devices, resetting, or clearing browser data. No analytics or external document-upload service is included.

Receipt extraction can be inaccurate, especially on low-quality screenshots and unfamiliar bank layouts. Ambiguous sources remain unselected. Check transaction type (expense, income, or internal transfer), amount, account, and fees before saving. Two different screenshots of the same payment may not share a file hash; reference detection and human review remain important.

Transactions cannot overdraw a recorded account. Deletion is blocked when it would make a remaining account balance negative. A plan does not reserve funds, alter bank balances, or guarantee savings. Re-evaluate it after transactions; it is a snapshot allocation, not a list of repeated transfer instructions.

## Publish and use on iPhone

Build with `npm run build` and serve the complete `dist/` directory at the **root of an HTTPS origin**, including the `ocr/`, `pdf/`, icons, manifest, and `sw.js` assets. Configure `index.html` as the SPA fallback. Serve `sw.js` and `index.html` with revalidation rather than long immutable caching; hashed `/assets/` files can use immutable caching. No deployment has been performed by this repository setup.

On iPhone Safari: open the published HTTPS address, then **Share → Add to Home Screen**. Test image/PDF uploads and storage on the intended physical iPhone before using it as the only copy of financial records. Browser and installed PWA storage behavior can vary; export a backup before moving between them.

## Structure

```text
src/domain.ts       Financial model, validation, balances, allocations, demo and CSV
src/receipts.ts     Local OCR/PDF extraction, conservative parsing, proof storage
src/App.tsx         App navigation, planning, backup and restore
src/Dashboard.tsx   Responsive overview and data-derived insights
src/TransactionsPage.tsx Combined filters and transaction card actions
src/Reports.tsx     Period reports, CSV export and print/PDF layout
src/analytics.ts    Period buckets, report calendar ranges and local insights
src/preferences.ts Persisted dashboard insight preferences
src/forms.tsx       Account, goal, transaction and proof flows
src/ui.tsx          Accessible dialogs, charts, account marks and ledger components
src/AppNavigation.tsx Shared navigation, page paths and deep-link resolution
src/WalletPage.tsx  Wallet balances and personal/shared account lists
src/app.css        Unified iPhone-first UI, sheets, themes and report printing
src/MoneyAmount.tsx Compact visible values with exact accessible/print amounts
src/money.ts       Display-only currency scale and rounding
scripts/           Reproducible local assets and service-worker template
tests/             Financial/parsing tests and production browser tests
```

Next stages for a family product would include authenticated accounts, a secure backend, encrypted document storage, multi-device synchronization, and explicit membership/access rules. They are not simulated by the current local-first release.
