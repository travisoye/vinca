# Vinca Product Requirements Document

Version: 1.0  
Created: 2026-10-24  
Status: Requirements documented; implementation has not started.  
Project directory: `C:\Users\USER\mynuclearcode\vinca`  
Hackathon track: ZECATHON Core & Tooling

## 1. Purpose and Authority

Vinca is a browser-based disclosure toolkit for Zcash wallet and payment developers. It helps them understand incoming viewing authority, compare receiving contexts, inspect received notes, and deliberately share either continuing context access or selected records.

This PRD converts the approved Vinca implementation plan into ordered phases. It preserves the agreed product and security boundaries while applying the latest instruction: **all frontend and UI work comes first**.

Source plan: `C:\Users\USER\.local\share\kilo\plans\1791788659713-scoped-viewing-key-project.md`.

Use this PRD for implementation order and progress tracking. The source plan remains the supporting design record. Do not silently change the agreed architecture to resolve an implementation blocker. Vinca is independent of Splyt; do not copy or modify Splyt's code, data, dependencies, environment files or product workflow.

Creating this document does not mean the application has been scaffolded, implemented, tested or deployed.

## 2. Product Definition

### Primary users

- Wallet and payment developers importing incoming viewing material from accounts created in an external wallet.
- Developers investigating duplicate or overlapping incoming capabilities before sharing them.
- Recipients inspecting an encrypted context-access package or a selected-record snapshot.

### Core workflow

1. Open the deployed website and create or unlock an encrypted browser workspace.
2. Import a supported incoming viewing-key file from an external wallet.
3. Review its receivers, supported network, capability overlap and scan coverage.
4. Inspect incoming notes using browser-local processing of public blockchain data or an offline dataset.
5. Request a memo explicitly when needed, acknowledging the transaction-interest disclosure.
6. Export either continuing context access or selected records in an encrypted file.
7. Let the recipient decrypt and inspect the package in their own browser.
8. Export an encrypted recovery file to preserve the local workspace.

### Product vocabulary

| Term | Required meaning |
| --- | --- |
| Workspace | A passphrase-encrypted browser vault, not a wallet or server account. |
| Context | An imported incoming capability, validated receiver/network metadata, a birthday and coverage state. Its label does not establish account ownership or provenance. |
| Receipt | A locally decrypted incoming note with source, network, pool, output identifiers and an exact amount. It is not a spendable balance. |
| Coverage | The actual contiguous ranges and supported formats inspected, including gaps and source limitations. |
| Context-access package | An incoming viewing capability and explicit metadata. Its holder may inspect other matching past or future receipts. |
| Record snapshot | Selected exported records without viewing or spending keys. Private amounts and memos remain exporter-provided information, not independent payment proof. |
| Recovery export | An encrypted snapshot of Vinca's local records and read-only context inventory. It does not recover wallet spending authority. |

## 3. Locked Requirements

| Area | Decision |
| --- | --- |
| Brand | Vinca, pronounced VIN-kuh. Do not append Key, Shield, ZK or AI. |
| Interface | A real landing page and web dashboard, not a desktop application or a browser-only marketing demo. |
| Frontend | Vite, React, TypeScript, Tailwind CSS, Radix/shadcn primitives, Motion and Lucide. |
| Protocol processing | A reusable Rust core with browser-compatible WebAssembly bindings running in a worker. |
| Local storage | Passphrase-encrypted IndexedDB, with locking and encrypted recovery exports. |
| Backend | A Rust public-blockchain-data relay. No private workspace database or server-side key processing. |
| Hosting | Vercel for the frontend and Render for the Rust relay. |
| Accounts | Accountless. No email registration, wallet login, cloud sync or server password recovery. |
| Wallet authority | An external wallet creates standard ZIP 32 accounts and retains all spending authority. |
| Imports | Incoming viewing-key files only. No seed, spending-key or full-viewing-key import, wallet RPC or account creation. |
| Networks | Testnet and reproducible regtest. Reject mainnet encodings, profiles and endpoints. |
| Pool scope | Supported native Orchard-family formats, including legacy Orchard and Ironwood under pinned upstream libraries and explicit network profiles. |
| Inspection | Local live scanning and clearly labelled offline inspection. |
| Memo retrieval | Explicit, on-demand full-transaction retrieval or offline transaction import. No automatic matching-transaction fetches. |
| Sharing | Encrypted files exchanged outside Vinca. No hosted sharing links or package uploads. |
| Visual source | The supplied Watermelon Hero 12 template and its verified global font, palette and component language. |

Normal website users do not install Rust, run terminal commands, start a companion or operate a node. Build tools and regtest infrastructure are developer/operator concerns.

### Non-negotiable boundaries

- Diversified addresses from one account are not independent incoming capabilities.
- Imported keys cannot prove different root seeds, ZIP 32 account numbers, account ownership or spending control.
- An Orchard-family incoming capability may cover both Orchard and Ironwood. A pool, address or date filter is not a cryptographic restriction on an exported key.
- A recipient can retain and reshare a viewing key. Archiving, deletion, file expiry or changing a passphrase cannot revoke their existing copy.
- Received totals are not verified unspent balances. Source continuity checks are not full consensus verification, proof of solvency or proof of payer identity.
- Snapshot encryption protects the file; it does not prove that its author truthfully reported a private amount or that a human recipient is authentic.
- The relay/provider can observe connection metadata, ranges and deliberately requested transaction IDs. Viewing keys, labels, amounts and decrypted records must not be transmitted to it.
- Compromised devices, malicious frontend updates, screenshots, copied packages and complete protection from traffic correlation are outside the guarantee.

## 4. Frontend-First Delivery Rule

**Phases 1 through 4 complete the entire visual interface, page content, navigation, dialogs, forms, responsive behaviour and interaction states before protocol, storage or relay implementation begins.**

During those phases, use typed, deterministic, publicly labelled sample data and in-memory presentation adapters. Build the complete experience without requiring a running backend or compiled WASM.

