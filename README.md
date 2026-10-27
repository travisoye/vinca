# Vinca

> **Understand what you share before you share it.**
> A browser-based disclosure toolkit for Zcash wallet and payment developers.
> *ZECATHON — Core & Tooling Track*

---

> **Testnet scanning status (2026-10-27):** Testnet UIVK import and compact
> Orchard/Ironwood block trial-decryption are now wired through the Rust WASM
> worker. Local cryptographic vectors and scanner tests pass, and the WASM
> package builds. This does **not** confirm any particular wallet receipt:
> this workspace has not scanned testnet using your key, and old scan-height
> records are not proof of decrypted blocks. Import the actual incoming key
> locally and its real birthday height; verify that the relay is connected and
> the resulting coverage includes the height of the receipt. Never send the key
> in chat.
>
> **Memo implementation status:** The generated WASM package now exposes
> full-transaction Orchard/Ironwood memo decryption. Synthetic encrypted
> transaction vectors, worker/API tests, frontend tests, typecheck, and
> production build passed on 2026-10-27. A full browser memo request through
> the hosted relay has not been verified: the local browser was blocked by
> relay CORS, and no user key or transaction was used.

## 1. Overview

**Vinca** is an accountless, browser-based disclosure workbench built for developers, compliance engineers, and recipients operating on Zcash testnet.

When sharing viewing capabilities or audit evidence, wallet developers face critical boundaries: viewing keys cannot be revoked once shared, diversified addresses can link histories unexpectedly, and raw viewing keys grant complete historical and future visibility. Vinca provides the tooling to understand, bound, and verify these disclosures *before* any data leaves your machine.

---

## Problem Statement

Wallet and payment developers have no safe way to inspect or share incoming viewing capability before committing to it. Once an incoming viewing key is exported and shared, it cannot be revoked on chain; anyone holding it can decrypt past and future incoming payments tied to that capability. Diversified addresses derived from one account are not independent capabilities, so sharing them can unintentionally link transaction histories. Raw viewing keys grant full historical and future visibility, yet developers have no tooling to evaluate overlap, confirm what notes a key can open, bound scan coverage, or verify a disclosure *before* any key material leaves their machine. Existing workflows force a choice between blind trust and not sharing at all.

## Solution

Vinca is an accountless, browser-based disclosure workbench that lets developers understand, bound, and verify incoming viewing capability before anything is shared. Users import ZIP 316 Unified Incoming Viewing Keys (UIVK) locally, inspect received notes through browser-local WASM trial decryption of public testnet compact blocks, explicitly consent before any on-demand memo retrieval, and export either a Context-Access Package (continuing viewing capability, irrevocable) or a Record Snapshot (selected records, zero key material). Viewing keys never leave the browser — they are held in Web Worker memory behind opaque handles, never in DOM state, URLs, localStorage, or network payloads. Mainnet keys, addresses, and endpoints are permanently rejected at every boundary.

### Key Capabilities

- **Browser-Local Cryptographic Inspection:** Import ZIP 316 Unified Incoming Viewing Keys (UIVK) and inspect Orchard and experimental Ironwood capability components.
- **Strict Opaque Key Isolation:** Viewing keys are decoded inside a dedicated WebAssembly Web Worker (`crates/vinca-wasm`). Private keys never enter the DOM, React state, URLs, or local storage.
- **Capability Overlap Analysis:** Compare two contexts side-by-side to detect shared internal incoming viewing keys (`ivk`) or diversified address keys (`dk`), preventing accidental linkability.
- **Two Distinct Disclosure Exports:**
  1. **Context-Access Package:** Exports continuing viewing access with cryptographic warning disclosures and unambiguous retained-copy notices.
  2. **Record Snapshot:** Exports selected transaction receipts and metadata with **zero key material** and zero note-opening secrets.
