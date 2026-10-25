# AGENTS.md — Vinca

**Read this before touching anything.** This repository is a hackathon project
built strictly in ordered phases. Every agent (or human) session must begin by
reading the two authoritative documents below, in this order:

1. **`implementation docs/projectcontext.md`** — current state, phase log,
   session-survival context, validation-freeze exceptions, environment actuals.
2. **`implementation docs/prd.md`** — authoritative product requirements,
   phase order, boundaries, copy baselines, completion criteria.
3. **`implementation docs/ui-handoff-checklist.md`** — frontend completion and
   handoff gate record for protocol integration.
4. **`implementation docs/asset-licensing.md`** — asset and dependency licensing
   attribution, fonts, and hero image provenance.
5. **`README.md`** — root project guide, architecture, developer workflows, and
   validation ledger.

If you have just been compacted or resumed: re-read both files before acting.
Do not rely on remembered summaries; the files are the source of truth.

When new important markdown documents appear, add them to this list in the same
commit/change that introduces them.

---

## Non-negotiable rules

- **UI first.** Phases 1–4 complete the entire frontend before protocol, vault or
  relay work (phases 5–8). Do not redesign the dashboard during integration.
- **Validation freeze.** Do not run tests, typecheck, lint, builds, watchers or
  installs unless the user explicitly authorises it. (The only standing
  exception is recorded in `projectcontext.md` §5.1: a user-authorised demo run
  of the Vite dev server at http://localhost:5173.)
- **No git init, commits, deployment, package publication, secret-file access
  or mainnet use** without separate explicit authorisation.
- **Splyt is out of bounds.** Never read, copy or modify Splyt code, data, deps,
  env files or workflow.
- **No fake verification.** Every sample state is labelled; totals are never
  called balances; fixtures never get live-chain badges; mocked exports are
  never presented as protocol results.
- **Keys never leave the browser** and never enter route paths, query params,
  document titles, telemetry or general React state. Use opaque handles later.
- **Money is exact:** integer zatoshis transported as decimal strings and
  formatted with BigInt (`apps/web/src/lib/format.ts`). Never floats.
- **Disclosure honesty:** no revocation claims, filters are not cryptographic
  restrictions, snapshots are not payment proof, evidence is labelled locally.
- Do not silently change architecture to work around a blocker. Return to the
  user with the constraint.

## Where things live

```
vinca/
  AGENTS.md                       this file (agent onboarding + rules)
  implementation docs/
    prd.md                        authoritative PRD and phase ledger
    projectcontext.md             live state, phase log, freeze exceptions
    ui-handoff-checklist.md       frontend completion & handoff record
  apps/web/                       Vite + React + TS frontend (phases 1–4)
    src/
      types/                      presentation contracts
      fixtures/                   deterministic sample data
      adapters/                   port interfaces + fixture implementations
      components/ui/              design-system primitives
      components/landing/         landing sections
      components/layout/          public + dashboard layouts
      components/dashboard/       dashboard dialogs & package inspector
      routes/                     public and /app route shells
      lib/                        copy baseline, formatting, utils
      __tests__/                  written test specs (do not execute unless authorised)
```

Planned but not yet created: `crates/vinca-core`, `crates/vinca-wasm`,
`services/chain-relay`, `fixtures/`, `scripts/`, root `README.md`.

## Current status

- Phase 1 (frontend foundation): source complete.
- Phase 2 (landing + public content): source complete.
- Phase 3 (dashboard + sample workflows): source complete.
- Phase 4 (frontend completion & handoff gate): **source complete**.
- Phase 5 (Rust core + WASM worker): **next**.
- Validation: only the authorised demo run has executed (module compile checks
  via the dev server). Tests, typecheck and production build have not run.

## Work protocol

1. Read the two documents above; confirm the validation-freeze status.
2. Work only on the first phase marked not started in the PRD, in its documented
   order.
3. Write tests for every phase, but do not execute them while frozen.
4. At the end of a phase, update **both**:
   - `prd.md`: phase checkboxes, §10 ledger row, document log entry.
   - `projectcontext.md`: "Last updated", status table, append the phase entry.
5. Keep `projectcontext.md` factual and current enough that a fresh session can
   resume from it alone.