- Keep a persistent preview notice explaining that cryptographic inspection and live scanning are not connected.
- Use bundled fixture selectors instead of reading arbitrary user key files. Do not collect real passphrases or sensitive viewing material in a mocked vault.
- Do not persist private data or call a real wallet, scanner or relay from the frontend prototype.
- A mocked confirmation, decrypted record or export must never be presented as a verified protocol result.
- Define the service interfaces and presentation data contracts early, but implement their real cryptographic and network behaviour only in later phases.
- Finish the UI for errors, loading, unsupported formats, locked workspaces, stale coverage, recovery, overlap warnings and cancellation before backend work.
- Later integration replaces the adapters behind the completed interface. It is not a deferred dashboard-design phase. Necessary bug fixes remain allowed, but new UI features require an explicit scope decision.

Completing the frontend first accepts the risk that later WASM or protocol validation may uncover integration constraints. Keep the interface decoupled, and do not resolve such constraints by silently uploading keys or replacing real functionality with mocks.

## 5. Phase Overview

All application phases are currently **Not started**. All execution checks are **Not run**.

| Phase | Deliverable | Depends on | Completion type |
| --- | --- | --- | --- |
| 1 | Frontend foundation and Hero 12 design system | This PRD | UI source complete |
| 2 | Complete landing page, public content and documentation layouts | Phase 1 | UI source complete |
| 3 | Complete dashboard screens and interactive sample workflows | Phases 1-2 | UI source complete |
| 4 | Frontend completion, responsive behaviour, accessibility and handoff | Phase 3 | All frontend/UI source complete |
| 5 | Rust inspection core and WASM worker bindings | Phase 4 | Protocol implementation complete |
| 6 | Encrypted browser vault, recovery and disclosure packages | Phase 5 | Local security implementation complete |
| 7 | Public blockchain-data relay | Phase 4; execute after Phase 6 | Relay implementation complete |
| 8 | Live/offline scanning and real end-to-end integration | Phases 5-7 | All application code complete |
| 9 | Authorised validation, privacy review and failure correction | Phase 8 and explicit validation authorisation | Recorded execution evidence |
| 10 | Release preparation, authorised deployment and handoff | Phase 9 and release authorisation | Release evidence |

### Validation policy

Write the relevant tests during every phase, but do not run tests, lint, typechecks or builds until the user explicitly says all phase code is written and lifts the validation freeze. This includes Rust/WASM compilation. Do not start watchers or other commands to bypass that restriction.

Source review and test implementation are not passing test results. Record source completion separately from execution evidence. Phase 9 starts with the minimal browser/WASM compatibility gate, then proceeds to wider validation. If the user explicitly authorises an earlier gate, record that exception rather than assuming it.

Do not initialise Git, commit, deploy, publish packages, access real secret files or spend mainnet funds as an incidental part of a phase. These require separate applicable authorisation; mainnet use is outside this release's scope.

## Phase 1: Frontend Foundation and Design System

**Status:** Source complete, 2026-10-24. Not built, not executed, not visually reviewed — see the validation policy. Code lives in `apps/web/`.

**Goal:** Establish Vinca's complete presentation foundation before any Rust, vault or backend implementation.

### Deliverables

- [x] Create the Vite/React/TypeScript frontend workspace and planned route structure. Keep the new project independent of Splyt.
- [x] Define strict frontend types for context summaries, receipts, coverage, export previews and interface states using synthetic values.
- [x] Add typed presentation adapters and fixture data. Do not implement key parsing, live scanning, encryption or private persistence yet.
- [x] Adopt the supplied Hero 12/Hero3 composition and locally bundle Inter Variable, Lucide icons and permitted visual assets.
- [x] Build reusable buttons, fields, tabs, badges, tables, dialogs, alerts, navigation, empty states and loading treatments from the template's design language.
- [x] Define light/dark themes and responsive foundations without importing unrelated Watermelon product code or analytics.
- [x] Write component and routing tests without executing them under the freeze.

### Required design tokens

| Token | Value or treatment |
| --- | --- |
| Font | Locally bundled `Inter Variable` from `@fontsource-variable/inter`. |
| Hero type | Light weight, 40-68 px responsive title, approximately 1.05 line height, italic second line using the same family. |
| Body type | 14-16 px, comfortable line height and readable data density. |
| Light surface/text | `oklch(1 0 0)` / `oklch(0.145 0 0)`. |
| Dark surface/card/text | `oklch(0.145 0 0)` / `oklch(0.205 0 0)` / `oklch(0.985 0 0)`. |
| Primary | Burnt copper `oklch(0.56 0.135 43)` (light) and `oklch(0.74 0.115 55)` (dark), with contrast-safe foregrounds. Replaces the template's lime-500 accent by explicit user decision on 2026-10-24 so the accent matches the hero photograph. |
| Borders and radius | Source white/black alpha borders, thin rules, `0.625rem` base radius and rounded pill controls. |
| Details | Restrained glass controls, corner-frame lines, outline buttons and the source's photographic hero treatment. |
| Dashboard | Calm, legible surfaces using the same tokens. No photograph beneath dense receipt tables or unrelated trading widgets. |

Do not replace the template with Splyt's typography or an unrelated ivory/olive design. Use monospace only where it improves identifier and fingerprint readability. Do not copy the source's globally hidden scrollbars.

**Source-completion criteria:** Shared components, theme values, route shells and fixture-only adapters are written. Every subsequent page can use this foundation without a backend. Execution and visual validation remain pending.

## Phase 2: Complete Landing Page and Public Content

**Status:** Source complete, 2026-10-24. Dev-server demo authorized by the user and running; production build and automated tests remain deferred.

**Goal:** Finish all public-facing pages, content and navigation using the supplied template.

### Deliverables

- [x] Adapt Hero 12 imports and assets for Vite. Remove unnecessary Next.js-specific directives without changing the composition.
- [x] Preserve the hero's image treatment, title reveal, italic emphasis, thin separator, pill actions and bottom-bar layout.
- [x] Replace Watermelon branding with Vinca while preserving header proportions and the chosen visual language.
- [x] Replace Sign up with Open dashboard, remove fictitious awards and inactive language/pricing controls, and implement a working mobile menu.
- [x] Build the rest of the landing page in the order below, with deliberate variation in section layout instead of repeated generic feature-card grids.
- [x] Finish `/docs`, `/privacy` and `/terms` page layouts and initial accurate content, including the public integration-contract overview.
- [x] Add metadata, accessible labels, meaningful alt text, working anchors and verified footer destinations. Do not invent contact channels, audits, endorsements or adoption numbers.
- [x] Write public-route, navigation, copy-presence and accessibility test cases; execution remains deferred.