- **Zero-Float Financial Math:** All values are represented as exact integer zatoshis (`Zatoshis = string`), transported as decimal strings, and formatted via BigInt arithmetic.
- **Memo Retrieval Status:** Memos are never fetched automatically, and the interface requires explicit consent before a transaction query. The generated WASM package supports local full-transaction memo decryption, preserving text and raw ZIP-302 bytes. Synthetic vectors passed; a hosted browser memo flow and any particular live receipt remain unverified.
- **Permanent Mainnet Rejection:** Vinca strictly rejects mainnet keys, addresses, and chain endpoints at all architectural boundaries.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BROWSER WORKSPACE                             │
│                                                                         │
│  ┌────────────────────────┐         ┌────────────────────────────────┐  │
│  │   React 19 Frontend    │         │      WASM Web Worker           │  │
│  │   (apps/web)           │         │      (crates/vinca-wasm)       │  │
│  │  • Workbench UI        │ Message │  • ZIP 316 UIVK Parser         │  │
│  │  • Capability Compare  │ Channel │  • Opaque Key Handle Map       │  │
│  │  • Disclosure Exporter │◄───────►│  • Note/Memo Decryptor         │  │
│  │  • Live Scanner UI     │         │  • Local Key Isolation         │  │
│  └───────────┬────────────┘         └────────────────────────────────┘  │
│              │                                                          │
│  ┌───────────▼────────────┐                                             │
│  │ Encrypted Vault (IDB)  │                                             │
│  │  • AES-256-GCM AEAD      │                                             │
│  │  • Auto-opens in browser │                                             │
│  └────────────────────────┘                                             │
└───────────────────────┬─────────────────────────────────────────────────┘
                        │ Public JSON/HTTPS (No Keys, No Addresses)
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PUBLIC CHAIN RELAY (Render)                        │
│                      (services/chain-relay)                             │
│  • Axum / Tokio HTTP Facade                                             │
│  • Unauthenticated, Stateless, Read-Only                                │
│  • Endpoints: /health, /tip/:network, /blocks/:network, /tx/:network    │
│  • Strict Operator Allowlist & Rate Limiting                            │
│  • Privacy-Redacted Logging (Truncated TXIDs)                           │
└───────────────────────┬─────────────────────────────────────────────────┘
                        │ gRPC (Port 9067)
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               LIGHTWALLETD (Testnet / Regtest Node)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Repository Structure

```
vinca/
├── apps/
│   └── web/                     # Vite + React 19 + TypeScript frontend
│       ├── src/
│       │   ├── adapters/        # Port interfaces & Relay/Worker/Vault clients
│       │   ├── components/      # Design system, landing sections, dialogs
│       │   ├── context/         # Workspace provider (demo & live modes)
│       │   ├── fixtures/        # Deterministic sample contexts & receipts
│       │   ├── lib/             # BigInt formatting, vault AEAD, live scanner
│       │   ├── routes/          # Landing, workbench, import, disclosures, docs
│       │   └── workers/         # WASM worker bridge (inspection.worker.ts)
│       └── vercel.json          # SPA routing, WASM MIME type, strict CSP
├── crates/
│   ├── vinca-core/              # Pure Rust cryptographic & protocol logic
│   └── vinca-wasm/              # WASM worker bindings with opaque handle isolation
├── services/
│   └── chain-relay/             # Axum/Tokio public blockchain data relay
├── implementation docs/         # PRD, context log, checklist, licensing
├── AGENTS.md                    # Agent onboarding and project boundaries
└── render.yaml                  # Render deployment configuration for chain relay
```

---

## 3. Privacy & Security Rules

Vinca is designed according to strict cryptographic and disclosure realities:

1. **Keys Never Leave the Browser:** Viewing keys are held in Web Worker memory referenced by random UUID handles (`OpaqueKeyHandle`). They are never transmitted over the network or saved to unencrypted storage.
2. **Disclosure Honesty:** 
   - A recipient of a viewing key can reshare it indefinitely. Vinca never claims that viewing keys can be "revoked" on-chain.
   - Filtering exported receipts by date or amount is an organizational convenience, **not** a cryptographic boundary. A recipient with the key can re-scan the entire chain.
   - Record snapshots are certified as unspent only at the local scan time and do not constitute consensus-level payment proofs.
