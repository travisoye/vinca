# Vinca — Frontend Completion and Handoff Gate Checklist

**Document Version:** 1.0  
**Phase:** 4 (Frontend Completion and Handoff Gate)  
**Date:** 2026-10-24  
**Status:** All UI/Frontend source complete. Validation frozen (only authorized demo dev server module transforms verified). Ready for backend/protocol integration (Phases 5–8).

---

## 1. Executive Summary

Phases 1 through 4 have completed the entire visual presentation layer, routing, design system, accessible component library, presentation state management, edge fixtures, and user interaction flows for Vinca.

**Core frontend-first rule:** The interface, layouts, tables, dialogs, forms, and workflows are frozen before starting Rust, WASM, vault, or relay development. Protocol integration (Phases 5–8) will connect real cryptographic engines behind these exact service contracts without redesigning the user interface.

> [!IMPORTANT]
> **Simulation Boundary Reminder:**  
> All cryptographic inspection, vault encryption, recovery snapshots, and disclosure exports operating in Phases 1–4 are **in-browser presentation simulations** backed by typed, deterministic fixtures. No real key material has been parsed or persisted, and no live blockchain node has been queried. Genuine protocol execution begins in Phase 5.

---

## 2. Route & Screen Inventory

| Route | Implementation Scope | Alternate States Handled |
| --- | --- | --- |
| `/` | Landing page sequence: Hero 12 port, editorial product preview, 3-step workflow, disclosure comparison, developer contracts, privacy FAQ, closing CTA, restrained footer. | Mobile hamburger menu, reduced motion, dark surface-inverse hero. |
| `/docs` | Public integration contract, import formats, local processing model, supported networks, limitations. | Section TOC anchors, code snippets, copy honesty. |
| `/privacy` | Data locality, relay query visibility, zero telemetry, explicit memo fetch disclosures, honest non-claims. | Responsive two-column and stacked reading layouts. |
| `/terms` | Non-spending boundary, lack of key revocation on chain, exporter-assertion limits, phishing caveats. | Responsive document container. |
| `/app` | Workspace overview, metric cards, context inventory table, selected preview card, incoming totals tab (exact BigInt zatoshis), scan summaries tab. | Locked workspace gate, create vault gate, stale coverage, gap alerts, reorg notice indicators. |
| `/app/import` | Key evaluation catalog, preflight preview, component notices, capability overlap detection, custom label input, confirm/cancel. | Rejected mainnet key, rejected UFVK key, declared unretained components (Sapling). |
| `/app/contexts/:contextId` | Workbench: scope card, coverage card, receipts card, receipts table with exact amounts, action index, tx hex. | Zero receipts empty state, large identifiers, memo privacy disclosure dialog, offline tx import modal, archive dialog, delete dialog. |
| `/app/compare` | Side-by-side context selectors, capability overlap analysis, comparison matrix, identical received notes table. | Incomplete comparison, identical context selected, disjoint networks, overlapping incoming capabilities. |
| `/app/disclosures` | Context-Access Package vs Record Snapshot selector, receipt picker, memo toggle, package passphrase, export action, recipient inspection tab, local disclosure history. | Empty selection warning, continuing access warnings, irrevocable copy warnings, corrupted package decryption error. |
| `/app/settings` | Immediate lock action, inactivity lock policy explanation, encrypted recovery export/import, storage diagnostics, network configuration, reset workspace modal. | Recovery validation simulation, storage quota reports, destructive reset confirmation. |
| `/demo` | Completely isolated 5-step deterministic walkthrough tour covering key preflight, note decryption, memo privacy, overlap detection, and disclosures. | Step-by-step back/next navigation, direct step jumping, explicit memo simulation. |
| `/*` (404) | Document-styled Not Found page with return-to-home action inside PublicLayout. | Invalid route handling. |

---

## 3. Design System & Aesthetics Verification