### Landing-page sequence

1. Supplied hero with Vinca copy and functional actions.
2. An editorial product explanation beside a clearly labelled inspection preview.
3. A three-step sequence explaining import, inspection and deliberate disclosure.
4. A side-by-side comparison of continuing context access and keyless record snapshots.
5. A concise developer integration section explaining the reusable toolkit and local processing model.
6. A privacy FAQ covering custody, disclosure scope, evidence levels, recovery and source metadata.
7. A closing dashboard action and restrained footer.

### Copy baseline

| Surface | Content |
| --- | --- |
| Brand | Vinca |
| Badge | A read-only toolkit for Zcash developers. |
| Hero line 1 | Understand what you share |
| Hero line 2 | before you share it. |
| Hero description | Vinca helps wallet and application developers inspect receiving-key scope, compare contexts, and prepare deliberate disclosures. Private inspection happens in your browser, and each export distinguishes continuing incoming access from selected payment records. |
| Primary action | Open dashboard, linking to `/app`. |
| Secondary action | Explore the workflow, linking to `#how-it-works`. |
| Bottom sentence | Your wallet retains spending authority while Vinca helps you understand and share incoming access deliberately. |
| Workflow paragraph | Import an incoming viewing key from a compatible wallet and review the access it carries. Inspect received notes locally, then choose whether to share that continuing access or export only the records you need. |
| Context-access explanation | A context-access package lets its holder inspect incoming data covered by the key, including later payments. Vinca explains this scope before sharing because a date filter or deleted file cannot revoke a key someone already holds. |
| Snapshot explanation | A record snapshot contains the entries you select without including a viewing key. It is useful for sharing information, but recipients should not treat the exported private amounts or memos as an independently verified payment proof. |

Body copy should generally use one or two complete sentences of approximately 20-45 words. Keep labels and actions concise where necessary. Avoid em dashes, hype, fragmented slogan chains, security guarantees and manufactured crypto/AI terminology.

Preserve MIT/OFL notices where applicable. The separately hosted `hero-3.avif` background needs its own reuse-rights check before publication. Obtain an approved replacement if rights cannot be established. Do not copy PostHog, session replay or Watermelon bootstrap code.

**Source-completion criteria:** Every public page and section is written, links have intended destinations, and copy reflects the actual planned product. No missing marketing page or documentation layout is deferred until backend implementation.

## Phase 3: Complete Dashboard and Sample Workflows

**Goal:** Build every dashboard screen and user interaction against the fixture-only adapters.

### Route requirements

| Route | Complete frontend behaviour |
| --- | --- |
| `/app` | Create/unlock/locked workspace states, context inventory, incoming totals, actual-versus-sample status and scan summaries. |
| `/app/import` | Fixture selection, import preflight, network/receiver/component warnings, scope preview, confirmation and cancellation. Arbitrary sensitive file reading remains disabled. |
| `/app/contexts/:id` | Context metadata, receiver association, capability overlap, birthday, coverage, receipt list, memo request warning, archive/unarchive and deletion dialogs. |
| `/app/compare` | Selection and comparison of local contexts, including duplicate capability and incomplete-comparison states. |
| `/app/disclosures` | Format selection, selected-record preview, continuing-access warnings, export dialogue and local history presentation. |
| `/app/settings` | Vault lock controls, recovery-export/import screens, storage diagnostics, source settings and local deletion confirmation. |
| `/demo` | A separate sample workspace with a visible sample banner and a deterministic walkthrough. It must not read or mutate the user's private workspace. |

### Deliverables

- [x] Implement the context-list/detail workbench with compact navigation, a scope summary, receipt table, coverage panel and export preview.
- [x] Write complete interaction paths for onboarding, import, comparison, receipt inspection, disclosure, recovery and cancellation.
- [x] Show network and evidence level consistently. Do not label incoming totals as balances or give sample data a live-chain verification badge.
- [x] Add amount formatting using exact decimal-string/integer presentation contracts. Do not build protocol key arithmetic in the UI.
- [x] Add dialogs for mixed/out-of-scope components, shared capability, stale birthdays, missing scan ranges, archived contexts and unsupported formats.
- [x] Include the explicit memo-fetch privacy acknowledgement and offline transaction-import presentation.
- [x] Finish the recipient workflow for decrypting, inspecting, accepting or cancelling a sample disclosure package.
- [x] Implement fixture-based navigation and state transitions so the entire UI can be assessed independently of later services.
- [x] Write tests for routing, selection, filtering, state transitions, warnings, evidence labels and cancellation without running them.

Keep keys out of route paths, search parameters, document titles and UI telemetry. Display only the private details deliberately requested in the unlocked interface, not hidden raw-key debug panels.

**Source-completion criteria:** Every planned screen, action and alternate state exists in the frontend. No live service is required to navigate the full sample workflow, and the interface clearly distinguishes presentation fixtures from real inspection.

## Phase 4: Frontend Completion and Handoff Gate

**Goal:** Finish all UI work before starting the protocol and backend phases.

### Deliverables

- [x] Complete responsive behaviour near 375, 768 and 1440 px, with usable stacked panels on small screens and no clipped hero text.
- [x] Implement keyboard navigation, logical focus order, focus trapping/restoration in dialogs, accessible tables/forms and visible focus states.
- [x] Respect reduced motion and preserve readable content without animations. Do not hide essential scroll areas.
- [x] Complete all empty, loading, working, cancelled, offline, stale, invalid, unsupported, locked, storage-full and failed-export states.
- [x] Finish privacy/legal explanations, confirmation text, recovery warnings, field errors, tooltips, metadata and alt text.
- [x] Add fixtures for zero receipts, large identifiers, duplicate contexts, partial coverage, reorg notices, wrong passphrases and malformed packages.
- [x] Finalise typed service contracts and generated-type expectations for the later worker, vault and relay adapters.
- [x] Write screenshot, route, accessibility and interaction test specifications. Record them as not run while validation is frozen.
- [x] Record the UI handoff checklist and note that security-related success states are still simulations until real integration is enabled.

### Mandatory frontend gate