3. **No Automatic Memo Fetching:** Memos are shielded payload components. Querying full transaction details from a public lightwalletd exposes transaction IDs and client IP addresses. Vinca requires an explicit user consent dialog explaining this trade-off before any memo fetch.
4. **Permanent Mainnet Rejection:** Any key with an `HRP` beginning with `uview` (mainnet) or spending authority (`secret-extended-key`, `uask`, `ufvk`) is rejected during preflight validation.

---

## 4. Getting Started

### Prerequisites

- **Node.js:** v20.18.0 or newer
- **Rust Toolchain:** 1.89.0 or newer (only needed to run Rust tests or regenerate the committed WASM package)

```bash
# Add WebAssembly target before regenerating the committed WASM package
rustup target add wasm32-unknown-unknown
```

### Running the Web Application (Local Dev)

```bash
cd apps/web
npm install
npm run dev
```

The generated Rust/WASM package is committed under `apps/web/src/wasm`, so
Vercel's frontend build does not need Rust, rustup, or the WebAssembly target.
When Rust WASM sources change, regenerate it from `apps/web` using
`npm run build:wasm` and include the updated generated files in that change.
`npm run dev` regenerates the package automatically for local development.

Visit `http://localhost:5173` in your browser.

- **Demo Mode:** Click **"Open Dashboard"** or visit `/demo` to interact with pre-loaded, deterministic synthetic contexts (`ctx-alpha`). Try comparing capability overlap, testing export previews, and simulating reorg rollbacks without running a node.
- **Live Mode:** Import real testnet UIVKs to open your browser workspace and connect to a running chain relay. The workspace opens automatically — no passphrase unlock or auto-lock. Anyone with access to this browser profile can read stored records.

### Running the Public Chain Relay

```bash
cd services/chain-relay
cp relay.toml.example relay.toml
cargo run -p vinca-chain-relay
```

The relay binds to `http://localhost:8080` (or `PORT`) and exposes read-only public endpoints:
- `GET /health` — Service readiness and configured network profiles
- `GET /tip/testnet` — Latest testnet block height
- `GET /blocks/testnet?start=2700000&end=2700100` — Compact block ranges
- `GET /tx/testnet/:txid` — Raw transaction payload (on-demand memo retrieval)

---

## 5. Wallet Export Guide

To inspect an incoming viewing key in Vinca, export an **incoming viewing key only** (UIVK) from a supported testnet wallet. **Never export spending keys or seeds.**

### Zallet (CLI / RPC)
Use Zallet's documented export procedure to export the account's Unified
Incoming Viewing Key (UIVK). The testnet prefix is `uivktest1...` for
ZIP-316 revision 0 or `uvitest1...` for revision 2.

### Ywallet
1. Open Ywallet and switch network to **Testnet**.
2. Navigate to **Settings** → **Backup / Keys**.
3. Select **Export Viewing Key** (ensure "Incoming Only" is selected).
4. Verify the exported testnet UIVK starts with `uivktest` or `uvitest`.

### Zashi
1. Switch to Zcash Testnet in **Advanced Settings**.
2. Navigate to **Account Details** → **Advanced Information**.
3. Copy the **Unified Incoming Viewing Key**.

---

## 6. Deployment Guide

### Frontend Deployment (Vercel)

The frontend is configured for zero-configuration static deployment via Vercel:

```bash
cd apps/web
# Requires Vercel CLI with authorized credentials
vercel --prod
```

`apps/web/vercel.json` provides:
- Single-page application (SPA) routing rewrites.
- Static asset exclusions ensuring WASM and JS chunks are not rewritten to HTML.
- Explicit `application/wasm` MIME type headers.
- Strict Content Security Policy (`script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; frame-ancestors 'none'`).

### Relay Deployment (Render / Docker)

The chain relay is containerized using a multi-stage Docker build producing an unprivileged, minimal Debian runner image.

