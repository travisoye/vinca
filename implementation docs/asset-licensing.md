# Vinca — Asset & Dependency Licensing Notice

This document details the licensing, attribution, and copyright provenance of all assets, libraries, fonts, and media integrated into Vinca as required by PRD Phase 10.

---

## 1. Typography

- **Inter Variable Font (`@fontsource-variable/inter`)**
  - **Source:** Rasmus Andersson / Google Fonts / Fontsource
  - **License:** SIL Open Font License (OFL) Version 1.1
  - **Permitted Use:** Web distribution, embedding, bundling, and display.
  - **Reference:** https://openfontlicense.org/

---

## 2. Design System & Frontend Primitives

- **Radix UI Primitives (`@radix-ui/react-*`)**
  - **Copyright:** (c) 2022 WorkOS
  - **License:** MIT License
  - **Packages:** `@radix-ui/react-dialog`, `@radix-ui/react-label`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`

- **Lucide Icons (`lucide-react`)**
  - **Copyright:** (c) 2022 Lucide Contributors
  - **License:** ISC License / MIT License

- **Motion (`motion` / `motion/react`)**
  - **Copyright:** (c) 2020 Framer B.V.
  - **License:** MIT License

- **Tailwind CSS (`tailwindcss` v4)**
  - **Copyright:** (c) Tailwind Labs, Inc.
  - **License:** MIT License

- **Hero 12 Composition Pattern**
  - **Source:** Watermelon Registry (`Hero 12` / `Hero3`)
  - **License:** MIT License
  - **Reference:** https://raw.githubusercontent.com/WatermelonCorp/watermellon-registry/main/LICENSE
  - **Notes:** Adapted to Vite + React 19; Next.js directives removed; PostHog and telemetry scripts excluded; branded tokens mapped to Vinca's burnt-copper design system.

---

## 3. Hero Visual Asset (`hero-3.avif`)

- **Asset URL:** `https://assets.watermelon.sh/hero-3.avif`
- **Current Role:** Cinematic dark aerial landscape rendered behind noise and color gradient overlays in `apps/web/src/components/hero/hero.tsx`.
- **Rights Status:** While the Watermelon registry component code is MIT licensed, independent copyright clearance for this specific external photographic file is **not independently established**.
- **Operational Guidance:**
  - For hackathon demonstration, testnet evaluation, and code review, the remote asset is displayed under fair academic/demonstration use.
  - For commercial production deployment, operators are advised to either confirm licensing with the original photographer or replace line 94 in `apps/web/src/components/hero/hero.tsx` with a verified licensed or public-domain photographic asset.

---

## 4. Rust Core & Workspace Crates

- **`crates/vinca-core`**
  - **License:** MIT OR Apache-2.0
  - **Dependencies:** `bech32` (MIT), `blake2b_simd` (MIT), `sha2` (MIT/Apache-2.0), `subtle` (BSD-3-Clause), `zeroize` (Apache-2.0 OR MIT).

- **`crates/vinca-wasm`**
  - **License:** MIT OR Apache-2.0
  - **Dependencies:** `wasm-bindgen` (MIT/Apache-2.0), `vinca-core` (MIT/Apache-2.0).

- **`services/chain-relay`**
  - **License:** MIT OR Apache-2.0
  - **Dependencies:** `tokio` (MIT), `axum` (MIT), `tower` (MIT), `tonic` (MIT), `prost` (Apache-2.0), `moka` (MIT/Apache-2.0).

---

## 5. Summary & Compliance Statement

All code, typography, icons, and interface libraries in Vinca are distributed under standard open-source licenses (MIT, Apache-2.0, ISC, SIL OFL 1.1). No proprietary or restricted fonts or tracking SDKs are bundled. The hero background asset is documented with clear attribution and replacement instructions.