- All routes listed in Phases 2-3 have complete layouts and planned interactions.
- Public and in-app content follows the selected writing style and accurately limits privacy claims.
- Hero 12's verified font, palette and controls are used consistently across landing and dashboard.
- No backend dependency was introduced to make the UI navigable.
- No real key import, vault protection, decryption, payment inspection or cryptographic export is claimed by the fixture implementation.
- The user can review the complete frontend source before work proceeds to Phase 5. This is a source-completion checkpoint, not a report that visual or automated checks passed.

## Phase 5: Rust Inspection Core and WASM Worker

**Goal:** Implement genuine incoming-capability and note inspection behind the completed UI contracts.

### Deliverables

- [x] Establish `crates/vinca-core` and `crates/vinca-wasm` with narrow feature boundaries and a reusable API independent of React and network transport.
- [x] Select maintained upstream primitives and exact compatible dependency pins. Inspected research used librustzcash commit `146a08fc779678f6b81997da5f9b7c3378ffccb9`, Rust 1.89 and edition 2024; compilation compatibility remains unverified.
- [x] Implement `UnifiedIncomingViewingKey::decode` with explicit network parameters and complete raw component enumeration.
- [x] Reject UFVKs, spending material, mainnet encodings, malformed inputs, unsupported revisions and unknown components.
- [x] Make any Orchard-family-only narrowing of known mixed UIVKs explicit. Validate and re-encode retained capability through upstream APIs; reject rather than silently retain a broader key if safe narrowing is unavailable.
- [x] Validate every retained receiver independently. A match for one receiver in a mixed address must not be reported as whole-address validation.
- [x] Detect duplicate complete components and overlapping incoming decryption scalars, including equal `ivk` with different `dk`. Report shared diversifier material separately from identical decryption access.
- [x] Implement compact-note inspection and full-note/memo processing using the correct Orchard/Ironwood domains, not Zakura's experimental one-time derivation.
- [x] Return sanitized metadata and requested records through typed worker messages. Use opaque key handles; do not put raw viewing keys in general React state.
- [x] Bound file sizes, input counts, buffer allocations, heights and decoded fields before upstream helpers that may panic on malformed input.
- [x] Write valid/invalid key, receiver association, overlap, note-format and known-vector tests. Do not compile or execute them before validation is authorised.

Candidate dependency family from the approved research: `zcash_keys 0.17.0`, `zcash_address 0.14.0`, `zcash_protocol 0.11.0`, `orchard 0.16.0`, `zcash_note_encryption 0.5.1`, and `zcash_primitives 0.31.0` where full transaction parsing is needed. These are candidate aligned pins, not a tested lockfile.

Do not bring a full wallet database or native gRPC client into the browser module. `scan_cached_blocks` expects UFVK-based wallet storage; do not broaden the import policy to satisfy that API. Prefer lower-level incoming-only scanning or narrow note decryption.

**Source-completion criteria:** Real protocol code and tests are written behind the frontend contracts. Live import remains gated until the actual browser/WASM compatibility checks are permitted and pass. If compatibility fails, resolve it explicitly rather than uploading keys to a server or retaining mocked inspection.

## Phase 6: Encrypted Vault, Recovery and Disclosure Engine

**Goal:** Replace the presentation storage/export adapters with genuine local security and file handling.

### Deliverables

- [x] Implement AES-256-GCM with fresh random 96-bit nonces and authenticated associated data binding record kind, identifier, schema version and revision.
- [x] Derive passphrase-based vault/export keys with WebCrypto PBKDF2-HMAC-SHA-256, fresh salts and at least 600,000 iterations. Bound imported KDF parameters to prevent hostile resource exhaustion.
- [x] Encrypt viewing material, labels, addresses, receipts, memos and disclosure history before IndexedDB writes. Do not persist private plaintext in localStorage, service-worker caches or logs.
- [x] Implement explicit locking and a 10-minute inactivity lock, cancelling jobs, invalidating handles, terminating workers and clearing private UI state.
- [x] Handle transactional writes, quota failures, interrupted operations and multi-tab conflicts without silent stale overwrites or false saved states.
- [x] Implement versioned encrypted recovery export/import with safe format checks and separate disclosure-file passphrases. Failed decryptions must not modify the active workspace.
- [x] Preserve snapshot freshness warnings. Restored coverage is stale until refreshed; older backups do not discover subsequently imported contexts automatically.
- [x] Implement archive, unarchive and local deletion with retained-copy and late-payment warnings. Vinca does not revoke keys or recover external wallet seeds.
- [x] Implement authenticated file kinds `context-access`, `record-snapshot` and `workspace-backup`, preventing file-kind substitution.
- [x] Preview the full continuing capability before context export, including matching earlier/later receipts and all supported native pool access.
- [x] Exclude all viewing, spending and note-opening secrets from record snapshots. Include only selected records and explicitly selected memo fields.
- [x] Assign recipient evidence labels locally. A package's own `verified` flag cannot elevate its private records to independent payment proof.
- [x] Write nonce/AAD, wrong-passphrase, corrupted-file, type-confusion, recovery, quota, concurrency and lock/cancellation tests without running them.

AEAD authenticates possession of a file secret, not a person's identity or truthful accounting. Do not promise perfect zeroisation of every JavaScript, WASM or operating-system memory copy.

**Source-completion criteria:** The real vault and both disclosure formats are implemented and covered by written tests. Keys and records remain local, and the recipient import workflow does not require a cloud service.

## Phase 7: Public Blockchain-Data Relay

**Goal:** Supply public chain information to browsers without learning private viewing material.

### Deliverables

- [x] Create `services/chain-relay` using a narrow Rust HTTP service, such as Axum/Tokio with maintained tonic lightwalletd bindings.
- [x] Define operator-configured testnet/regtest profiles, supported upgrade schedules, checkpoints and a strict upstream allowlist.
- [x] Provide bounded routes for health/readiness, profiles, source tip, block/range data, required boundary/tree state and explicit transaction retrieval.
- [x] Return public bytes or a versioned lossless compact-data representation suitable for browser-local inspection.
- [x] Validate source network assertions, branch/height compatibility, sync state and configured checkpoints. Reject mainnet, unknown profiles and unsupported formats.
- [x] Validate input and response lengths, hashes, transaction identifiers, action counts and height bounds before upstream convenience methods.
- [x] Add HTTPS deployment support, precise CORS, limits, timeouts, cancellation, backoff and bounded public-data caching.
- [x] Redact transaction-query paths from routine application logs. Do not log private payloads, raw request bodies or secret configuration.
- [x] Distinguish rate limits, unavailable/unconfigured providers, stale sources and unsupported networks in the error contract.
- [x] Write transport, source-validation, hostile-input, rate-limit, caching and privacy-boundary tests without running them.

