import type { ReactNode } from "react";
import { useWorkspace } from "@/context/workspace-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Storage readiness only. There is no authentication or workspace passphrase. */
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { storageStatus, storageError } = useWorkspace();
  if (storageStatus === "opening") {
    return <p role="status" className="py-8 text-sm text-muted-foreground">Opening local workspace...</p>;
  }
  if (storageStatus === "error") {
    return (
      <Alert variant="destructive">
        <AlertTitle>Local storage unavailable</AlertTitle>
        <AlertDescription>
          <p>{storageError} Existing encrypted data has not been replaced.</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry opening workspace
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return <>{children}</>;
}
