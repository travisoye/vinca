import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useWorkspace } from "@/context/workspace-context";
import { SAMPLE_PASSPHRASE } from "@/fixtures";
import { Lock, Key, ShieldCheck, AlertCircle } from "lucide-react";

export function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const { phase, unlock, createVault } = useWorkspace();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (phase === "unlocked") {
    return <>{children}</>;
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) {
      setError("Please enter your passphrase.");
      return;
    }
    const ok = await unlock(passphrase);
    if (!ok) {
      setError(`Incorrect passphrase. The sample passphrase is "${SAMPLE_PASSPHRASE}".`);
    } else {
      setError(null);
      setPassphrase("");
    }
  };

  const handleDemoUnlock = async () => {
    setPassphrase(SAMPLE_PASSPHRASE);
    await unlock(SAMPLE_PASSPHRASE);
    setError(null);
  };

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase.length < 4) {
      setError("Passphrase must be at least 4 characters long.");
      return;
    }
    await createVault(passphrase);
    setError(null);
    setPassphrase("");
  };

  return (
    <div className="mx-auto flex w-full max-w-xl min-w-0 flex-col items-center justify-center py-12">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="size-6" />
          </div>
          <CardTitle className="text-2xl">
            {phase === "locked" ? "Workspace is locked" : "Create encrypted workspace"}
          </CardTitle>
          <CardDescription className="text-base">
            {phase === "locked"
              ? "Enter your vault passphrase to inspect viewing contexts and receipts."
              : "Choose a passphrase to encrypt your viewing keys and receipts in your browser."}
          </CardDescription>
        </CardHeader>

        <form onSubmit={phase === "locked" ? handleUnlock : handleCreateVault}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Unlock Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Field
              label="Vault passphrase"
              help={
                phase === "locked"
                  ? `Public demo sample passphrase: ${SAMPLE_PASSPHRASE}`
                  : "Derives local AES-256-GCM vault encryption key via PBKDF2."
              }
            >
              <Input
                type="password"
                placeholder={phase === "locked" ? "Enter passphrase" : "Choose a secure passphrase"}
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  setError(null);
                }}
                autoFocus
              />
            </Field>

            <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheck className="size-4 text-primary" />
                <span>Zero-Knowledge Browser Privacy</span>
              </div>
              <p className="mt-1">
                Your passphrase and viewing keys never leave this device. No server-side account or database is created.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            {phase === "locked" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDemoUnlock}
                  className="w-full sm:w-auto"
                >
                  <Key className="size-4" />
                  Use demo passphrase
                </Button>
                <Button type="submit" variant="default" className="w-full sm:w-auto">
                  Unlock workspace
                </Button>
              </>
            ) : (
              <Button type="submit" variant="default" className="w-full">
                Create browser vault
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