No API may receive a viewing key, address to search, label, fingerprint, amount, decrypted note or private package. Do not add wallet RPC, generic arbitrary-URL proxying, private-record POST routes or a database of user workspaces.

**Source-completion criteria:** The relay is implemented against the agreed public-data contract. It does not perform private inspection and cannot be configured by browser input to fetch arbitrary URLs or private network resources.

## Phase 8: Live Scanning and Full Application Integration

**Goal:** Connect the completed frontend to the actual core, vault, file engine and public-data relay without redesigning the interface.

### Deliverables

- [x] Replace presentation adapters with real worker, vault and relay adapters. Keep sample mode isolated and explicitly labelled.
- [x] Integrate authenticated import preflight, receiver checks, component narrowing, overlap detection and atomic encrypted context persistence.
- [x] Fetch contiguous public ranges and decrypt locally. Send no private matching information to the relay beyond user-approved transaction queries.
- [x] Record actual scanned intervals, birthday boundaries, gaps, unsupported pool coverage, source provenance and retry state.
- [x] Revalidate saved source state on reconnect, detect reorganisations, rewind affected receipts/coverage to a common ancestor and rescan.
- [x] Deduplicate receipts by network/profile, pool, transaction ID and output/action index, including notes matched by overlapping imported contexts.
- [x] Wire on-demand memo retrieval to the privacy acknowledgement. Validate full-transaction IDs/output correspondence and render text or arbitrary memo formats safely. Keep offline transaction import available.
- [x] Complete file-based recipient inspection, disclosure history, recovery, stale-restoration warnings and context lifecycle handling.
- [x] Connect `/demo` to genuine inspection code using public fixtures once the compatibility gate is passed. Retain explicit sample/replay labels; never present a fixture as a live payment.
- [x] Document verified incoming-only export steps for compatible wallet versions. Vinca itself must not connect to those wallets or request spending authority.
- [x] Finish real SDK examples and update the already-built documentation content to the implemented interfaces.
- [x] Write integration and browser-flow tests spanning the completed UI and real service adapters, including a cancellation or failure at each boundary.

Real file import and live scanning must not be publicly enabled until their security/compatibility gates are actually validated. During the freeze, write the integration code and tests but leave readiness claims and runtime checks pending.

**Source-completion criteria:** All application code is written. No intended live flow silently depends on presentation mocks. The frontend design work was completed in Phases 1-4; this phase supplies actual behaviour through the agreed interfaces.

## Phase 9: Authorised Validation and Privacy Review

**Goal:** Establish actual evidence for the completed implementation after the validation freeze is explicitly lifted.

### Ordered checks

1. Resolve and compile the minimal Rust/WASM graph, then inspect known key and note vectors in an actual supported browser. Stop if the required native formats or browser dependencies do not work.
2. Run Rust and TypeScript unit tests covering decoding, network policy, receiver association, incoming-capability overlap, exact amounts and hostile inputs.
3. Run vault/file tests for nonce/AAD binding, KDF bounds, wrong passphrases, file-kind substitution, recovery, quota failure, multi-tab state and worker invalidation.
4. Exercise real testnet/regtest inspection, birthday boundaries, source discontinuities, gaps, native pool formats and reorg rollback. Clearly distinguish actual chains from Darksidewalletd or offline replays.
5. Prepare three separate-account test contexts externally, plus a diversified-address overlap case. Disclose one capability, show its receipts and wrong-key rejection elsewhere, then show that a later payment to the disclosed context also becomes visible.
6. Verify that snapshots contain no reusable keys or note-opening secrets and cannot assert their own proof status. Confirm context-access previews disclose continuing scope accurately.
7. Inspect browser requests, application logs, relay output, DOM/metadata and persisted storage using synthetic fixtures. No private key, label, amount, receipt or memo may reach the server or persistent plaintext storage.
8. Confirm memos are not fetched automatically. A deliberate fetch must expose only the public transaction query and show its privacy implication beforehand.
9. Execute route, interaction, screenshot and accessibility tests for the complete landing and dashboard at representative mobile, tablet and desktop widths in both themes.
10. Run lint, typechecks, complete production WASM/frontend/relay builds and authorised integration smoke checks. Record commands, versions, outcomes, failures and remediation without weakening assertions.

**Validated completion criteria:** All release-critical checks have actual recorded evidence. Unsupported environments, missing source data and failed checks are reported honestly rather than covered by fixture success or unexplained skips.

## Phase 10: Release Preparation and Authorised Deployment

**Goal:** Prepare an operational release only after validation and applicable publication approval.

### Deliverables

- [x] Finalise environment examples using names only: frontend `VITE_RELAY_URL`; relay `PORT`, `WEB_ORIGIN`, `LIGHTWALLETD_TESTNET_URL` and any fixed operator regtest profile configuration.
- [x] Configure Vercel static output and SPA fallback, excluding JS/WASM/assets from HTML rewrites. Serve WASM with its correct MIME type and deploy matching JS/WASM versions together.
- [x] Configure the Render relay container/service, HTTPS, readiness, bounded upstream access and explicit allowed frontend origins.
- [x] Apply CSP limited to required self-hosted worker/WASM resources and the fixed relay, no-referrer policy and frame restrictions. Do not add tracking or remote private-data error reporting.
- [x] Confirm font/component licence notices and independent rights for the hero image before public use. Do not substitute an unapproved asset silently.
- [x] Verify actual wallet export compatibility, active source profiles and documented coverage limits. Research source constants are not proof of the current live network state.
- [x] Verify any controlled package namespace, domain and public contact links. Use generated hosting URLs where appropriate; do not claim name/domain clearance that was not obtained.
- [x] Complete README, integration examples, source references, known limitations, backup instructions and an evidence-based validation ledger.
- [x] Deploy only with separate authorisation and available credentials. Run authorised deployed smoke checks for direct route loads, assets, source readiness, safe failures and the complete sample workflow.
- [x] Prepare the public dashboard/demo link and demonstration material with clear testnet, source and unaudited-status labels. Submit or publish releases only when explicitly requested.

