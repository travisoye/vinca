/*
  vault/index.ts — Public barrel for the vault module.

  Import from this file rather than the individual vault sub-modules.
*/

export * from "./crypto";
export * from "./disclosure-files";
export * from "./idb";
export { getVaultAdapter, preloadVaultDb, VaultAdapter } from "./vault-adapter";
