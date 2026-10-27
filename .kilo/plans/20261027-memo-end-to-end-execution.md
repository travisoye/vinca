# Memo End-to-End Execution Plan

Source of truth: [1793028772984-memo-end-to-end-fix.md](./1793028772984-memo-end-to-end-fix.md).

This checklist tracks execution separately from implementation claims. Existing
uncommitted source changes are preserved and reviewed in place.

## Work sequence

1. [x] Audit current implementation and tests against the source plan; retain
   only scoped work and identify concrete gaps.
2. [x] Update focused frontend tests for the typed memo API, offline import,
   format-specific display, persistence failures, cached display, and stale
   request suppression.
3. [ ] Close remaining relay test gaps; 52 relay tests pass, but the plan's
   local gRPC-stub `/tx` route exercise is still outstanding. Core/WASM memo
   tests use synthetic fixtures, not live-payment or consensus evidence.
4. [x] Run authorized focused tests and builds using the existing locked
   dependencies and available toolchain. Install only tools proven necessary
   by a failed focused command and authorized by the user.
5. [ ] Verify the actual generated worker/WASM API and the browser memo flow
   with synthetic fixtures when compatible tooling is available. The generated
   WASM export was invoked successfully in Node, and synthetic UIVK import
   succeeded in-browser; hosted relay CORS blocked the browser memo request.
6. [x] Update the README, PRD ledger, and project context with exact source and
   validation evidence. Leave hosted rollout incomplete unless deployment and
   publication are separately authorized and verified.

## Current execution state

- [x] Plan established from the existing memo-fix source plan.
- [x] Audit and implementation complete.
- [x] Focused validation complete.
- [ ] Browser validation complete.
- [ ] Hosted rollout complete.

## Validation evidence and remaining gates

- Passed: Rust core (31), WASM worker API (5), chain relay (52), focused
  frontend suites (79), frontend typecheck, wasm32 target check, WASM package
  regeneration, synthetic generated-export invocation, and production build.
- The generated memo export was invoked with a synthetic UIVK and encrypted
  transaction. Fixtures are not consensus-valid, mined, or live-chain
  evidence. No user key or transaction was used.
- Local browser UIVK import succeeded, but hosted relay CORS blocked `/ready`
  from localhost, so no browser memo fetch/view/persistence flow was completed.
- The Render image build failed because `vendor/zcash_transparent` was absent
  from the Docker context. `services/chain-relay/Dockerfile` now copies
  `vendor/`; local Docker image verification could not run because Docker
  Desktop's Linux engine was unavailable.
- Still open: local gRPC-stub test of the relay `/tx` route, browser memo
  verification, Docker image/Render rebuild, and hosted rollout. No deploy,
  push, or commit was performed.

## Constraints

- Keep decryption local and memo fetching explicit; offline import makes no
  relay request.
- Do not access user secrets, query the user's transaction, use mainnet, or
  imply fixture evidence is live-chain verification.
- No commit, push, publication, or deployment is authorized by this plan.
- Report any missing compiler, browser, or credential gate honestly.