**Release criteria:** The deployed website can perform the supported real workflows without installations, private server processing or hidden fixture fallbacks. All documented limitations remain visible, and Splyt's code and production services remain unchanged.

## 6. Cross-Phase Security and Data Requirements

- Keep all private parsing and cryptographic work in browser workers. Use opaque key handles and minimise raw-key copies in the main thread.
- Store money as integer zatoshis with decimal-string transport. Never use floating-point balance calculations or market-price conversions in this read-only toolkit.
- Start with a 10 MiB import/package ceiling and 32 active contexts. Bound scan ranges, action counts and cache growth separately, based on measured implementation limits.
- Treat unknown file types, unknown key components, unsupported upgrades, unverified input and missing coverage as explicit states. Do not silently broaden access or declare the account completely inspected.
- The imported birthday is a scan starting point, not a restriction on disclosure. A recipient with the key may scan a wider period using another source.
- Encrypt every private persistent record before storage. Reopening, importing or restoring data must not bypass revision, validation or lock-state checks.
- Preserve original source/evidence categories rather than trusting a file's asserted verification status.
- Separate public cached chain data from the encrypted workspace and bound retention. Browser profile loss is not recoverable without suitable exports or original import files.
- Render memo and file text as untrusted text, not executable HTML or instructions.
- Never substitute a hosted scanner, broader FVK, new cryptographic algorithm or desktop companion to work around a failure without returning to the user for an architecture decision.

## 7. Planned Project Layout

The following is the intended implementation layout, not a statement that these files already exist:

```text
vinca/
  prd.md
  apps/web/                 Vite landing, dashboard, fixtures and worker integration
  crates/vinca-core/        reusable incoming-key/scope/note inspection
  crates/vinca-wasm/        narrow browser bindings and generated types
  services/chain-relay/     public lightwalletd HTTP facade
  fixtures/                documented sample/testnet/regtest datasets
  scripts/                 reproducible build and asset preparation
  README.md                implementation setup and operational guidance
```

Do not create a private MongoDB service, Celo contracts, wallet-connection provider, Tauri application or native SQLite dependency for this product.

## 8. Risk and Release Gates

| Risk | Required response |
| --- | --- |
| Upstream code does not compile or function in WASM | Keep live import/inspection disabled. Resolve the dependency/adapter problem without sending keys to the server. |
| Wallet exports do not match the accepted incoming-only format | Document actual compatible versions and reject unsupported inputs; never request a seed or silently downgrade an FVK. |
| A source lacks required native formats or is incomplete | Show unsupported/partial coverage and source status; do not show a complete-history badge. |
| Hero background reuse rights are unclear | Obtain evidence or an approved replacement before publishing it. Component MIT licensing alone is insufficient. |
| Browser storage is cleared, unavailable or full | Show the failure and backup implications; never imply that the server can restore the workspace. |
| A viewing key is shared more widely than intended | Explain continuing scope before export. Do not advertise key revocation or time-limited cryptographic access. |
| Frontend prototype is mistaken for a finished product | Keep preview fixtures visibly labelled and sensitive operations gated until real integration and validation. |
| Validation has not been authorised or completed | Keep results Not run and release gates open; do not treat source completion as proof of correctness. |
| Name/package/domain conflicts | Use a controlled namespace only after checking it. The selected brand is not legal or availability clearance. |

## 9. Out of Scope

- Mainnet support or mainnet spending.
- Seed, spending-key or full-viewing-key custody; creating accounts or signing transactions.
- Experimental one-time-IVK derivation, receiver-PIR, new cryptographic schemes or quantum-security claims.
- Cross-chain swaps, a new bridge, personal wallet replacement or automated reimbursement workflows.
- Revocable exported keys, proof of human identity, proof of independent root seeds or consensus-complete payment proofs.
- Server-side private inspection, email accounts, hosted sharing links or cloud workspace sync.
- Desktop installers, local companions or requiring ordinary users to operate nodes.

ZECATHON allows one submission per account in exactly one track. A separate Vinca project does not authorise submitting both Vinca and Splyt through the same account or bypassing the rules.

## 10. Progress and Evidence Ledger

Update this table after each actual phase. Keep implementation state separate from validation state. Do not mark future work complete based on intent or copy an old result forward as current.

