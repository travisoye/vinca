import type { ReactNode } from "react";

/**
 * WorkspaceGate — Transparent pass-through.
 * Lock/unlock feature has been removed per user instruction.
 */
export function WorkspaceGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