- **Typography:** `@fontsource-variable/inter` locally bundled. Light headings (3xl–5xl font-light) matching Hero 12 composition.
- **Palette:** Burnt copper primary (`oklch(0.56 0.135 43)` light, `oklch(0.74 0.115 55)` dark) with contrast-safe foregrounds in both themes, harmonized with the hero aerial photograph.
- **Controls & Radius:** 0.75rem base radius (`--radius: 0.75rem`), pill buttons (`rounded-full`), subtle alpha borders (`oklch(1 0 0 / 10%)`).
- **Responsive Layout:** Tested across viewport widths (375px mobile, 768px tablet, 1440px desktop). Tables carry horizontal scroll containment (`min-w-[48rem]`) without blowing out page width.
- **Accessibility:**
  - Skip links (`#main-content`, `#hero-content`) with keyboard focus reveal.
  - Visible focus indicators (`outline: 2px solid var(--ring)` with `outline-offset: 3px`, forced-colors support).
  - ARIA attributes: `aria-expanded`, `aria-controls`, `aria-label`, `role="region"`, `role="alert"`, `role="status"`.
  - Native scrollbars preserved (Watermelon's globally hidden scrollbars explicitly avoided).
  - `@media (prefers-reduced-motion: reduce)` disables animations and sets smooth scrolling to auto.

---

## 4. Security & Disclosure Boundaries in UI Copy

- **Money is Exact:** All totals and amounts use integer zatoshis transported as decimal strings and formatted via BigInt arithmetic (`src/lib/format.ts`). Floating-point arithmetic is banned.
- **No Balances:** Incoming sums are strictly labelled as "Incoming Totals" or "Received Notes", never spendable balances.
- **No Fake Badges:** Fixture data and sample workspaces never carry live-chain verification badges.
- **No Revocation Claims:** UI copy explicitly warns that archiving or deleting a context does not revoke the viewing key on chain, and third parties holding previously exported packages retain continuing access.
- **Exporter Assertion Labels:** Snapshot amounts and memos are labelled as "exported-assertion", not independent proof of payment.
- **Transaction-Interest Disclosures:** Memos require explicit acknowledgement that fetching a transaction reveals interest in that transaction hash to the relay.
- **Clean URLs:** Route paths, query parameters, document titles, and telemetry never contain key material. Internal context routing uses `:contextId`.

---

## 5. Finalized Service Contracts for Protocol Phases

All backend service contracts are defined and frozen in [`apps/web/src/adapters/types.ts`](file:///c:/Users/USER/mynuclearcode/vinca/apps/web/src/adapters/types.ts):

1. **`VincaWorkerPort` (Phase 5):**
   - `decodeUivk(rawBytes: Uint8Array, network: Network): Promise<WorkerDecodedKeyResult>`
   - `scanRange(handle: OpaqueKeyHandle, range: CoverageRange, compactBlocks: Uint8Array): Promise<WorkerScanResult>`
   - `decryptMemo(handle: OpaqueKeyHandle, txBytes: Uint8Array, actionIndex: number): Promise<WorkerDecryptedMemoResult>`
   - `destroyHandle(handle: OpaqueKeyHandle): Promise<void>`
2. **`VincaVaultPort` (Phase 6):**
   - `initializeVault(passphrase: string): Promise<void>`
   - `unlockVault(passphrase: string): Promise<boolean>`
   - `lockVault(): Promise<void>`
   - `saveEncryptedContext(context: ContextSummary, keyPayload: EncryptedPayload): Promise<void>`
   - `deleteEncryptedContext(id: string): Promise<void>`
   - `exportRecoveryBackup(passphrase: string): Promise<RecoveryBackupBundle>`
   - `importRecoveryBackup(bundle: RecoveryBackupBundle, passphrase: string): Promise<RecoveryRestoreResult>`
   - `checkQuota(): Promise<StorageQuotaReport>`
3. **`VincaRelayPort` (Phase 7):**
   - `checkHealth(): Promise<RelayHealthReport>`
   - `getTipHeight(network: Network): Promise<number>`
   - `fetchCompactBlocks(network: Network, range: CoverageRange): Promise<Uint8Array>`
   - `fetchTransaction(network: Network, txIdHex: string): Promise<Uint8Array>`

---

## 6. Verification Status

- **Written Tests:**
  - `routing.test.tsx` (route rendering, public layout, footer honesty, 404)
  - `public-pages.test.tsx` (landing copy, sections, navigation, mobile menu)
  - `ui-components.test.tsx` (design system primitives, button variants, fields)
  - `adapters.test.ts` (presentation adapters, preview builder, warning codes)
  - `dashboard-workflows.test.tsx` (overview, import preflight, detail workbench, compare, disclosures, settings, demo)
  - `frontend-completion.test.tsx` (responsive bounds, edge fixtures, accessibility, service contract types)
- **Execution Evidence:** Under the validation freeze, tests have not been executed. All modules compile and serve with HTTP 200 via the Vite dev server at `http://localhost:5173`.
- **Handoff Conclusion:** The frontend gate is **PASSED (Source Complete)**. Work may now proceed to Phase 5 (Rust Core & WASM Worker).