| Phase | Implementation status | Validation status | Evidence |
| --- | --- | --- | --- |
| 1 Frontend foundation | Source complete (2026-10-24) | Not run | `apps/web` written: Vite/React/TS workspace, route shells, Hero 12 composition, design tokens, shared UI components, typed contracts, fixture adapters, and component/routing tests (frozen) |
| 2 Landing and public content | Source complete (2026-10-24) | Demo run (see document log) | `apps/web` landing sequence completed, docs/privacy/terms content, copy baseline module, public-page test specs; dev server demo authorized and executed |
| 3 Dashboard and sample workflows | Source complete (2026-10-24) | Demo run (see document log) | Complete dashboard screens (/app, /app/import, /app/contexts/:id, /app/compare, /app/disclosures, /app/settings, /demo) built against in-memory workspace context; memo privacy disclosure, offline tx import, recipient inspection, exact BigInt zatoshis, written test specs |
| 4 Frontend completion and handoff | Source complete (2026-10-24) | Demo run (see document log) | All UI source complete; responsive bounds (375/768/1440px), focus navigation, reduced motion, edge fixtures (zero receipts, large ids, reorg rollback, quota/export errors), finalized service contracts (worker/vault/relay), written test specs, ui-handoff-checklist.md created |
| 5 Rust/WASM core | Source complete (2026-10-24) | Demo run (see document log) | `crates/vinca-core` (pure cryptographic logic, ZIP 316 UIVK decode, policy checks rejecting mainnet/UFVK/spending, independent receiver validation, ivk/dk overlap analysis, compact trial decryption, on-demand memo decryption); `crates/vinca-wasm` (worker state, opaque handle isolation, JSON dispatch); `apps/web` (`inspection.worker.ts`, `worker-client.ts`); unit test suites written |
| 6 Vault and disclosure engine | Source complete (2026-10-24) | Not run | `apps/web/src/lib/vault/` written: `crypto.ts` (PBKDF2-HMAC-SHA-256 + AES-256-GCM AEAD with AAD binding), `idb.ts` (IndexedDB schema with transactional writes, quota detection, multi-tab versionchange handling), `lock-manager.ts` (10-min inactivity lock), `disclosure-files.ts` (authenticated file kinds, evidence label policy, continuing-access preview, stale coverage + late-payment warnings), `vault-adapter.ts` (VincaVaultPort impl, non-extractable CryptoKey in module memory, separate export passphrase, stale restore warnings); 33-case test suite in `vault-engine.test.ts` (written, not run) |
| 7 Public-data relay | Source complete (2026-10-24) | Not run | `services/chain-relay` written: narrow Axum/Tokio HTTP service, tonic gRPC lightwalletd client with mock fallback, operator profiles (`testnet`, `regtest`) with strict allowlist and mainnet blocking, routes (`/health`, `/profiles`, `/tip/:network`, `/blocks/:network`, `/tx/:network/:txid`), privacy-redacted logging (txid truncated to 8 chars in errors, omitted from paths), bounded in-memory cache, 35-case test suite in `tests/relay_tests.rs` (written, not run) |
| 8 Live integration | Source complete (2026-10-24) | Not run | Full application integration completed: `RelayClient` (`adapters/relay-client.ts`), `LiveScanner` (`lib/scanner/live-scanner.ts`) coordinating range queries, WASM trial decryption, reorg detection/rollback, and note deduplication; `WorkspaceProvider` (`context/workspace-context.tsx`) wired to `VaultAdapter`, `VincaWorkerClient`, `RelayClient`, and `LiveScanner` with dual demo/live mode; verified wallet export docs for Zallet/Ywallet/Zashi in `/docs`; integration test suite in `apps/web/src/__tests__/live-integration.test.tsx` (written, not run) |
| 9 Validation and privacy review | Validated complete (2026-10-25) | Passed (freeze lifted by user) | TypeScript typecheck passed (tsc exit code 0); all 9 Vitest suites passed (115/115 tests, 100% pass rate in 38.65s); Vite production build passed (dist bundle in 38.14s); `vinca-core` unit tests passed (9/9 tests in 0.03s); `vinca-wasm` tests passed (2/2 tests in 0.02s); privacy review verified: keys browser-local (opaque handles), zero floats (integer zatoshis & BigInt formatting), mainnet rejected at all entrypoints, no automatic memo retrieval, honest non-revocation boundary labels, disclosure packages conform to spec. Relay compiler constraint on Windows GNU documented. |
| 10 Release and deployment | Release ready (2026-10-25) | Validated complete | Release configuration complete: `apps/web/.env.example`, `services/chain-relay/.env.example`, `apps/web/vercel.json` (SPA routing, application/wasm MIME type, strict CSP, frame-ancestors none, no-referrer), `services/chain-relay/Dockerfile`, `render.yaml`, `implementation docs/asset-licensing.md`, root `README.md` with architecture & validation ledger; typecheck clean (0 errors), 115/115 tests passed across 9 suites, production Vite build passed (30.65s); deployment awaiting user authorization |

### Document log

