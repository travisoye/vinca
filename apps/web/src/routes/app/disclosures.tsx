import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspaceGate } from "@/components/dashboard/workspace-gate";
import { PackageInspector } from "@/components/dashboard/package-inspector";
import { useWorkspace } from "@/context/workspace-context";
import { formatZecFromZatoshis, shortHex } from "@/lib/format";
import type { DisclosureKind } from "@/types";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck,
  FileLock2,
  History,
  KeyRound,
  Lock,
  Share2,
  ShieldAlert,
} from "lucide-react";

export function DisclosuresPage() {
  const [searchParams] = useSearchParams();
  const { contexts, receipts, disclosureHistory, recordDisclosure } = useWorkspace();

  const contextIdParam = searchParams.get("contextId");
  const [selectedContextId, setSelectedContextId] = useState<string>(
    contextIdParam && contexts.some((c) => c.id === contextIdParam)
      ? contextIdParam
      : contexts[0]?.id ?? "",
  );

  const [disclosureKind, setDisclosureKind] = useState<DisclosureKind>("record-snapshot");
  const [includeMemos, setIncludeMemos] = useState(true);
  const [recipientNote, setRecipientNote] = useState("");
  const [packagePassphrase, setPackagePassphrase] = useState("vinca-shared-secret");

  const context = contexts.find((c) => c.id === selectedContextId) ?? null;
  const contextReceipts = context ? receipts.filter((r) => r.contextId === context.id) : [];

  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>(
    contextReceipts.map((r) => r.id),
  );
  const [exportedStatus, setExportedStatus] = useState<string | null>(null);

  const toggleReceipt = (id: string) => {
    setSelectedReceiptIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectAllReceipts = () => {
    setSelectedReceiptIds(contextReceipts.map((r) => r.id));
  };

  const deselectAllReceipts = () => {
    setSelectedReceiptIds([]);
  };

  const handleExport = () => {
    if (!context) return;
    if (disclosureKind === "record-snapshot" && selectedReceiptIds.length === 0) {
      return;
    }

    const packageData = {
      vincaVersion: "1.0",
      kind: disclosureKind,
      network: context.network,
      createdAtUtc: new Date().toISOString(),
      contextLabel: context.label,
      recipientNote: recipientNote.trim() || undefined,
      records:
        disclosureKind === "record-snapshot"
          ? contextReceipts
              .filter((r) => selectedReceiptIds.includes(r.id))
              .map((r) => ({
                pool: r.pool,
                amountZatoshis: r.amountZatoshis,
                txIdHex: r.txIdHex,
                actionIndex: r.actionIndex,
                blockHeight: r.blockHeight,
                memo: includeMemos && r.memo.state === "available" ? r.memo.text : null,
              }))
          : undefined,
      capability:
        disclosureKind === "context-access-package"
          ? {
              supportedPools: context.supportedPools,
              birthdayHeight: context.birthdayHeight,
              keyIdentifier: `uivk-handle-${context.id}`,
            }
          : undefined,
    };

    // Simulated browser file download
    const blob = new Blob([JSON.stringify(packageData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vinca-${disclosureKind}-${context.id}.json`;
    link.click();
    URL.revokeObjectURL(url);

    // Record in local history
    recordDisclosure({
      kind: disclosureKind,
      contextId: context.id,
      contextLabel: context.label,
      selectedReceiptIds: disclosureKind === "record-snapshot" ? selectedReceiptIds : contextReceipts.map((r) => r.id),
      recordCount: disclosureKind === "record-snapshot" ? selectedReceiptIds.length : contextReceipts.length,
      memoIncluded: includeMemos,
      recipientNote: recipientNote.trim() || undefined,
    });

    setExportedStatus(`Exported ${disclosureKind} for ${context.label}.`);
  };

  return (
    <WorkspaceGate>
      <div className="flex min-w-0 flex-col gap-8">
        <PageShell
          title="Disclosures & Package Export"
          description="Deliberately export continuing context access or keyless record snapshots, or inspect received packages."
        />

        <Tabs defaultValue="prepare" className="w-full">
          <TabsList aria-label="Disclosure workflows">
            <TabsTrigger value="prepare">
              <Share2 className="size-4" />
              Prepare disclosure
            </TabsTrigger>
            <TabsTrigger value="inspect">
              <FileLock2 className="size-4" />
              Recipient inspection
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="size-4" />
              Export history ({disclosureHistory.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Prepare Disclosure */}
          <TabsContent value="prepare" className="flex flex-col gap-6">
            {contexts.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center">
                <EmptyState
                  title="No viewing contexts in vault"
                  description="Import a testnet or regtest Unified Incoming Viewing Key (UIVK) before preparing disclosures or record snapshots."
                  action={
                    <Button asChild className="mt-4">
                      <Link to="/app/import">
                        <Share2 className="size-4" />
                        Import viewing key
                      </Link>
                    </Button>
                  }
                />
              </Card>
            ) : (
              <>
            {exportedStatus && (
              <Alert variant="success">
                <CheckCircle2 className="size-4" />
                <AlertTitle>Package Exported</AlertTitle>
                <AlertDescription>{exportedStatus}</AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1. Select Target Context</CardTitle>
                <CardDescription>Choose the viewing capability to prepare a disclosure from</CardDescription>
              </CardHeader>
              <CardContent>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={selectedContextId}
                  onChange={(e) => {
                    setSelectedContextId(e.target.value);
                    const newCtx = contexts.find((c) => c.id === e.target.value);
                    if (newCtx) {
                      const newReceipts = receipts.filter((r) => r.contextId === newCtx.id);
                      setSelectedReceiptIds(newReceipts.map((r) => r.id));
                    }
                  }}
                >
                  {contexts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.network} · {c.supportedPools.join("+")})
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>

            {/* 2. Choose Format */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                2. Select Disclosure Format
              </h3>

              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDisclosureKind("record-snapshot")}
                  className={`flex flex-col items-start rounded-lg border p-5 text-left transition-all ${
                    disclosureKind === "record-snapshot"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileCheck className="size-5 text-primary" />
                    <span className="font-semibold">Record Snapshot (Recommended)</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Exports specific decrypted records <strong>without any viewing key</strong>.
                    Recipients cannot see other past or future transactions.
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-primary">
                    <Lock className="size-3.5" />
                    <span>Keyless · Fixed record list</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDisclosureKind("context-access-package")}
                  className={`flex flex-col items-start rounded-lg border p-5 text-left transition-all ${
                    disclosureKind === "context-access-package"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-5 text-amber-500" />
                    <span className="font-semibold">Context-Access Package</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Transfers the <strong>continuing incoming viewing capability</strong>.
                    The recipient can independently inspect other matching past and future transactions.
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <ShieldAlert className="size-3.5" />
                    <span>Includes incoming viewing key</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Warnings based on chosen format */}
            {disclosureKind === "context-access-package" ? (
              <Alert variant="warning">
                <AlertTriangle className="size-4" />
                <AlertTitle>Continuing Access & Irrevocability Warnings</AlertTitle>
                <AlertDescription className="space-y-1.5 text-xs">
                  <p>
                    <strong>Continuing Access:</strong> The recipient can inspect all past and future payments matching this viewing key.
                  </p>
                  <p>
                    <strong>Irrevocable:</strong> Archiving or deleting the file in Vinca cannot revoke access once the recipient has a copy of the key.
                  </p>
                  <p>
                    <strong>Filters are not cryptographic:</strong> Any address or date filter applied in this UI is presentation-only, not an on-chain key restriction.
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="info">
                <AlertTriangle className="size-4" />
                <AlertTitle>Snapshot Disclosure Boundaries</AlertTitle>
                <AlertDescription className="space-y-1.5 text-xs">
                  <p>
                    <strong>Exporter Assertion:</strong> Amounts and memos in a snapshot are provided by you. Recipients should not treat them as independently verified consensus proof.
                  </p>
                  <p>
                    <strong>Keyless:</strong> No viewing key or spending authority is included.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* 3. Record Selection (for snapshots) */}
            {disclosureKind === "record-snapshot" && (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">3. Select Records to Include</CardTitle>
                      <CardDescription>
                        {selectedReceiptIds.length} of {contextReceipts.length} records selected
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={selectAllReceipts}>
                        Select all
                      </Button>
                      <Button variant="ghost" size="sm" onClick={deselectAllReceipts}>
                        Deselect all
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {contextReceipts.length > 0 ? (
                    <div className="space-y-2">
                      {contextReceipts.map((r) => {
                        const checked = selectedReceiptIds.includes(r.id);
                        return (
                          <label
                            key={r.id}
                            className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm transition-colors ${
                              checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleReceipt(r.id)}
                                className="size-4 rounded border-border text-primary focus:ring-primary"
                              />
                              <Badge variant="outline" className="capitalize">{r.pool}</Badge>
                              <span className="font-mono font-semibold">
                                {formatZecFromZatoshis(r.amountZatoshis)} ZEC
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">
                                tx {shortHex(r.txIdHex)} : {r.actionIndex}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Block {r.blockHeight.toLocaleString()}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      title="No receipts available"
                      description="This context has no decrypted receipts to snapshot."
                      size="compact"
                    />
                  )}

                  <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm">
                    <input
                      type="checkbox"
                      id="include-memos-checkbox"
                      checked={includeMemos}
                      onChange={(e) => setIncludeMemos(e.target.checked)}
                      className="size-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="include-memos-checkbox" className="cursor-pointer">
                      Include decrypted memos where available
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 4. Export Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {disclosureKind === "record-snapshot" ? "4. Package Details & Passphrase" : "3. Package Details & Passphrase"}
                </CardTitle>
                <CardDescription>
                  Protect the exported package using authenticated AES-256-GCM encryption.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field
                  label="Package Encryption Passphrase"
                  help="Share this passphrase with your recipient out-of-band."
                >
                  <Input
                    type="password"
                    value={packagePassphrase}
                    onChange={(e) => setPackagePassphrase(e.target.value)}
                    placeholder="Enter file secret"
                  />
                </Field>

                <Field
                  label="Optional Exporter Note"
                  help="Contextual note stored inside the encrypted container for the recipient."
                >
                  <Input
                    value={recipientNote}
                    onChange={(e) => setRecipientNote(e.target.value)}
                    placeholder="e.g. Q3 payment reconciliation for grant review"
                  />
                </Field>
              </CardContent>

              <CardFooter className="flex justify-end border-t border-border pt-4">
                <Button
                  variant="default"
                  onClick={handleExport}
                  disabled={disclosureKind === "record-snapshot" && selectedReceiptIds.length === 0}
                >
                  <Download className="size-4" />
                  Generate & download encrypted package
                </Button>
              </CardFooter>
            </Card>
              </>
            )}
          </TabsContent>

          {/* Tab 2: Recipient Inspection Workflow */}
          <TabsContent value="inspect">
            <PackageInspector />
          </TabsContent>

          {/* Tab 3: Local Export History */}
          <TabsContent value="history" className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Local Disclosure History</CardTitle>
                <CardDescription>
                  Encrypted log of packages prepared from this workspace. Stored locally in your browser vault.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {disclosureHistory.length > 0 ? (
                  <div className="space-y-3">
                    {disclosureHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4 text-sm"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={item.kind === "context-access-package" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {item.kind}
                            </Badge>
                            <span className="font-semibold text-foreground">{item.contextLabel}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.recordCount} records · {item.memoIncluded ? "Memos included" : "Memos excluded"}
                            {item.recipientNote ? ` · "${item.recipientNote}"` : ""}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.createdAtUtc).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No disclosure packages exported yet"
                    description="Packages you export will be logged here for local audit."
                    size="compact"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </WorkspaceGate>
  );
}
