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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { shortHex } from "@/lib/format";
import type { Receipt } from "@/types";
import { AlertTriangle, Download, FileText, ShieldAlert } from "lucide-react";

interface MemoPrivacyDialogProps {
  readonly receipt: Receipt | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirmFetch: (receiptId: string) => Promise<string>;
  readonly onMemoFetched: (memoText: string) => void;
  readonly onOpenOfflineImport: (receipt: Receipt) => void;
}

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
      const memoText = await onConfirmFetch(receipt.id);
      onMemoFetched(memoText);
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

          <p className="text-muted-foreground">
            Offline transaction import is also unavailable until full transaction parsing and memo decryption are implemented.
          </p>

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

interface OfflineMemoImportDialogProps {
  readonly receipt: Receipt | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function OfflineMemoImportDialog({
  receipt,
  open,
  onOpenChange,
}: OfflineMemoImportDialogProps) {
  if (!receipt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileText className="size-5" />
            <DialogTitle>Offline Transaction Import</DialogTitle>
          </div>
          <DialogDescription>
            Offline transaction parsing and memo decryption are not implemented yet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            No transaction data will be processed or saved. Memo #{receipt.actionIndex} for transaction{" "}
            <span className="font-mono text-xs">{shortHex(receipt.txIdHex, 8)}</span> cannot be decrypted by this version.
          </p>
        </div>

        <DialogFooter>
          <Button variant="default" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