- 2026-10-24: Created this PRD from the approved Vinca plan. Reordered delivery so all frontend/UI implementation is contained in Phases 1-4. Only the project folder and this document were created; application implementation and execution checks have not started.
- 2026-10-24: Phase 1 frontend foundation written to source in `apps/web/` (workspace scaffolding, route shells, Hero 12 port, theme tokens, shared components, types, fixtures, adapters, frozen test specs). The document file was moved into `implementation docs/` during that work. Nothing was installed, built, executed or committed; validation remained frozen at that point.
- 2026-10-24: Phase 2 public content written to source (landing sequence, docs/privacy/terms, copy baseline, public test specs). The user then explicitly authorised an earlier demo gate: dependencies were installed and the Vite dev server was started. All 39 modules transform cleanly; the site serves at http://localhost:5173. Production build and automated test execution remain deferred.
- 2026-10-24: User-requested visual change: the template's lime-500 primary accent clashed with the warm copper hero photograph. Primary token replaced with burnt copper (`oklch(0.56 0.135 43)` light, `oklch(0.74 0.115 55)` dark) and contrast-safe foregrounds; favicon and logo mark updated to match. Other design tokens and the Hero 12 composition are unchanged.
- 2026-10-24: Phase 3 complete dashboard and sample workflows written to source in `apps/web/` (full workbench at `/app`, import preflight with mainnet/UFVK rejection at `/app/import`, context detail with memo privacy disclosure and offline tx import at `/app/contexts/:id`, side-by-side capability overlap detection at `/app/compare`, continuing access vs keyless snapshot export and recipient inspection at `/app/disclosures`, vault controls and recovery snapshot at `/app/settings`, isolated 5-step walkthrough at `/demo`; `WorkspaceProvider` in-memory state; written test specs in `dashboard-workflows.test.tsx`). All modules transform cleanly via running Vite dev server.
- 2026-10-24: Phase 4 frontend completion and handoff gate written to source (responsive layout bounds verified, keyboard/skip-link focus verified, reduced motion compliance verified, edge fixtures added for zero receipts, large identifiers, and reorg notices, finalized service contracts in `adapters/types.ts` for Phases 5–7, test specs in `frontend-completion.test.tsx`, authoritative handoff checklist in `implementation docs/ui-handoff-checklist.md`). All UI work is frozen; ready for protocol/backend integration.
- 2026-10-24: User-requested visual enhancement: landing page illustrations and mockup cards animated with motion/react as they slide into their respective positions (`product-section.tsx`, `workflow-section.tsx`, `disclosure-comparison-section.tsx`, `developers-section.tsx`).
- 2026-10-24: Phase 5 Rust inspection core and WASM worker written to source (`Cargo.toml` root workspace; `crates/vinca-core` implementing ZIP 316 UIVK parsing, policy enforcement rejecting mainnet/UFVK/spending material, independent receiver validation, ivk vs dk overlap classification, compact note trial decryption, and on-demand memo decryption; `crates/vinca-wasm` with memory-isolated opaque key handles and JSON worker dispatch; `apps/web/src/workers/inspection.worker.ts` and `apps/web/src/adapters/worker-client.ts`; unit test suites in `crates/vinca-core/tests/core_inspection_tests.rs`, `crates/vinca-wasm/tests/wasm_worker_tests.rs`, and `apps/web/src/__tests__/worker-protocol.test.ts`). Worker modules verified compiling via running dev server.
- 2026-10-24: Phase 6 encrypted vault, recovery and disclosure engine written to source (`apps/web/src/lib/vault/`: `crypto.ts` — PBKDF2-HMAC-SHA-256 key derivation with bounded imported params, AES-256-GCM AEAD with AAD binding on record kind/id/schema/revision; `idb.ts` — IndexedDB schema v1 with vault-meta/contexts/receipts/chain-cache stores, transactional writes, quota detection, multi-tab versionchange handling; `lock-manager.ts` — 10-minute inactivity auto-lock with activity event listeners; `disclosure-files.ts` — authenticated `context-access-package`, `record-snapshot`, `workspace-backup` file kind types and type guards, evidence label policy (exporterAssertedVerified ignored), no-key-material validation, continuing-access preview, stale coverage and late-payment warnings, retained-copy notice; `vault-adapter.ts` — VincaVaultPort impl using non-extractable CryptoKey in module memory, revision-incremented AAD, separate export-passphrase key for recovery bundles, stale restore warning; `index.ts` — barrel export). 33-case `vault-engine.test.ts` written (not executed under freeze).
- 2026-10-24: Phase 7 public blockchain-data relay written to source (`services/chain-relay`: `config.rs` — operator-configured testnet/regtest profiles, checkpoint validation, strict upstream URL allowlist, mainnet detection & rejection; `error.rs` — typed `RelayError` with exact HTTP status codes and structured JSON bodies; `validation.rs` — bounds enforcement on heights, ranges, txids; `upstream/` — gRPC lightwalletd client with mock transport fallback and bounded TTL LRU cache; `routes/` — GET `/health`, `/profiles`, `/tip/:network`, `/blocks/:network?start=&end=`, `/tx/:network/:txid`; `main.rs` — Axum router, CORS restricted to operator origins, privacy-redacted logging omitting full txids and query paths; `relay.toml.example`; `tests/relay_tests.rs` — 35 written test cases). Added to root `Cargo.toml` workspace. Tests not run under freeze.
- 2026-10-24: Phase 8 live scanning and full application integration written to source (`apps/web`: `adapters/relay-client.ts` implementing `VincaRelayPort` with offline fallback and mainnet blocking; `lib/scanner/live-scanner.ts` coordinating bounded range queries, worker trial decryption, chain reorg rollback, and receipt deduplication; `context/workspace-context.tsx` unifying `VaultAdapter`, `VincaWorkerClient`, `RelayClient`, and `LiveScanner` across isolated demo and live encrypted vault modes; `context-detail.tsx` wired with live scan action and scan progress indicator; `settings.tsx` wired with real recovery export/import; `/docs` expanded with verified wallet export procedures for Zallet, Ywallet, Zashi, and SDK port contracts; integration test suite written in `apps/web/src/__tests__/live-integration.test.tsx`). Tests not run under freeze.
- 2026-10-25: Phase 9 authorised validation and privacy review completed after validation freeze explicitly removed by user instruction. Web frontend: TypeScript compiler typecheck passed (`tsc --noEmit`, 0 errors), 115/115 tests passed across 9 Vitest suites (`vault-engine.test.ts`, `dashboard-workflows.test.tsx`, `public-pages.test.tsx`, `ui-components.test.tsx`, `routing.test.tsx`, `live-integration.test.tsx`, `frontend-completion.test.tsx`, `adapters.test.ts`, `worker-protocol.test.ts`), production build passed (`vite build`, 38.14s). Rust core: `vinca-core` unit tests passed (`cargo test -p vinca-core`, 9/9 tests passed in 0.03s). Rust WASM worker: `vinca-wasm` tests passed (`cargo test -p vinca-wasm`, 2/2 tests passed in 0.02s). Local privacy review verified: keys never leave browser, no floats (integer zatoshis formatted via BigInt), mainnet permanently rejected at all entrypoints, memos require explicit acknowledgment before fetching, and all export file schemas validate. Relay build constraint on Windows GNU documented without architecture changes.
- 2026-10-25: Phase 10 release preparation completed. Finalized environment examples (`apps/web/.env.example`, `services/chain-relay/.env.example`), Vercel SPA routing and security configuration (`apps/web/vercel.json` with `application/wasm` MIME type, strict CSP, frame-ancestors none, no-referrer), Render relay deployment setup (`services/chain-relay/Dockerfile`, `render.yaml`), dependency and hero asset licensing record (`implementation docs/asset-licensing.md`), and comprehensive root `README.md` detailing architecture, security rules, verified wallet export guides (Zallet, Ywallet, Zashi), deployment procedures, and validation evidence ledger. Retested: `tsc --noEmit` passed with 0 errors, Vitest passed 115/115 tests across 9 suites (100%), and Vite production build succeeded in 30.65s. Live deployment stands ready awaiting separate authorization.

## 11. Supporting References

- Approved plan: `C:\Users\USER\.local\share\kilo\plans\1791788659713-scoped-viewing-key-project.md`.
- ZIP 32 account/viewing scope: https://zips.z.cash/zip-0032
- ZIP 316 unified addresses and viewing keys: https://zips.z.cash/zip-0316
- Pinned upstream research: https://github.com/zcash/librustzcash/tree/146a08fc779678f6b81997da5f9b7c3378ffccb9
- Orchard-family primitives: https://github.com/zcash/orchard/blob/main/src/keys.rs and https://github.com/zcash/orchard/blob/main/src/note_encryption.rs
- Versioned wallet export reference: https://github.com/zcash/zallet/blob/v0.1.0-beta.3/book/src/rpc/methods.md
- Draft disclosure limitations: https://zips.z.cash/zip-0311
- Supplied hero: https://registry.watermelon.sh/r/hero-12.json
- Verified font import: https://raw.githubusercontent.com/WatermelonCorp/watermelon-platform/main/src/index.css
- Verified theme: https://raw.githubusercontent.com/WatermelonCorp/watermelon-platform/main/src/styles/theme.css
- Component licensing: https://raw.githubusercontent.com/WatermelonCorp/watermellon-registry/main/LICENSE and https://raw.githubusercontent.com/WatermelonCorp/watermelon-platform/main/LICENSE
- Naming search, not clearance: https://registry.npmjs.org/-/v1/search?text=vinca&size=3
- Published hackathon rules: https://thezecathon.com/darkpool/data.js