Deploy via `render.yaml` or Docker:
```bash
docker build -t vinca-chain-relay -f services/chain-relay/Dockerfile .
docker run -p 8080:8080 \
  -e PORT=8080 \
  -e WEB_ORIGIN=https://vinca.vercel.app \
  -e LIGHTWALLETD_TESTNET_URL=https://lightwalletd.testnet.electriccoin.co:9067 \
  vinca-chain-relay
```

---

## 7. Validation & Verification Ledger

Vinca enforces a strict validation ledger tracking real execution evidence:

The results below are historical source/build checks. They do not establish
that live testnet note decryption works; see the operational status above.

| Test / Verification Suite | Command | Result | Pass Rate / Metric |
| :--- | :--- | :--- | :--- |
| **TypeScript Typecheck** | `npm run typecheck` | Passed | 0 errors |
| **Frontend Unit & Integration** | `npx vitest run` | Passed | 115 / 115 tests (100% in 38.65s) |
| **Frontend Production Build** | `npm run build` | Passed | `dist/` bundle generated (38.14s) |
| **Rust Core Inspection Suite** | `cargo test -p vinca-core` | Passed | 9 / 9 tests in 0.03s |
| **Rust WASM Worker Suite** | `cargo test -p vinca-wasm` | Passed | 2 / 2 tests in 0.02s |
| **WASM Target Compilation** | `cargo check --target wasm32-unknown-unknown -p vinca-wasm` | Passed | 0 errors |
| **Local Privacy Review** | Visual / Code Audit | Verified | Zero raw keys outside worker; exact BigInt zatoshis; mainnet rejected |

### Memo follow-up validation (2026-10-27)

| Test / Verification Suite | Command | Result | Pass Rate / Metric |
| :--- | :--- | :--- | :--- |
| **Rust Core Memo Suite** | `cargo test --locked --offline -p vinca-core` | Passed | 31 tests |
| **WASM Worker API Suite** | `cargo test --locked --offline -p vinca-wasm --test wasm_worker_tests` | Passed | 5 tests |
| **Chain Relay Suite** | `cargo test --locked --offline -p vinca-chain-relay` | Passed | 52 tests |
| **Focused Frontend Suites** | `npx vitest run` with worker protocol, live integration, dashboard workflows, and vault engine selectors | Passed | 79 tests |
| **TypeScript Typecheck** | `npm run typecheck` | Passed | 0 errors |
| **WASM Target / Package** | `cargo check --locked --offline --target wasm32-unknown-unknown -p vinca-wasm`; `wasm-pack build --mode no-install --no-opt -- --locked --offline` | Passed | Compiled and regenerated bindings/package |
| **Generated Memo Export** | Node invocation with synthetic UIVK and encrypted transaction fixture | Passed | Text and all 512 raw memo bytes returned |
| **Frontend Production Build** | `npm run build` | Passed | `dist/` generated; existing large-chunk warning |

These are synthetic/source validation results, not mined-transaction,
consensus, hosted-browser, or user-receipt evidence. The local browser could
not call the hosted relay because of CORS. A separate local Docker image build
also remains unverified because Docker Desktop's Linux engine was unavailable;
the Dockerfile now copies the tracked `vendor/` override required by Cargo.

---

## 8. Asset & Dependency Licensing

- **Code:** Dual-licensed under MIT OR Apache-2.0.
- **Typography:** Inter Variable font licensed under SIL Open Font License 1.1.
- **Design Primitives:** Radix UI (MIT), Lucide React (ISC/MIT), Tailwind CSS (MIT), Motion (MIT).
- **Hero Photography:** The hero background asset is documented with clear provenance and operational guidance in [`implementation docs/asset-licensing.md`](implementation%20docs/asset-licensing.md).

---

## 9. Disclaimer

*Vinca is an experimental hackathon project developed for the ZECATHON Core & Tooling track. It is provided for testnet use only. Vinca has not been independently audited. Never import mainnet seed phrases, private keys, or full viewing keys into Vinca.*
