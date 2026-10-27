import { useCallback, useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkspaceGate } from "@/components/dashboard/workspace-gate";
import { useWorkspace } from "@/context/workspace-context";
import { getRelayClient } from "@/adapters/relay-client";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  RefreshCw,
  Server,
  Trash2,
  Upload,
} from "lucide-react";

export function SettingsPage() {
  const {
    resetWorkspace,
    storageStats,
    exportRecoveryBackup,
    importRecoveryBackup,
  } = useWorkspace();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [recoveryExported, setRecoveryExported] = useState(false);
  const [recoveryImportSuccess, setRecoveryImportSuccess] = useState(false);
  const [recoveryPassphrase, setRecoveryPassphrase] = useState("vinca-recovery-key");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [selectedBackupFileName, setSelectedBackupFileName] = useState<string | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const [relayReport, setRelayReport] = useState<{
    status: string;
    upstream: string;
    tipHeight: number | null;
    latencyMs: number | null;
    isChecking: boolean;
  }>({
    status: "checking",
    upstream: "https://testnet.zec.rocks:443",
    tipHeight: null,
    latencyMs: null,
    isChecking: false,
  });

  const checkRelayConnection = useCallback(async () => {
    setRelayReport((prev) => ({ ...prev, isChecking: true }));
    const relay = getRelayClient();
    try {
      const health = await relay.checkHealth();
      const tip = await relay.getTipHeight("testnet").catch(() => null);
      setRelayReport({
        status: health.status === "connected" ? "connected" : health.status === "degraded" ? "degraded" : "offline",
        upstream: "https://testnet.zec.rocks:443",
        tipHeight: tip,
        latencyMs: health.latencyMs,
        isChecking: false,
      });
    } catch {
      setRelayReport((prev) => ({ ...prev, status: "offline", isChecking: false }));
    }
  }, []);

  useEffect(() => {
    void checkRelayConnection();
  }, [checkRelayConnection]);

  const handleExportRecovery = async () => {
    try {
      const bundle = await exportRecoveryBackup(recoveryPassphrase);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vinca-recovery-backup-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setRecoveryExported(true);
      setTimeout(() => setRecoveryExported(false), 8000);
    } catch {
      // Failed export
    }
  };

  const processBackupFile = async (file: File) => {
    try {
      setSelectedBackupFileName(file.name);
      const rawText = await file.text();
      const parsedBundle = JSON.parse(rawText);
      const result = await importRecoveryBackup(parsedBundle, importPassphrase || recoveryPassphrase);
      setRestoreMessage(
        `Restored ${result.restoredContextsCount} contexts and ${result.restoredReceiptsCount} receipts from ${file.name}. Stale coverage warning: ${result.staleCoverageWarning ? "active" : "none"}.`,
      );
      setRecoveryImportSuccess(true);
      setTimeout(() => setRecoveryImportSuccess(false), 8000);
    } catch {
      setRestoreMessage("Recovery restore failed: invalid backup file or incorrect passphrase.");
      setRecoveryImportSuccess(true);
    }
  };

  const handleBackupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processBackupFile(file);
    }
  };

  const handleImportRecovery = () => {
    backupFileInputRef.current?.click();
  };

  const handleConfirmReset = () => {
    resetWorkspace();
    setResetDialogOpen(false);
  };

  return (
    <WorkspaceGate>
      <div className="flex min-w-0 flex-col gap-8">
        <PageShell
          title="Vault settings & recovery"
          description="Manage workspace diagnostics, configure public relay connections, and export encrypted recovery snapshots."
        />

        <div className="grid gap-6 md:grid-cols-2">

          {/* Storage Diagnostics */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HardDrive className="size-5 text-primary" />
                <CardTitle className="text-base">Local Storage Diagnostics</CardTitle>
              </div>
              <CardDescription>
                Browser storage footprint in IndexedDB
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Active Contexts:</span>
                <span className="font-medium">{storageStats.activeContexts}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Archived Contexts:</span>
                <span className="font-medium">{storageStats.archivedContexts}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Stored Receipts:</span>
                <span className="font-medium">{storageStats.totalReceipts} notes</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Cached Public Chain Data:</span>
                <span className="font-mono text-xs">{(storageStats.cachedChainBytes / 1_000_000).toFixed(2)} MB</span>
              </div>
              <div className="flex justify-between pt-1 text-xs text-muted-foreground">
                <span>Storage Engine:</span>
                <span className="font-medium text-foreground">Browser IndexedDB (AES-256-GCM encrypted)</span>
              </div>
            </CardContent>
          </Card>

          {/* Public Chain Relay Diagnostics */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="size-5 text-primary" />
                  <CardTitle className="text-base">Public Chain Relay</CardTitle>
                </div>
                <Badge
                  variant={
                    relayReport.status === "connected"
                      ? "secondary"
                      : relayReport.status === "degraded"
                      ? "outline"
                      : "muted"
                  }
                >
                  {relayReport.status === "connected"
                    ? "Live Connected"
                    : relayReport.status === "degraded"
                    ? "Degraded"
                    : relayReport.status === "checking"
                    ? "Checking..."
                    : "Offline Fallback"}
                </Badge>
              </div>
              <CardDescription>
                Public unauthenticated relay connection to Zcash testnet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Relay Service:</span>
                <span className="font-mono text-xs font-medium">https://vinca-relay.onrender.com</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Upstream Node:</span>
                <span className="font-mono text-xs font-medium">{relayReport.upstream}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Network & Pools:</span>
                <span className="font-medium">Testnet (Orchard, Ironwood)</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Current Testnet Tip:</span>
                <span className="font-mono text-xs font-semibold text-primary">
                  {relayReport.tipHeight !== null ? `#${relayReport.tipHeight.toLocaleString()}` : "Querying..."}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  {relayReport.latencyMs !== null ? `Latency: ${relayReport.latencyMs}ms` : "Zero keys or addresses transmitted"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={relayReport.isChecking}
                  onClick={checkRelayConnection}
                  className="h-7 text-xs"
                >
                  <RefreshCw className={`mr-1 size-3.5 ${relayReport.isChecking ? "animate-spin" : ""}`} />
                  Test relay
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recovery Export & Import */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="size-5 text-primary" />
              <CardTitle className="text-lg">Encrypted Workspace Recovery Snapshot</CardTitle>
            </div>
            <CardDescription>
              Export an encrypted backup file to restore your viewing contexts and receipts on another machine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Alert variant="warning">
              <AlertTriangle className="size-4" />
              <AlertTitle>Recovery Scope Limitations</AlertTitle>
              <AlertDescription className="space-y-1 text-xs">
                <p>
                  <strong>No spending authority:</strong> A Vinca recovery export restores only read-only viewing keys and local receipt history. It cannot recover your wallet seed or spend funds.
                </p>
                <p>
                  <strong>Stale after restore:</strong> Restored coverage is stale until refreshed against the chain. Older backups do not discover subsequently imported contexts automatically.
                </p>
              </AlertDescription>
            </Alert>

            {recoveryExported && (
              <Alert variant="success">
                <CheckCircle2 className="size-4" />
                <AlertTitle>Backup Snapshot Created</AlertTitle>
                <AlertDescription>
                  Your encrypted recovery snapshot has been downloaded. Keep this file and its passphrase safe.
                </AlertDescription>
              </Alert>
            )}

            {recoveryImportSuccess && (
              <Alert variant="success">
                <CheckCircle2 className="size-4" />
                <AlertTitle>Recovery Import Result</AlertTitle>
                <AlertDescription>
                  {restoreMessage ?? "Recovery snapshot processed successfully. Workspace contexts updated."}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-border p-4">
                <h4 className="font-medium">Export Recovery File</h4>
                <p className="text-xs text-muted-foreground">
                  Encrypts your entire local viewing inventory into a portable JSON package.
                </p>
                <Field
                  label="Recovery Passphrase"
                  help="Used to derive the backup encryption key."
                >
                  <Input
                    type="password"
                    value={recoveryPassphrase}
                    onChange={(e) => setRecoveryPassphrase(e.target.value)}
                  />
                </Field>
                <Button variant="default" onClick={handleExportRecovery} className="w-full">
                  <Download className="size-4" />
                  Download recovery file
                </Button>
              </div>

              <div className="space-y-3 rounded-lg border border-border p-4">
                <h4 className="font-medium">Import Recovery File</h4>
                <p className="text-xs text-muted-foreground">
                  Restore contexts and receipts from a previously exported recovery backup.
                </p>
                <input
                  type="file"
                  ref={backupFileInputRef}
                  onChange={handleBackupFileChange}
                  accept=".json"
                  className="hidden"
                />
                <Field
                  label="Backup File Secret"
                  help="Passphrase chosen when the backup was created."
                >
                  <Input
                    type="password"
                    placeholder="Enter backup passphrase"
                    value={importPassphrase}
                    onChange={(e) => setImportPassphrase(e.target.value)}
                  />
                </Field>
                {selectedBackupFileName && (
                  <p className="text-xs text-primary font-medium">
                    Loaded: {selectedBackupFileName}
                  </p>
                )}
                <Button variant="outline" onClick={handleImportRecovery} className="w-full">
                  <Upload className="size-4" />
                  Select & restore recovery file
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Source Settings & Reset */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Source Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Server className="size-5 text-primary" />
                <CardTitle className="text-base">Network & Relay Configuration</CardTitle>
              </div>
              <CardDescription>Public data relay endpoints for compact chain blocks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Active Relay:</span>
                <span className="font-mono text-xs">Vinca Public Relay (Testnet/Regtest)</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Mainnet Policy:</span>
                <Badge variant="destructive" className="text-xs">Permanently Blocked</Badge>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-muted-foreground">Relay Connection:</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Ready / Standby
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Reset Workspace */}
          <Card className="border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <Trash2 className="size-5" />
                <CardTitle className="text-base">Reset Local Workspace</CardTitle>
              </div>
              <CardDescription>
                Clear all browser-local viewing keys, decrypted receipts, and export history.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs leading-relaxed text-muted-foreground">
              Resetting will clear your IndexedDB vault and return the workspace to a fresh state. This cannot be undone.
            </CardContent>
            <CardFooter className="flex flex-col gap-2 border-t border-border pt-4">
              <Button
                variant="destructive"
                onClick={() => setResetDialogOpen(true)}
                className="w-full"
              >
                Reset workspace
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Reset Confirmation Dialog */}
        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" />
                <DialogTitle>Reset Local Workspace?</DialogTitle>
              </div>
              <DialogDescription>
                This will reset your local session, erase all added contexts and decrypted receipts, and clear the local IndexedDB vault.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmReset}>
                Confirm reset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </WorkspaceGate>
  );
}
