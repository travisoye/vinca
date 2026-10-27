import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CardDescription } from "@/components/ui/card";
import { shortHex } from "@/lib/format";
import { parseRawTransactionHex } from "@/lib/memo";
import type { MemoData } from "@/adapters/types";
import type { Receipt } from "@/types";
import { AlertTriangle, Download, FileText, MessageSquare, ShieldAlert } from "lucide-react";

interface MemoPrivacyDialogProps {
  readonly receipt: Receipt | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirmFetch: (receiptId: string) => Promise<MemoData>;
  readonly onMemoFetched: (memoData: MemoData) => void;
  readonly onOpenOfflineImport: (receipt: Receipt) => void;
}

interface MemoImportDialogProps {
  readonly receipt: Receipt | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirmImport: (receiptId: string, txBytes: Uint8Array) => Promise<MemoData>;
}

type MemoFormatLabel = {
  readonly label: string;
  readonly variant: "default" | "secondary" | "outline";
};

const FORMAT_LABELS: Record<MemoData["format"], MemoFormatLabel> = {
  text: { label: "Text memo", variant: "default" },
  "no-memo": { label: "No memo present", variant: "secondary" },
  "arbitrary-bytes": { label: "Arbitrary bytes", variant: "outline" },
  "future-format": { label: "Future memo format", variant: "outline" },
  "legacy-nontext": { label: "Legacy non-text memo", variant: "outline" },
};

export function MemoPrivacyDialog({
  receipt,
  open,
  onOpenChange,
  onConfirmFetch,
  onMemoFetched,
  onOpenOfflineImport,
}: MemoPrivacyDialogProps) {
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setFetchError(null);
  }, [open, receipt?.id]);

  if (!receipt) return null;

  const handleConfirmFetch = async () => {
    if (isFetching) return;

    setIsFetching(true);
    setFetchError(null);
    try {
      const memo = await onConfirmFetch(receipt.id);
      onMemoFetched(memo);
      onOpenChange(false);
    } catch (error) {
      setFetchError(
        error instanceof Error
          ? error.message
          : "The memo could not be fetched and decrypted.",
      );
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isFetching) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-warning">
            <ShieldAlert className="size-5" />
            <DialogTitle>Transaction-Interest Disclosure</DialogTitle>
          </div>
          <DialogDescription>
            Requesting a transaction to decrypt its memo reveals transaction interest to the network.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-relaxed">
          <Alert variant="warning">
            <AlertTriangle className="size-4" />
            <AlertTitle>Privacy Notice: Relay Query</AlertTitle>
            <AlertDescription>
              Fetching the full transaction containing output #{receipt.actionIndex} requires sending the transaction ID{" "}
              <code className="font-mono text-xs font-semibold">{shortHex(receipt.txIdHex, 8)}</code> to the public data relay.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
            <h4 className="font-medium">What is and is not revealed:</h4>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                <strong className="text-foreground">Revealed:</strong> Your interest in transaction {shortHex(receipt.txIdHex, 6)} and your client IP (unless using a proxy/Tor).
              </li>
              <li>
                <strong className="text-foreground">Never revealed:</strong> Your incoming viewing key, recipient address, note amount, or decrypted memo text. Decryption executes entirely inside your browser.
              </li>
            </ul>
          </div>

          {fetchError && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Memo could not be decrypted</AlertTitle>
              <AlertDescription>{fetchError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            disabled={isFetching}
            onClick={() => {
              onOpenChange(false);
              onOpenOfflineImport(receipt);
            }}
          >
            <Download className="size-4" />
            Use offline import
          </Button>
          <Button
            variant="default"
            disabled={isFetching}
            onClick={() => void handleConfirmFetch()}
          >
            {isFetching ? "Fetching and decrypting..." : "Acknowledge & fetch memo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OfflineMemoImportDialog({
  receipt,
  open,
  onOpenChange,
  onConfirmImport,
}: MemoImportDialogProps) {
  const [txHex, setTxHex] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTxHex("");
      setImportError(null);
    }
  }, [open, receipt?.id]);

  if (!receipt) return null;

  const handleConfirmImport = async () => {
    if (isImporting) return;

    setIsImporting(true);
    setImportError(null);
    try {
      const txBytes = parseRawTransactionHex(txHex);
      await onConfirmImport(receipt.id, txBytes);
      onOpenChange(false);
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "The offline transaction could not be imported.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isImporting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileText className="size-5" />
            <DialogTitle>Offline Transaction Import</DialogTitle>
          </div>
          <DialogDescription>
          Paste a full serialized V5 or V6 transaction as hex. No relay request is made.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <label htmlFor="offline-transaction-hex" className="text-sm font-medium">
              Raw transaction hex
            </label>
            <Textarea
              id="offline-transaction-hex"
              value={txHex}
              onChange={(e) => setTxHex(e.target.value)}
              placeholder="05000080..."
              className="font-mono text-xs"
              rows={4}
              maxLength={4 * 1024 * 1024}
            />
            <p className="text-xs text-muted-foreground">
              Even-length hex only. Maximum 2 MiB decoded bytes. JSON/RPC envelopes and compact-block data are rejected.
            </p>
          </div>

          {importError && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Import failed</AlertTitle>
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" disabled={isImporting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            disabled={isImporting || !txHex.trim().length}
            onClick={() => void handleConfirmImport()}
          >
            {isImporting ? "Importing..." : "Import and decrypt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MemoViewer({
  memo,
  receipt,
  onClose,
}: {
  readonly memo: MemoData;
  readonly receipt: Receipt;
  readonly onClose: () => void;
}) {
  const formatLabel = FORMAT_LABELS[memo.format];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" />
            <DialogTitle className="text-lg">Decrypted Memo</DialogTitle>
          </div>
          <CardDescription>
            Decrypted locally in browser worker. Not transmitted over network.
          </CardDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-muted/50">
            <Badge variant={formatLabel.variant} className="capitalize">
              {formatLabel.label}
            </Badge>
            <span className="text-xs text-muted-foreground ml-auto">
              Output #{receipt.actionIndex}
            </span>
          </div>

          {memo.format === "text" && memo.text.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 font-mono text-sm whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
              {memo.text}
            </div>
          ) : memo.format === "text" ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              This text memo is empty.
            </div>
          ) : memo.format === "no-memo" ? (
            <p className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              No memo is present in this transaction output.
            </p>
          ) : (
            null
          )}
          {memo.format !== "text" && memo.rawBytesHex ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Complete 512-byte memo, shown as hex:</p>
              <div className="max-h-96 overflow-y-auto break-all rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs">
                {memo.rawBytesHex}
              </div>
            </div>
          ) : memo.format !== "text" ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Raw memo bytes are unavailable on this legacy saved record.
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex justify-end">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
