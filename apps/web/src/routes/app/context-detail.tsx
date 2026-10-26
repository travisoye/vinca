import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspaceGate } from "@/components/dashboard/workspace-gate";
import {
  ArchiveContextDialog,
  DeleteContextDialog,
  UnsupportedComponentsDialog,
} from "@/components/dashboard/context-dialogs";
import { MemoPrivacyDialog, OfflineMemoImportDialog } from "@/components/dashboard/memo-dialog";
import { useWorkspace } from "@/context/workspace-context";
import { formatZecFromZatoshis, shortHex, sumZatoshis } from "@/lib/format";
import type { Receipt } from "@/types";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Clock,
  FileCheck,
  FileText,
  KeyRound,
  MessageSquare,
  RefreshCw,
  Scale,
  Share2,
  Trash2,
} from "lucide-react";

export function ContextDetailPage() {
  const { contextId } = useParams<{ contextId: string }>();
  const navigate = useNavigate();
  const {
    contexts,
    receipts,
    archiveContext,
    unarchiveContext,
    deleteContext,
    scanContext,
    isScanning,
    scanProgress,
    requestMemo,
    importOfflineMemo,
  } = useWorkspace();

  const context = contexts.find((c) => c.id === contextId);
  const contextReceipts = receipts.filter((r) => r.contextId === contextId);

  // Dialog states
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [unsupportedOpen, setUnsupportedOpen] = useState(false);
  const [memoDialogOpen, setMemoDialogOpen] = useState(false);
  const [offlineImportOpen, setOfflineImportOpen] = useState(false);
  const [activeReceiptForMemo, setActiveReceiptForMemo] = useState<Receipt | null>(null);
  const [viewingMemoText, setViewingMemoText] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!context) return;
    setScanError(null);
    try {
      await scanContext(context.id);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "The scan could not be completed.");
    }
  };

  if (!context) {
    return (
      <WorkspaceGate>
        <div className="flex min-w-0 flex-col gap-6">
          <EmptyState
            title="Context not found"
            description="The requested viewing context does not exist in this browser vault."
          >
            <Button asChild variant="outline">
              <Link to="/app">Return to overview</Link>
            </Button>
          </EmptyState>
        </div>
      </WorkspaceGate>
    );
  }

  const isArchived = context.status === "archived";
  const totalZatoshis = sumZatoshis(contextReceipts.map((r) => r.amountZatoshis));

  const handleDeleteConfirm = (id: string) => {
    deleteContext(id);
    navigate("/app");
  };

  return (
    <WorkspaceGate>
      <div className="flex min-w-0 flex-col gap-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/app" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-4" />
            <span>Overview</span>
          </Link>
          <span>/</span>
          <span className="text-foreground">{context.label}</span>
        </div>

        {/* Header with Title and Actions */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{context.label}</h1>
              <Badge variant="outline">{context.network}</Badge>
              <Badge variant={isArchived ? "muted" : "secondary"}>{context.status}</Badge>
              {context.coverage.stale && (
                <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
                  Stale coverage
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Internal handle: <code className="font-mono text-xs">{context.id}</code> ·
              Birthday height: <span className="font-mono font-medium">{context.birthdayHeight.toLocaleString()}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="default">
              <Link to={`/app/disclosures?contextId=${context.id}`}>
                <Share2 className="size-4" />
                Prepare disclosure
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/app/compare?primary=${context.id}`}>
                <Scale className="size-4" />
                Compare
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setArchiveOpen(true)}>
              <Archive className="size-4" />
              {isArchived ? "Unarchive" : "Archive"}
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Scope and Metadata Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold uppercase tracking-wider">Viewing Scope</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Retained Pools: </span>
                <span className="font-medium capitalize">{context.supportedPools.join(", ")}</span>
              </div>
              {context.unsupportedComponents.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">Declared Unretained: </span>
                  <button
                    type="button"
                    onClick={() => setUnsupportedOpen(true)}
                    className="inline-flex items-center gap-1 font-medium text-amber-600 underline dark:text-amber-400"
                  >
                    <span>{context.unsupportedComponents.join(", ")}</span>
                    <AlertTriangle className="size-3" />
                  </button>
                </div>
              )}
              <div>
                <span className="text-xs text-muted-foreground">Overlap Status: </span>
                {context.overlappingContextIds.length > 0 ? (
                  <Link
                    to={`/app/compare?primary=${context.id}`}
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    Shares capability ({context.overlappingContextIds.length} context)
                  </Link>
                ) : (
                  <span className="text-muted-foreground">No overlapping local contexts</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold uppercase tracking-wider">Scan Coverage</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Birthday Height: </span>
                <span className="font-mono">{context.birthdayHeight.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Last Scanned Height: </span>
                <span className="font-mono">{context.coverage.lastScannedHeight?.toLocaleString() ?? "None"}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Chain Tip: </span>
                <span className="font-mono">{context.coverage.tipHeight?.toLocaleString() ?? "Unknown"}</span>
              </div>
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isScanning}
                  onClick={() => void handleScan()}
                  className="w-full text-xs"
                >
                  <RefreshCw className={`size-3.5 ${isScanning ? "animate-spin text-primary" : ""}`} />
                  {isScanning
                    ? scanProgress
                      ? `Scanning #${scanProgress.currentHeight.toLocaleString()}...`
                      : "Scanning blocks..."
                    : "Scan for notes"}
                </Button>
              </div>
              {scanError && (
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Scan did not complete</AlertTitle>
                  <AlertDescription>{scanError}</AlertDescription>
                </Alert>
              )}
              {context.network === "testnet" && (
                <p className="text-xs text-muted-foreground">
                  Compact testnet blocks are trial-decrypted locally with the imported incoming key.
                  Only matching notes appear here; this is not a spendable balance or payment proof.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <FileCheck className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold uppercase tracking-wider">Received Receipts</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Total Incoming: </span>
                <span className="font-mono font-bold text-primary">
                  {formatZecFromZatoshis(totalZatoshis)} ZEC ({totalZatoshis} zatoshis)
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Receipt Count: </span>
                <span className="font-medium">{contextReceipts.length} notes</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Evidence Level: </span>
                <Badge variant="muted" className="text-xs">{context.coverage.source}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reorganisation / Rollback Notice */}
        {context.coverage.reorgNotice && (
          <Alert variant="warning">
            <AlertTriangle className="size-4" />
            <AlertTitle>Chain Reorganisation & Rollback Notice</AlertTitle>
            <AlertDescription>
              {context.coverage.reorgNotice.reason} Affected receipts and scan intervals have been rewound to block #{context.coverage.reorgNotice.rollbackHeight.toLocaleString()}.
            </AlertDescription>
          </Alert>
        )}

        {/* Scan Coverage Intervals & Gaps Notice */}
        {context.coverage.gaps.length > 0 && (
          <Alert variant="warning">
            <AlertTriangle className="size-4" />
            <AlertTitle>Incomplete Scan Coverage</AlertTitle>
            <AlertDescription>
              Block range{" "}
              <strong>
                {context.coverage.gaps.map((g) => `${g.startHeight.toLocaleString()}–${g.endHeight.toLocaleString()}`).join(", ")}
              </strong>{" "}
              was not inspected. Incoming notes received in this range are not recorded in this workbench.
            </AlertDescription>
          </Alert>
        )}

        {/* Receipts Table */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Decrypted Receipts ({contextReceipts.length})</h2>
              <p className="text-xs text-muted-foreground">
                Integer zatoshis formatted with exact BigInt arithmetic. Private amounts are inspected locally.
              </p>
            </div>
          </div>

          <Card className="overflow-hidden">
            <Table aria-label="Decrypted receipts table" className="min-w-[52rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Pool</TableHead>
                  <TableHead>Amount (ZEC)</TableHead>
                  <TableHead>Tx ID : Action</TableHead>
                  <TableHead>Block Height</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contextReceipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No decrypted receipts recorded for this context yet. Click &quot;Scan for notes&quot; above to scan compact blocks from the relay.
                    </TableCell>
                  </TableRow>
                ) : (
                  contextReceipts.map((receipt) => {
                  const hasMemo = receipt.memo.state === "available";
                  return (
                    <TableRow key={receipt.id}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {receipt.pool}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono font-semibold">
                            {formatZecFromZatoshis(receipt.amountZatoshis)} ZEC
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {receipt.amountZatoshis} zatoshis
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {shortHex(receipt.txIdHex, 7)} : {receipt.actionIndex}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {receipt.blockHeight.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="muted" className="text-xs">
                          {receipt.evidence}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {hasMemo ? (
                          <span className="inline-flex items-center gap-1 text-xs text-primary">
                            <MessageSquare className="size-3.5" />
                            Memo decrypted
                          </span>
                        ) : receipt.memo.state === "not-requested" ? (
                          <span className="text-xs text-muted-foreground">Not requested</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unavailable</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {hasMemo ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingMemoText(receipt.memo.state === "available" ? receipt.memo.text : "")}
                          >
                            <FileText className="size-3.5" />
                            View memo
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setActiveReceiptForMemo(receipt);
                              setMemoDialogOpen(true);
                            }}
                          >
                            Request memo
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Memo View Modal (when memo text is opened) */}
        {viewingMemoText !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-5 text-primary" />
                  <CardTitle className="text-lg">Decrypted Memo Text</CardTitle>
                </div>
                <CardDescription>
                  Decrypted locally in browser worker. Not transmitted over network.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border bg-muted/30 p-4 font-mono text-sm">
                  {viewingMemoText}
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button variant="default" onClick={() => setViewingMemoText(null)}>
                  Close
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Dialogs */}
        <ArchiveContextDialog
          context={context}
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          onConfirmArchive={archiveContext}
          onConfirmUnarchive={unarchiveContext}
        />

        <DeleteContextDialog
          context={context}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onConfirmDelete={handleDeleteConfirm}
        />

        <UnsupportedComponentsDialog
          context={context}
          open={unsupportedOpen}
          onOpenChange={setUnsupportedOpen}
        />

        <MemoPrivacyDialog
          receipt={activeReceiptForMemo}
          open={memoDialogOpen}
          onOpenChange={setMemoDialogOpen}
          onConfirmFetch={requestMemo}
          onOpenOfflineImport={(r) => {
            setActiveReceiptForMemo(r);
            setOfflineImportOpen(true);
          }}
        />

        <OfflineMemoImportDialog
          receipt={activeReceiptForMemo}
          open={offlineImportOpen}
          onOpenChange={setOfflineImportOpen}
          onImportMemo={importOfflineMemo}
        />
      </div>
    </WorkspaceGate>
  );
}
