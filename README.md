# Budgeting App

This React + TypeScript app now focuses on a **modular transaction import and review workflow** rather than manual transaction entry.

## Phase 1 capabilities

- Upload one or more **ABSA** and **FNB** mobile banking screenshots.
- Extract only clearly visible transaction rows from each screenshot.
- Parse and review:
  - raw description
  - normalized description
  - inferred merchant
  - transaction date
  - amount
  - debit/credit direction
  - transaction type
  - transaction status
- Predict categories using the editable category system.
- Support a separate **ignored** review disposition that does not count toward totals.
- Default **Uncleared** transactions to ignored with an explanation.
- Confirm reviewed transactions and learn merchant-memory rules for future imports.
- Keep analytics limited to transactions marked `categorized` and `countsTowardTotals = true`.

## Architecture notes

The import pipeline is designed with extension points for:

- additional banks
- PDF import
- CSV import
- offline extraction
- duplicate detection
- recurring transaction detection
- split transactions
- richer merchant learning

## Demo import fixtures

For a quick local demo, rename uploaded screenshots to one of these fixture names to simulate extraction against the attached layouts:

- `absa-current-account.png`
- `absa-credit-account.png`
- `fnb-transaction-history.png`
- `absa-uncleared.png`

The UI will also attempt client-side OCR with `tesseract.js` for other uploaded images.

## Run locally

```bash
npm install
npm run dev
```

## Test

```bash
npm run test
```

## Build

```bash
npm run build
```
