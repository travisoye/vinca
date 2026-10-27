# Memo End-to-End Execution Plan

Source of truth: [1793028772984-memo-end-to-end-fix.md](./1793028772984-memo-end-to-end-fix.md).

This checklist tracks execution separately from implementation claims. Existing
uncommitted source changes are preserved and reviewed in place.

## Work sequence

1. [ ] Audit current implementation and tests against the source plan; retain
   only scoped work and identify concrete gaps.
2. [ ] Update focused frontend tests for the typed memo API, offline import,
   format-specific display, persistence failures, cached display, and stale
   request suppression.
3. [ ] Close Rust/core/WASM and relay test gaps with the plan's synthetic
   fixtures; never represent them as live payment or consensus evidence.
4. [ ] Run authorized focused tests and builds using the existing locked
   dependencies and available toolchain. Install only tools proven necessary
   by a failed focused command and authorized by the user.
5. [ ] Verify the actual generated worker/WASM API and the browser memo flow
   with synthetic fixtures when compatible tooling is available.
6. [ ] Update the README, PRD ledger, and project context with exact source and
   validation evidence. Leave hosted rollout incomplete unless deployment and
   publication are separately authorized and verified.

## Current execution state

- [x] Plan established from the existing memo-fix source plan.
- [ ] Audit and implementation complete.
- [ ] Focused validation complete.
- [ ] Browser validation complete.
- [ ] Hosted rollout complete.

## Constraints

- Keep decryption local and memo fetching explicit; offline import makes no
  relay request.
- Do not access user secrets, query the user's transaction, use mainnet, or
  imply fixture evidence is live-chain verification.
- No commit, push, publication, or deployment is authorized by this plan.
- Report any missing compiler, browser, or credential gate honestly.
